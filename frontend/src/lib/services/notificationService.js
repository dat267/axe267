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
} from "firebase/firestore";
import { db } from "./firebase";

const NOTIFICATIONS_COLLECTION = "notifications";

/**
 * Gets the total count of notifications for a specific user.
 */
export async function getNotificationsCount(userEmail) {
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
export function subscribeNotifications(userEmail, callback, limitCount = 20) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where("userEmail", "==", userEmail),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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
export async function deleteNotification(id) {
  try {
    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

export async function clearAllNotifications(idToken) {
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
    return await response.json();
  } catch (error) {
    console.error("Error in clearAllNotifications:", error);
    throw error;
  }
}
