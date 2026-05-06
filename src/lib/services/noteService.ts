import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  limit,
  serverTimestamp,
  getCountFromServer,
  type Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface Note {
  id: string;
  userEmail: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const NOTES_COLLECTION = "notes";

/**
 * Gets the total count of notes for a specific user.
 */
export async function getNotesCount(userEmail: string) {
  try {
    const q = query(
      collection(db, NOTES_COLLECTION),
      where("userEmail", "==", userEmail)
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error("Error getting notes count:", error);
    return 0;
  }
}

/**
 * Creates a new note in Firestore.
 */
export async function createNote(userEmail: string, title: string, content: string) {
  try {
    const docRef = await addDoc(collection(db, NOTES_COLLECTION), {
      userEmail,
      title,
      content,
      isPinned: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating note:", error);
    throw error;
  }
}

/**
 * Subscribes to notes for a specific user.
 */
export function subscribeNotes(
  userEmail: string,
  callback: (notes: Note[]) => void,
  limitCount: number = 50
) {
  const q = query(
    collection(db, NOTES_COLLECTION),
    where("userEmail", "==", userEmail),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Note[];

    callback(notes);
  }, (error) => {
    console.error("Subscription error:", error);
  });
}
/**
 * Updates an existing note.
 */
export async function updateNote(id: string, title: string, content: string) {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, id);
    await updateDoc(noteRef, {
      title,
      content,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating note:", error);
    throw error;
  }
}

/**
 * Toggles the pinned status of a note.
 */
export async function togglePin(id: string, currentPinned: boolean) {
  try {
    const noteRef = doc(db, NOTES_COLLECTION, id);
    await updateDoc(noteRef, {
      isPinned: !currentPinned,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error toggling pin:", error);
    throw error;
  }
}

/**
 * Deletes a note.
 */
export async function deleteNote(id: string) {
  try {
    await deleteDoc(doc(db, NOTES_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting note:", error);
    throw error;
  }
}
