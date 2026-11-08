import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

export async function resolveAdmin(user, getTokenResult = () => user?.getIdTokenResult()) {
  if (!user) return false;
  let idTokenResult;
  try {
    idTokenResult = await getTokenResult();
  } catch (_e) {
    idTokenResult = null;
  }
  if (idTokenResult?.claims?.admin) return true;
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return userDoc.exists() && userDoc.data().role === "admin";
  } catch (_e) {
    return false;
  }
}
