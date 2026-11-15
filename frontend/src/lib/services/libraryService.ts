import { ref, listAll, deleteObject, uploadBytes, type FirebaseStorage } from "firebase/storage";
import { EPUB_CACHE_NAME } from "../utils/constants";
import { isCacheEntryForFile, locationsStorageKey } from "../utils/readerKeys";

export interface BookCollection {
  id: string;
  name: string;
}

export interface BookTrack {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  url: string;
  collectionId: string;
}

export interface Library {
  collections: BookCollection[];
  tracks: BookTrack[];
}

/**
 * List all EPUB books in Firebase Storage under `books/`.
 */
export async function listBooks(storage: FirebaseStorage): Promise<Library> {
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

  const collections: BookCollection[] = [];
  const tracks: BookTrack[] = [];

  for (const result of folderResults) {
    if (result.collection) collections.push(result.collection);
    tracks.push(...result.tracks);
  }

  const rootEpubs = res.items.filter((i) => i.name.toLowerCase().endsWith(".epub"));
  if (rootEpubs.length > 0) {
    if (!collections.some((collection) => collection.id === "Books")) {
      collections.push({ id: "Books", name: "Books" });
    }
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
 */
export async function uploadBook(storage: FirebaseStorage, file: File, collection: string): Promise<void> {
  if (
    collection !== "Books" &&
    (!collection || collection.includes("/") || collection.includes("\\") || collection === "." || collection === "..")
  ) {
    throw new Error("Invalid collection name");
  }
  const storagePath = collection === "Books" ? `books/${file.name}` : `books/${collection}/${file.name}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file);
}

/**
 * Delete a book from Firebase Storage.
 */
export async function deleteBook(storage: FirebaseStorage, filePath: string): Promise<void> {
  await deleteObject(ref(storage, filePath));
}

/**
 * Clear cached book data and localStorage locations for a book.
 */
export async function clearBookCache(filePath: string, title: string): Promise<void> {
  const canCache = typeof globalThis !== "undefined" && typeof globalThis.caches !== "undefined";

  if (canCache) {
    try {
      const cache = await caches.open(EPUB_CACHE_NAME);
      const keys = await cache.keys();
      for (const req of keys) {
        if (isCacheEntryForFile(req.url, filePath)) {
          await cache.delete(req);
        }
      }
    } catch (ce) {
      console.warn("Cache delete failed:", ce);
    }
  }

  try {
    localStorage.removeItem(locationsStorageKey(title));
  } catch (le) {
    console.warn("Failed to remove locations:", le);
  }
}
