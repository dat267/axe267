import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  limit,
  getCountFromServer,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";

const NOTIFICATIONS_COLLECTION = "notifications";

export type NotificationTimestamp = { toDate(): Date } | Date | string | number | null;

export interface NotificationItem {
  id: string;
  userEmail: string;
  type: string;
  source: string;
  title: string;
  message: string;
  category: string;
  createdAt?: NotificationTimestamp;
}

/**
 * Gets the total count of notifications for a specific user.
 */
export async function getNotificationsCount(userEmail: string): Promise<number> {
  try {
    const q = query(collection(db, NOTIFICATIONS_COLLECTION), where("userEmail", "==", userEmail));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error("Error getting notifications count:", error);
    return 0;
  }
}

/**
 * Subscribes to notifications for a specific user.
 */
export function subscribeNotifications(
  userEmail: string,
  callback: (items: NotificationItem[]) => void,
  limitCount = 20,
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("userEmail", "==", userEmail),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(
        (notificationDoc) => ({ id: notificationDoc.id, ...notificationDoc.data() }) as NotificationItem,
      );
      callback(notifications);
    },
    (error) => {
      console.error("Subscription error:", error);
    },
  );
}

/**
 * Deletes a specific notification by ID.
 */
export async function deleteNotification(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

export async function clearAllNotifications(idToken: string): Promise<{ count: number }> {
  const apiUrl = "/api/notify";
  try {
    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to clear notifications: ${text}`);
    }
    return (await response.json()) as { count: number };
  } catch (error) {
    console.error("Error in clearAllNotifications:", error);
    throw error;
  }
}
