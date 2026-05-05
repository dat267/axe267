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

// Middleware to verify Firebase ID Token
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send("Unauthorized: No Bearer token provided");
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

export const api = onRequest(app);
