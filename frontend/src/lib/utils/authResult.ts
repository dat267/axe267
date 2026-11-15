export interface AuthFailure {
  success?: false;
  error: string;
  requiresReauth?: boolean;
}

export type AuthResult<T extends object = Record<string, never>> = ({ success: true } & T) | AuthFailure;

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error && error.code) {
    return String(error.code);
  }
  return undefined;
}

function errorText(error: unknown): string {
  const code = errorCode(error);
  if (code) return code;
  if (typeof error === "object" && error !== null && "message" in error && error.message) {
    return String(error.message);
  }
  return String(error);
}

/**
 * Run a Firebase Auth operation and normalize the outcome into a result shape.
 *
 * On success, the operation's return value (an object, or undefined) is merged
 * into `{ success: true }`. On failure, returns `{ error }` using the error
 * code (falling back to the message). When `reauthable` is set, an
 * `auth/requires-recent-login` failure is additionally flagged with
 * `requiresReauth: true`.
 */
export async function runAuthOp<T extends object = Record<string, never>>(
  fn: () => Promise<T | void>,
  { reauthable = false }: { reauthable?: boolean } = {},
): Promise<AuthResult<T>> {
  try {
    const extra = await fn();
    return { success: true, ...(extra ?? {}) } as AuthResult<T>;
  } catch (e) {
    if (reauthable && errorCode(e) === "auth/requires-recent-login") {
      return { error: errorText(e), requiresReauth: true };
    }
    return { error: errorText(e) };
  }
}
