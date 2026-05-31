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
    if (auth.currentUser) {
      console.log("Refreshing auth status...");
      await auth.currentUser.reload();
      this.#user = auth.currentUser;
      this.#isVerified = auth.currentUser.emailVerified;
      try {
        const idTokenResult = await auth.currentUser.getIdTokenResult(true);
        this.#isAdmin = !!idTokenResult.claims.admin;
        if (!this.#isAdmin) {
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userDoc.exists() && userDoc.data().role === "admin") {
            this.#isAdmin = true;
          }
        }
      } catch (e) {
        this.#isAdmin = false;
      }
      console.log("New verification status:", this.#isVerified);
    }
  }
}
export const authStore = new AuthStore();
