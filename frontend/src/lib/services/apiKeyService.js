import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const KEYS_COLLECTION = "api_keys";
const KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function generateRandomKey(length = 32) {
  const buffer = new Uint32Array(1);
  let result = "ntfy_";
  for (let i = 0; i < length; i++) {
    let value;
    do {
      window.crypto.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= 0xffffffff - (0xffffffff % KEY_ALPHABET.length));
    result += KEY_ALPHABET.charAt(value % KEY_ALPHABET.length);
  }
  return result;
}

export async function hashApiKey(key) {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createApiKey(userId, userEmail, name) {
  const key = generateRandomKey();
  try {
    const keyHash = await hashApiKey(key);
    const docRef = await addDoc(collection(db, KEYS_COLLECTION), {
      keyHash,
      userId,
      userEmail,
      name,
      createdAt: serverTimestamp(),
    });
    return { id: docRef.id, key };
  } catch (error) {
    console.error("Error in createApiKey service:", error);
    // Rethrow with more context if needed, but the console log should help the user see it
    throw error;
  }
}

export function subscribeApiKeys(userId, callback) {
  const q = query(collection(db, KEYS_COLLECTION), where("userId", "==", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const keys = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(keys);
    },
    (error) => {
      console.error("API Key subscription error:", error);
    },
  );
}

export async function deleteApiKey(id) {
  await deleteDoc(doc(db, KEYS_COLLECTION, id));
}
