const ERROR_MAP: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/too-many-requests": "Too many failed attempts. Try again later.",
  "auth/user-disabled": "This account has been disabled by an administrator.",
  "auth/operation-not-allowed": "This sign-in method is currently disabled.",
  "auth/email-already-in-use": "An account already exists with this email address.",
  "auth/weak-password": "Password is too weak. Please use at least 6 characters.",
  "auth/invalid-email": "The email address is not valid.",
  "auth/requires-recent-login": "You must log in again before making this change.",
  "auth/network-request-failed": "Network error. Please check your internet connection.",
  "auth/internal-error": "An internal error occurred. Please try again later.",
  "auth/email-change-needs-verification": "Verify your new email before it updates.",
};

export function getErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred. Please try again.";

  let code = String(error);

  if (typeof error === "object" && "code" in error) {
    code = String(error.code);
  } else if (typeof error === "string" && error.includes("(")) {
    code = error.match(/\(([^)]+)\)/)?.[1] ?? error;
  }

  return ERROR_MAP[code] ?? "An unexpected error occurred. Please try again.";
}