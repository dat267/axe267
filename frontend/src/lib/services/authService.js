import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";

/**
 * Sign in with email and password.
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export async function signIn(auth, email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { success: true };
  } catch (e) {
    return { error: e.code || e.message };
  }
}

/**
 * Create a new account with email and password.
 * @returns {Promise<{success?: boolean, user?: object, error?: string}>}
 */
export async function signUp(auth, email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return { success: true, user: cred.user };
  } catch (e) {
    return { error: e.code || e.message };
  }
}

/**
 * Send a password reset email.
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export async function resetPassword(auth, email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (e) {
    return { error: e.code || e.message };
  }
}

/**
 * Send an email verification.
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export async function sendVerification(user) {
  try {
    await sendEmailVerification(user);
    return { success: true };
  } catch (e) {
    return { error: e.code || e.message };
  }
}
