import { ref, listAll, deleteObject, uploadBytes } from "firebase/storage";
import { EPUB_CACHE_NAME } from "../utils/constants";

/**
 * List all EPUB books in Firebase Storage under `books/`.
 *
 * @param {object} storage - Firebase Storage instance
 * @returns {Promise<{ collections: Array<{id: string, name: string}>, tracks: Array<object> }>}
 */
export async function listBooks(storage) {
  const rootRef = ref(storage, "books");
  const res = await listAll(rootRef);

  const folderResults = await Promise.all(
    res.prefixes.map(async (folderRef) => {
      const folderRes = await listAll(folderRef);
      const epubs = folderRes.items.filter((i) => i.name.toLowerCase().endsWith(".epub"));
      return {
        collection: epubs.length > 0 ? { id: folderRef.name, name: folderRef.name } : null,
        tracks: epubs.map((itemRef) => ({
          id: itemRef.fullPath,
          title: itemRef.name.replace(/\.[^/.]+$/, ""),
          fileName: itemRef.name,
          filePath: itemRef.fullPath,
          url: "",
          collectionId: folderRef.name,
        })),
      };
    }),
  );

  const collections = [];
  const tracks = [];

  for (const result of folderResults) {
    if (result.collection) collections.push(result.collection);
    tracks.push(...result.tracks);
  }

  const rootEpubs = res.items.filter((i) => i.name.toLowerCase().endsWith(".epub"));
  if (rootEpubs.length > 0) {
    collections.push({ id: "Books", name: "Books" });
    for (const itemRef of rootEpubs) {
      tracks.push({
        id: itemRef.fullPath,
        title: itemRef.name.replace(/\.[^/.]+$/, ""),
        fileName: itemRef.name,
        filePath: itemRef.fullPath,
        url: "",
        collectionId: "Books",
      });
    }
  }

  tracks.sort((a, b) =>
    a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  return { collections, tracks };
}

/**
 * Upload an EPUB file to Firebase Storage.
 *
 * @param {object} storage - Firebase Storage instance
 * @param {File} file - The EPUB file to upload
 * @param {string} collection - "Books" for root, or a folder name
 * @returns {Promise<void>}
 */
export async function uploadBook(storage, file, collection) {
  const storagePath = collection === "Books" ? `books/${file.name}` : `books/${collection}/${file.name}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file);
}

/**
 * Delete a book from Firebase Storage.
 *
 * @param {object} storage - Firebase Storage instance
 * @param {string} filePath - Storage path of the book (e.g. "books/test.epub")
 * @returns {Promise<void>}
 */
export async function deleteBook(storage, filePath) {
  await deleteObject(ref(storage, filePath));
}

/**
 * Clear cached book data and localStorage locations for a book.
 *
 * @param {string} filePath - Storage path of the book
 * @param {string} title - Book title (for localStorage key)
 * @returns {Promise<void>}
 */
export async function clearBookCache(filePath, title) {
  const canCache = typeof globalThis !== "undefined" && "caches" in globalThis;

  if (canCache) {
    try {
      const prefix = `https://axe-local/${encodeURIComponent(filePath)}`;
      const cache = await caches.open(EPUB_CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        if (req.url.startsWith(prefix)) {
          await cache.delete(req);
        }
      }
    } catch (ce) {
      console.warn("Cache delete failed:", ce);
    }
  }

  try {
    const LS_LOCATIONS_PREFIX = "axe-locations-";
    const storageKey = `${LS_LOCATIONS_PREFIX}${title.replace(/[^a-z0-9]/gi, "_")}`;
    localStorage.removeItem(storageKey);
  } catch (le) {
    console.warn("Failed to remove locations:", le);
  }
}
