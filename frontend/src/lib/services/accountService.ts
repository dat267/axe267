import {
  verifyBeforeUpdateEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from "firebase/auth";
import { runAuthOp } from "../utils/authResult";

/**
 * Update the user's email address. Sends a verification email to the new address.
 */
export function updateEmail(user: User, newEmail: string) {
  return runAuthOp(() => verifyBeforeUpdateEmail(user, newEmail), { reauthable: true });
}

/**
 * Delete the user's account.
 */
export function deleteAccount(user: User) {
  return runAuthOp(() => deleteUser(user), { reauthable: true });
}

/**
 * Re-authenticate the user with their password.
 */
export function reauthenticate(user: User, password: string) {
  return runAuthOp(() => {
    const credential = EmailAuthProvider.credential(user.email ?? "", password);
    return reauthenticateWithCredential(user, credential);
  });
}
