import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  type Auth,
  type User,
} from "firebase/auth";
import { runAuthOp } from "../utils/authResult";

/**
 * Sign in with email and password.
 */
export function signIn(auth: Auth, email: string, password: string) {
  return runAuthOp(async () => {
    await signInWithEmailAndPassword(auth, email, password);
  });
}

/**
 * Create a new account with email and password.
 */
export function signUp(auth: Auth, email: string, password: string) {
  return runAuthOp(async () => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  });
}

/**
 * Send a password reset email.
 */
export function resetPassword(auth: Auth, email: string) {
  return runAuthOp(() => sendPasswordResetEmail(auth, email));
}

/**
 * Send an email verification.
 */
export function sendVerification(user: User) {
  return runAuthOp(() => sendEmailVerification(user));
}
