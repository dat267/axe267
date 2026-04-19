/**
 * Handles browser notification permissions and sending local notifications.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.error("This browser does not support desktop notification");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export function sendLocalNotification(title: string, options?: NotificationOptions & { onClick?: () => void }) {
  if (Notification.permission === "granted") {
    const { onClick, ...notificationOptions } = options || {};
    const notification = new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...notificationOptions
    });

    notification.onclick = () => {
      window.focus();
      if (onClick) onClick();
      notification.close();
    };
  }
}
