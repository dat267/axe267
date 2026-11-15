import { ref, listAll, deleteObject, uploadBytes, getDownloadURL, type FirebaseStorage } from "firebase/storage";

export const MUSIC_ROOT = "music";

/** Audio formats the browser can reasonably play, mapped to a fallback MIME type. */
export const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  wav: "audio/wav",
  flac: "audio/flac",
  weba: "audio/webm",
};

export const AUDIO_ACCEPT = Object.keys(AUDIO_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

export interface MusicTrack {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isAudioFileName(name: string): boolean {
  return Object.hasOwn(AUDIO_TYPES, extensionOf(name));
}

/**
 * The content type to store with an upload. Browsers sometimes report an
 * empty or non-audio type (e.g. FLAC on some platforms), and the storage
 * rules only accept `audio/*`, so fall back to the extension's type.
 */
export function audioContentType(file: File): string {
  if (file.type?.startsWith("audio/")) return file.type;
  return AUDIO_TYPES[extensionOf(file.name)] ?? "";
}

/**
 * List all audio tracks stored directly under `music/`.
 */
export async function listTracks(storage: FirebaseStorage): Promise<MusicTrack[]> {
  const res = await listAll(ref(storage, MUSIC_ROOT));
  return res.items
    .filter((item) => isAudioFileName(item.name))
    .map((item) => ({
      id: item.fullPath,
      title: item.name.replace(/\.[^/.]+$/, ""),
      fileName: item.name,
      filePath: item.fullPath,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
}

/**
 * Upload an audio file to `music/<file name>`.
 */
export async function uploadTrack(storage: FirebaseStorage, file: File): Promise<void> {
  if (!isAudioFileName(file.name)) {
    throw new Error(`Unsupported audio format: ${file.name}`);
  }
  if (file.name.includes("/") || file.name.includes("\\")) {
    throw new Error("Invalid file name");
  }
  await uploadBytes(ref(storage, `${MUSIC_ROOT}/${file.name}`), file, {
    contentType: audioContentType(file),
  });
}

export async function deleteTrack(storage: FirebaseStorage, filePath: string): Promise<void> {
  await deleteObject(ref(storage, filePath));
}

/**
 * Resolve a streamable URL for a track.
 */
export async function getTrackUrl(storage: FirebaseStorage, filePath: string): Promise<string> {
  return getDownloadURL(ref(storage, filePath));
}
