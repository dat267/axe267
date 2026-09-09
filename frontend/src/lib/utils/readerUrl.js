/**
 * Helpers for the `?book=` URL param and the reader's history lifecycle.
 *
 * The `?book=` param is the single source of truth for "a book is open".
 * Opening a book pushes it onto the history stack; closing navigates back;
 * a stale `?book=` left after a reload is stripped so the page boots to the
 * book listing.
 */

export function getBookParam() {
  return new URLSearchParams(window.location.search).get("book");
}

export function hasBookParam() {
  return !!getBookParam();
}

/**
 * Put the open book's path into the URL as a `?book=` history entry.
 * No-op when a book param is already present.
 */
export function pushBookState(filePath) {
  if (!hasBookParam()) {
    window.history.pushState({ reader: true, book: filePath }, "", `?book=${encodeURIComponent(filePath)}`);
  }
}

/**
 * Navigate back off the open-book history entry. No-op when no book param is
 * present or when the caller opted out of triggering history.
 */
export function popBookState(triggerHistory = true) {
  if (triggerHistory && hasBookParam()) {
    window.history.back();
  }
}

/**
 * Remove the `book` param from the current URL without adding a history
 * entry. Other params are preserved. Returns true if the URL changed.
 */
export function stripBookParam() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("book")) return false;
  params.delete("book");
  const qs = params.toString();
  window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
  return true;
}
