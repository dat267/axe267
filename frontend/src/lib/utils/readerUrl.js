/**
 * Helpers for the `?book=` URL param on the reader page.
 *
 * The reader only opens a book through user interaction (clicking a list
 * entry). A `?book=` param left in the URL by a previous session — e.g.
 * after a reload — must be ignored and stripped, so the page boots to the
 * book listing and openBook's history bookkeeping stays correct.
 */

export function getBookParam() {
  return new URLSearchParams(window.location.search).get("book");
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
