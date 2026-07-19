import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
class AuthStore {
  #user = $state(null);
  #loading = $state(true);
  #isVerified = $state(false);
  #isAdmin = $state(false);
  constructor() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      this.#user = firebaseUser;
      this.#isVerified = firebaseUser?.emailVerified ?? false;
      if (firebaseUser) {
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult();
          this.#isAdmin = !!idTokenResult.claims.admin;
          if (!this.#isAdmin) {
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
            if (userDoc.exists() && userDoc.data().role === "admin") {
              this.#isAdmin = true;
            }
          }
        } catch (e) {
          this.#isAdmin = false;
        }
      } else {
        this.#isAdmin = false;
      }
      this.#loading = false;
    });
  }
  get user() { return this.#user; }
  set user(value) { this.#user = value; }
  get loading() { return this.#loading; }
  get isVerified() { return this.#isVerified; }
  set isVerified(value) { this.#isVerified = value; }
  get isAdmin() { return this.#isAdmin; }
  async refreshStatus() {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await user.reload();
    } catch (e) {
      console.warn("Failed to reload user:", e);
      return;
    }
    const refreshedUser = auth.currentUser;
    if (!refreshedUser) {
      this.#user = null;
      this.#isVerified = false;
      this.#isAdmin = false;
      return;
    }
    this.#user = refreshedUser;
    this.#isVerified = refreshedUser.emailVerified;
    try {
      const idTokenResult = await refreshedUser.getIdTokenResult(true);
      this.#isAdmin = !!idTokenResult.claims.admin;
      if (!this.#isAdmin) {
        const userDoc = await getDoc(doc(db, "users", refreshedUser.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          this.#isAdmin = true;
        }
      }
    } catch (e) {
      this.#isAdmin = false;
    }
  }
}
export const authStore = new AuthStore();
