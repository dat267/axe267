/**
 * Run a Firebase Auth operation and normalize the outcome into a result shape.
 *
 * On success, the operation's return value (an object, or undefined) is merged
 * into `{ success: true }`. On failure, returns `{ error }` using the error
 * code (falling back to the message). When `reauthable` is set, an
 * `auth/requires-recent-login` failure is additionally flagged with
 * `requiresReauth: true`.
 *
 * @param {() => Promise<object | undefined>} fn
 * @param {{ reauthable?: boolean }} [options]
 * @returns {Promise<{success?: boolean, error?: string, requiresReauth?: boolean}>}
 */
export async function runAuthOp(fn, { reauthable = false } = {}) {
  try {
    const extra = await fn();
    return { success: true, ...(extra ?? {}) };
  } catch (e) {
    const error = e.code || e.message;
    if (reauthable && e.code === "auth/requires-recent-login") {
      return { error, requiresReauth: true };
    }
    return { error };
  }
}
