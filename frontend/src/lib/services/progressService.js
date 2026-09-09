import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const PROGRESS_COLLECTION = "user_progress";

/**
 * Firestore doc id for a user's reading progress on a book.
 */
export function progressDocId(uid, title) {
  return `${uid}_${title.replace(/[^a-z0-9]/gi, "_")}`;
}

/**
 * Persist the user's current reading position (CFI) for a book.
 */
export async function saveProgress(uid, title, cfi) {
  await setDoc(
    doc(db, PROGRESS_COLLECTION, progressDocId(uid, title)),
    { uid, cfi, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Load the saved reading position (CFI) for a book, or null if none exists.
 */
export async function loadProgress(uid, title) {
  const docSnap = await getDoc(doc(db, PROGRESS_COLLECTION, progressDocId(uid, title)));
  return docSnap.exists() ? docSnap.data().cfi : null;
}
