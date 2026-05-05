const ERROR_MAP = {
  // Login & General
  "auth/invalid-credential": "Invalid email or password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/too-many-requests": "Too many failed attempts. This account has been temporarily disabled. Try again later.",
  "auth/user-disabled": "This account has been disabled by an administrator.",
  "auth/operation-not-allowed": "This sign-in method is currently disabled.",
  
  // Sign Up
  "auth/email-already-in-use": "An account already exists with this email address.",
  "auth/weak-password": "Password is too weak. Please use at least 6 characters.",
  "auth/invalid-email": "The email address is not valid.",
  
  // Verification & Account Changes
  "auth/requires-recent-login": "For security, you must log in again before making this change.",
  "auth/network-request-failed": "Network error. Please check your internet connection.",
  "auth/internal-error": "An internal error occurred. Please try again later.",
  "auth/email-change-needs-verification": "Please verify your new email address before it can be updated.",
};

export function getErrorMessage(errorCode) {
  if (!errorCode) return "An unexpected error occurred. Please try again.";
  
  // Extract code from strings like "Firebase: Error (auth/code)."
  const code = typeof errorCode === 'string' && errorCode.includes('(') 
    ? errorCode.match(/\(([^)]+)\)/)[1] 
    : errorCode;

  return ERROR_MAP[code] || "An unexpected error occurred. Please try again.";
}
