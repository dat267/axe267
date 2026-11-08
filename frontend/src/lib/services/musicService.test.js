import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("firebase/storage", () => ({
  ref: vi.fn((_s, p) => ({ fullPath: p, name: p.split("/").pop() })),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

import { ref, listAll, deleteObject, uploadBytes, getDownloadURL } from "firebase/storage";
import { audioContentType, deleteTrack, getTrackUrl, isAudioFileName, listTracks, uploadTrack } from "./musicService";

const storage = {};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isAudioFileName", () => {
  it.each(["a.mp3", "b.M4A", "c.flac", "d.opus", "e.wav", "f.ogg"])("accepts %s", (name) => {
    expect(isAudioFileName(name)).toBe(true);
  });

  it.each(["a.epub", "b.mp4", "noext", "mp3", "c.mp3.exe"])("rejects %s", (name) => {
    expect(isAudioFileName(name)).toBe(false);
  });
});

describe("audioContentType", () => {
  it("keeps a reported audio type", () => {
    expect(audioContentType(new File([""], "a.mp3", { type: "audio/mpeg" }))).toBe("audio/mpeg");
  });

  it("falls back to the extension when the browser reports no audio type", () => {
    expect(audioContentType(new File([""], "a.flac", { type: "" }))).toBe("audio/flac");
    expect(audioContentType(new File([""], "a.m4a", { type: "application/octet-stream" }))).toBe("audio/mp4");
  });
});

describe("listTracks", () => {
  it("returns audio files under music/ sorted naturally and skips other files", async () => {
    listAll.mockResolvedValue({
      prefixes: [],
      items: [
        { name: "Track 10.mp3", fullPath: "music/Track 10.mp3" },
        { name: "cover.jpg", fullPath: "music/cover.jpg" },
        { name: "Track 2.flac", fullPath: "music/Track 2.flac" },
      ],
    });

    const tracks = await listTracks(storage);

    expect(ref).toHaveBeenCalledWith(storage, "music");
    expect(tracks).toEqual([
      { id: "music/Track 2.flac", title: "Track 2", fileName: "Track 2.flac", filePath: "music/Track 2.flac" },
      { id: "music/Track 10.mp3", title: "Track 10", fileName: "Track 10.mp3", filePath: "music/Track 10.mp3" },
    ]);
  });
});

describe("uploadTrack", () => {
  it("uploads to music/<name> with an audio content type", async () => {
    const file = new File(["x"], "song.flac", { type: "" });
    await uploadTrack(storage, file);
    expect(uploadBytes).toHaveBeenCalledWith({ fullPath: "music/song.flac", name: "song.flac" }, file, {
      contentType: "audio/flac",
    });
  });

  it("rejects non-audio files", async () => {
    await expect(uploadTrack(storage, new File(["x"], "book.epub"))).rejects.toThrow(/Unsupported/);
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});

describe("deleteTrack / getTrackUrl", () => {
  it("deletes the object at the given path", async () => {
    await deleteTrack(storage, "music/a.mp3");
    expect(deleteObject).toHaveBeenCalledWith({ fullPath: "music/a.mp3", name: "a.mp3" });
  });

  it("resolves the download URL", async () => {
    getDownloadURL.mockResolvedValue("https://example.test/a.mp3");
    await expect(getTrackUrl(storage, "music/a.mp3")).resolves.toBe("https://example.test/a.mp3");
  });
});
