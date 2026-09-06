import { verifyBeforeUpdateEmail, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";

/**
 * Update the user's email address. Sends a verification email to the new address.
 *
 * @param {object} user - Firebase Auth user
 * @param {string} newEmail - The new email address
 * @returns {Promise<{success?: boolean, error?: string, requiresReauth?: boolean}>}
 */
export async function updateEmail(user, newEmail) {
  try {
    await verifyBeforeUpdateEmail(user, newEmail);
    return { success: true };
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      return { error: e.code, requiresReauth: true };
    }
    return { error: e.code || e.message };
  }
}

/**
 * Delete the user's account.
 *
 * @param {object} user - Firebase Auth user
 * @returns {Promise<{success?: boolean, error?: string, requiresReauth?: boolean}>}
 */
export async function deleteAccount(user) {
  try {
    await deleteUser(user);
    return { success: true };
  } catch (e) {
    if (e.code === "auth/requires-recent-login") {
      return { error: e.code, requiresReauth: true };
    }
    return { error: e.code || e.message };
  }
}

/**
 * Re-authenticate the user with their password.
 *
 * @param {object} user - Firebase Auth user
 * @param {string} password - The user's password
 * @returns {Promise<{success?: boolean, error?: string}>}
 */
export async function reauthenticate(user, password) {
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    return { success: true };
  } catch (e) {
    return { error: e.code || e.message };
  }
}
