import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../services/firebase";
import { reconcileApiKeyEmails } from "../services/apiKeyService";
import { resolveAdmin } from "./resolveAdmin";

class AuthStore {
  #user = $state<User | null>(null);
  #loading = $state(true);
  #isVerified = $state(false);
  #isAdmin = $state(false);

  constructor() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      this.#user = firebaseUser;
      this.#isVerified = firebaseUser?.emailVerified ?? false;
      this.#isAdmin = firebaseUser ? await resolveAdmin(firebaseUser) : false;
      this.#loading = false;
      if (firebaseUser?.emailVerified && auth.currentUser?.uid === firebaseUser.uid) {
        reconcileApiKeyEmails(firebaseUser).catch((e) => console.warn("API key email sync failed:", e));
      }
    });
  }

  get user(): User | null {
    return this.#user;
  }

  get loading(): boolean {
    return this.#loading;
  }

  get isVerified(): boolean {
    return this.#isVerified;
  }

  get isAdmin(): boolean {
    return this.#isAdmin;
  }

  async refreshStatus(): Promise<void> {
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
    this.#isAdmin = await resolveAdmin(refreshedUser, () => refreshedUser.getIdTokenResult(true));
    if (refreshedUser.emailVerified) {
      reconcileApiKeyEmails(refreshedUser).catch((e) => console.warn("API key email sync failed:", e));
    }
  }
}

export const authStore = new AuthStore();
