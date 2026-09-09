import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import { runAuthOp } from "../utils/authResult";

/**
 * Sign in with email and password.
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export function signIn(auth, email, password) {
  return runAuthOp(async () => {
    await signInWithEmailAndPassword(auth, email, password);
  });
}

/**
 * Create a new account with email and password.
 * @returns {Promise<{success?: boolean, user?: object, error?: string}>}
 */
export function signUp(auth, email, password) {
  return runAuthOp(async () => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  });
}

/**
 * Send a password reset email.
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export function resetPassword(auth, email) {
  return runAuthOp(() => sendPasswordResetEmail(auth, email));
}

/**
 * Send an email verification.
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export function sendVerification(user) {
  return runAuthOp(() => sendEmailVerification(user));
}
