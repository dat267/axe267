import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  limit,
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
export function subscribeNotifications(
  userEmail: string, 
  callback: (notifications: Notification[]) => void,
  limitCount: number = 20
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("userEmail", "==", userEmail),
    orderBy("createdAt", "desc"),
    limit(limitCount)
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

/**
 * Clears all notifications for the current user via the backend API.
 */
export async function clearAllNotifications(idToken: string) {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
  const region = "asia-southeast1";
  const apiUrl = `https://${region}-${projectId}.cloudfunctions.net/api/notify`;

  try {
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to clear notifications: ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in clearAllNotifications:", error);
    throw error;
  }
}
