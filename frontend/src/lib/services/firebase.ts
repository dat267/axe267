import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
// Same persistence order as getAuth(), but without the popup/redirect
// resolver: sign-in is email/password only, and the resolver would load a
// hidden third-party iframe from the auth domain on every page load (which
// Firefox flags under storage partitioning). Add `popupRedirectResolver:
// browserPopupRedirectResolver` back if a popup/redirect provider is added.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});
export const db = getFirestore(app);

let storageInstance: FirebaseStorage | undefined;
export async function getStorageInstance(): Promise<FirebaseStorage> {
  if (!storageInstance) {
    const { getStorage } = await import("firebase/storage");
    storageInstance = getStorage(app);
  }
  return storageInstance;
}
