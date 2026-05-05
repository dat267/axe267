import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../services/firebase";

class AuthStore {
  #user = $state<User | null>(null);
  #loading = $state(true);
  #isVerified = $state(false);

  constructor() {
    onAuthStateChanged(auth, (firebaseUser) => {
      this.#user = firebaseUser;
      this.#isVerified = firebaseUser?.emailVerified ?? false;
      this.#loading = false;
    });
  }

  get user() { return this.#user; }
  set user(value: User | null) { this.#user = value; }

  get loading() { return this.#loading; }

  get isVerified() { return this.#isVerified; }
  set isVerified(value: boolean) { this.#isVerified = value; }

  async refreshStatus() {
    if (auth.currentUser) {
      console.log("Refreshing auth status...");
      await auth.currentUser.reload();
      this.#user = auth.currentUser;
      this.#isVerified = auth.currentUser.emailVerified;
      console.log("New verification status:", this.#isVerified);
    }
  }
}

export const authStore = new AuthStore();
