import { ref, listAll, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";

export const MUSIC_ROOT = "music";

/** Audio formats the browser can reasonably play, mapped to a fallback MIME type. */
export const AUDIO_TYPES = {
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

function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isAudioFileName(name) {
  return Object.hasOwn(AUDIO_TYPES, extensionOf(name));
}

/**
 * The content type to store with an upload. Browsers sometimes report an
 * empty or non-audio type (e.g. FLAC on some platforms), and the storage
 * rules only accept `audio/*`, so fall back to the extension's type.
 *
 * @param {File} file
 * @returns {string}
 */
export function audioContentType(file) {
  if (file.type?.startsWith("audio/")) return file.type;
  return AUDIO_TYPES[extensionOf(file.name)] ?? "";
}

/**
 * List all audio tracks stored directly under `music/`.
 *
 * @param {object} storage - Firebase Storage instance
 * @returns {Promise<Array<{ id: string, title: string, fileName: string, filePath: string }>>}
 */
export async function listTracks(storage) {
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
 *
 * @param {object} storage - Firebase Storage instance
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function uploadTrack(storage, file) {
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

/**
 * @param {object} storage - Firebase Storage instance
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function deleteTrack(storage, filePath) {
  await deleteObject(ref(storage, filePath));
}

/**
 * Resolve a streamable URL for a track.
 *
 * @param {object} storage - Firebase Storage instance
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function getTrackUrl(storage, filePath) {
  return getDownloadURL(ref(storage, filePath));
}
