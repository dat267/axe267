import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

const KEYS_COLLECTION = "api_keys";

export function generateRandomKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'ntfy_';
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  return result;
}

export async function createApiKey(userId, userEmail, name) {
  const key = generateRandomKey();
  try {
    const docRef = await addDoc(collection(db, KEYS_COLLECTION), {
      key,
      userId,
      userEmail,
      name,
      createdAt: serverTimestamp()
    });
    return { id: docRef.id, key };
  } catch (error) {
    console.error("Error in createApiKey service:", error);
    // Rethrow with more context if needed, but the console log should help the user see it
    throw error;
  }
}

export function subscribeApiKeys(userId, callback) {
  const q = query(
    collection(db, KEYS_COLLECTION),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const keys = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(keys);
  }, (error) => {
    console.error("API Key subscription error:", error);
  });
}

export async function deleteApiKey(id) {
  await deleteDoc(doc(db, KEYS_COLLECTION, id));
}
