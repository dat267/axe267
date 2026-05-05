import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc,
  serverTimestamp,
  type Timestamp
} from "firebase/firestore";
import { db } from "./firebase";

export interface Notification {
  id: string;
  userEmail: string;
  type: 'info' | 'success' | 'warning' | 'error';
  source: string;
  title: string;
  message: string;
  category: 'system' | 'mobile' | 'desktop';
  createdAt: Timestamp;
}

const NOTIFICATIONS_COLLECTION = "notifications";

/**
 * Pushes a notification to Firestore. 
 * Intended for use by CLI environments.
 */
export async function pushNotification(data: Omit<Notification, 'id' | 'createdAt'>) {
  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error pushing notification:", error);
    throw error;
  }
}

/**
 * Subscribes to notifications for a specific user.
 */
export function subscribeNotifications(userEmail: string, callback: (notifications: Notification[]) => void) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("userEmail", "==", userEmail),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[];
    callback(notifications);
  }, (error) => {
    console.error("Subscription error:", error);
  });
}

/**
 * Deletes a specific notification by ID.
 */
export async function deleteNotification(id: string) {
  try {
    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}
