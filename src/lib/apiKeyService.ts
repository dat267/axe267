import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc,
  serverTimestamp,
  type Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface ApiKey {
  id: string;
  key: string;
  userId: string;
  userEmail: string;
  name: string;
  createdAt: Timestamp;
}

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

export async function createApiKey(userId: string, userEmail: string, name: string) {
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
  } catch (error: any) {
    console.error("Error in createApiKey service:", error);
    // Rethrow with more context if needed, but the console log should help the user see it
    throw error;
  }
}

export function subscribeApiKeys(userId: string, callback: (keys: ApiKey[]) => void) {
  const q = query(
    collection(db, KEYS_COLLECTION),
    where("userId", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const keys = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ApiKey[];
    callback(keys);
  }, (error) => {
    console.error("API Key subscription error:", error);
  });
}

export async function deleteApiKey(id: string) {
  await deleteDoc(doc(db, KEYS_COLLECTION, id));
}
