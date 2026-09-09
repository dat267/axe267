import { verifyBeforeUpdateEmail, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { runAuthOp } from "../utils/authResult";

/**
 * Update the user's email address. Sends a verification email to the new address.
 *
 * @param {object} user - Firebase Auth user
 * @param {string} newEmail - The new email address
 * @returns {Promise<{success?: boolean, error?: string, requiresReauth?: boolean}>}
 */
export function updateEmail(user, newEmail) {
  return runAuthOp(() => verifyBeforeUpdateEmail(user, newEmail), { reauthable: true });
}

/**
 * Delete the user's account.
 *
 * @param {object} user - Firebase Auth user
 * @returns {Promise<{success?: boolean, error?: string, requiresReauth?: boolean}>}
 */
export function deleteAccount(user) {
  return runAuthOp(() => deleteUser(user), { reauthable: true });
}

/**
 * Re-authenticate the user with their password.
 *
 * @param {object} user - Firebase Auth user
 * @param {string} password - The user's password
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export function reauthenticate(user, password) {
  return runAuthOp(() => {
    const credential = EmailAuthProvider.credential(user.email, password);
    return reauthenticateWithCredential(user, credential);
  });
}
