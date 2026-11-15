import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export interface AdminUser {
  uid: string;
  getIdTokenResult?: () => Promise<{ claims: Record<string, unknown> }>;
}

export async function resolveAdmin(
  user: AdminUser | null,
  getTokenResult?: () => Promise<{ claims: Record<string, unknown> }>,
): Promise<boolean> {
  if (!user) return false;
  let idTokenResult: { claims: Record<string, unknown> } | null;
  try {
    idTokenResult = getTokenResult
      ? await getTokenResult()
      : user.getIdTokenResult
        ? await user.getIdTokenResult()
        : null;
  } catch {
    idTokenResult = null;
  }
  if (idTokenResult?.claims?.admin) return true;
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return userDoc.exists() && userDoc.data().role === "admin";
  } catch {
    return false;
  }
}
