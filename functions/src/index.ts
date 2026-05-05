import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

admin.initializeApp();

// Set global options to use asia-southeast1 region
setGlobalOptions({ region: "asia-southeast1" });

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Extend Request type to include user
interface AuthRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

// Middleware to verify Firebase ID Token or API Key
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers["x-api-key"];

  if (apiKey) {
    try {
      const keysSnapshot = await admin.firestore()
        .collection("api_keys")
        .where("key", "==", apiKey)
        .limit(1)
        .get();

      if (keysSnapshot.empty) {
        return res.status(401).send("Unauthorized: Invalid API Key");
      }

      const keyData = keysSnapshot.docs[0].data();
      req.user = {
        uid: keyData.userId,
        email: keyData.userEmail,
        // Mock other fields required by admin.auth.DecodedIdToken if necessary
      } as admin.auth.DecodedIdToken;
      
      return next();
    } catch (error) {
      console.error("Error verifying API key:", error);
      return res.status(500).send("Internal Server Error");
    }
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No valid authentication provided (Bearer token or x-api-key)");
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res.status(401).send("Unauthorized: Invalid token");
  }
};

/**
 * POST /notify
 * Sends a notification on behalf of the authenticated user.
 * Body: { type, source, title, message, category }
 */
app.post("/notify", authenticate, async (req: AuthRequest, res: Response) => {
  const { type, source, title, message, category } = req.body;
  const userEmail = req.user?.email;

  if (!userEmail) {
    return res.status(401).send("Unauthorized: User email not found in token");
  }

  if (!type || !source || !title || !message || !category) {
    return res.status(400).send("Bad Request: Missing required fields");
  }

  try {
    const docRef = await admin.firestore().collection("notifications").add({
      userEmail,
      type,
      source,
      title,
      message,
      category,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).send({ id: docRef.id });
  } catch (error) {
    console.error("Error adding notification:", error);
    return res.status(500).send("Internal Server Error");
  }
});

/**
 * DELETE /notify
 * Clears all notifications for the authenticated user.
 */
app.delete("/notify", authenticate, async (req: AuthRequest, res: Response) => {
  const userEmail = req.user?.email;

  if (!userEmail) {
    return res.status(401).send("Unauthorized: User email not found");
  }

  try {
    const snapshot = await admin.firestore()
      .collection("notifications")
      .where("userEmail", "==", userEmail)
      .get();

    if (snapshot.empty) {
      return res.status(200).send({ count: 0 });
    }

    // Delete in batches of 500 (Firestore limit)
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += 500) {
      chunks.push(snapshot.docs.slice(i, i + 500));
    }

    for (const chunk of chunks) {
      const batch = admin.firestore().batch();
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }

    return res.status(200).send({ count: snapshot.size });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    return res.status(500).send("Internal Server Error");
  }
});

export const api = onRequest(app);
