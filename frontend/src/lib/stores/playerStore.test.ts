import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("../services/firebase", () => ({
  getStorageInstance: vi.fn(async () => ({})),
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage, p) => ({ fullPath: p })),
  getDownloadURL: vi.fn(async (r) => `https://example.test/${encodeURIComponent(r.fullPath)}`),
}));

import { PlayerStore } from "./playerStore.svelte.ts";
import { LS_MUSIC_LOOP, LS_MUSIC_SHUFFLE } from "../utils/constants";

const TRACKS = ["A", "B", "C", "D", "E"].map((t) => ({ title: t, filePath: `music/${t}.mp3` }));
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let storage: Record<string, string>;
const capturedAudio: HTMLMediaElement[] = [];
let playSpy: MockInstance<() => Promise<void>>;

function currentAudio(): HTMLMediaElement {
  const element = capturedAudio.at(-1);
  if (!element) throw new Error("audio element was not created");
  return element;
}

beforeEach(() => {
  storage = {};
  capturedAudio.length = 0;
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((k: string) => storage[k] ?? null),
    setItem: vi.fn((k: string, v: string) => (storage[k] = String(v))),
    removeItem: vi.fn(),
  });
  // jsdom has no media playback; emulate it and capture the store's element.
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    capturedAudio.push(this);
    Object.defineProperty(this, "paused", { value: false, configurable: true });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { value: true, configurable: true });
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  capturedAudio.length = 0;
});

async function endTrack(player: PlayerStore): Promise<string | undefined> {
  currentAudio().dispatchEvent(new Event("ended"));
  await flush();
  return player.current?.title;
}

describe("loop", () => {
  it("cycles off → all → one → off and remembers the choice", () => {
    const player = new PlayerStore();
    expect(player.loop).toBe("off");
    player.cycleLoop();
    expect(player.loop).toBe("all");
    player.cycleLoop();
    expect(player.loop).toBe("one");
    player.cycleLoop();
    expect(player.loop).toBe("off");
    expect(storage[LS_MUSIC_LOOP]).toBe("off");

    storage[LS_MUSIC_LOOP] = "one";
    expect(new PlayerStore().loop).toBe("one");
  });

  it("stops after the last track when loop is off", async () => {
    const player = new PlayerStore();
    await player.play(TRACKS[4], TRACKS);
    currentAudio().dispatchEvent(new Event("ended"));
    await flush();
    expect(player.current?.title).toBe("E");
  });

  it("wraps to the first track at the end when looping all", async () => {
    const player = new PlayerStore();
    player.cycleLoop();
    await player.play(TRACKS[3], TRACKS);
    expect(await endTrack(player)).toBe("E");
    expect(await endTrack(player)).toBe("A");
  });

  it("repeats the current track natively when looping one, but next still advances", async () => {
    const player = new PlayerStore();
    player.cycleLoop();
    player.cycleLoop();
    await player.play(TRACKS[0], TRACKS);
    expect(currentAudio().loop).toBe(true);

    player.next();
    await flush();
    expect(player.current?.title).toBe("B");

    player.cycleLoop();
    expect(currentAudio().loop).toBe(false);
  });

  it("restarts a single track when looping all", async () => {
    const player = new PlayerStore();
    player.cycleLoop();
    await player.play(TRACKS[0], [TRACKS[0]]);
    currentAudio().currentTime = 42;
    playSpy.mockClear();

    await endTrack(player);

    expect(player.current?.title).toBe("A");
    expect(currentAudio().currentTime).toBe(0);
    expect(playSpy).toHaveBeenCalled();
  });
});

describe("shuffle", () => {
  it("plays every track once per pass, starting from the chosen one", async () => {
    const player = new PlayerStore();
    player.toggleShuffle();
    await player.play(TRACKS[2], TRACKS);

    const played = [player.current?.title];
    for (let i = 0; i < TRACKS.length - 1; i++) played.push(await endTrack(player));

    expect(played[0]).toBe("C");
    expect([...played].sort()).toEqual(["A", "B", "C", "D", "E"]);
    // Loop is off: the pass ends on its last track.
    expect(await endTrack(player)).toBe(played.at(-1));
  });

  it("previous walks back through the shuffled order", async () => {
    const player = new PlayerStore();
    player.toggleShuffle();
    await player.play(TRACKS[0], TRACKS);
    player.next();
    await flush();
    const second = player.current?.title;
    player.next();
    await flush();

    player.previous();
    await flush();
    expect(player.current?.title).toBe(second);
  });

  it("reshuffles on wrap with loop all, without repeating the last track", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const player = new PlayerStore();
    player.toggleShuffle();
    player.cycleLoop();
    await player.play(TRACKS[0], TRACKS);
    for (let i = 0; i < TRACKS.length - 1; i++) await endTrack(player);
    const last = player.current?.title;

    const next = await endTrack(player);

    expect(next).not.toBe(last);
  });

  it("turning shuffle off returns to library order from the current track", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const player = new PlayerStore();
    player.toggleShuffle();
    await player.play(TRACKS[1], TRACKS);
    player.toggleShuffle();
    expect(storage[LS_MUSIC_SHUFFLE]).toBe("false");

    player.next();
    await flush();
    expect(player.current?.title).toBe("C");
  });

  it("keeps the shuffled order when the library refreshes and drops deleted tracks", async () => {
    const player = new PlayerStore();
    player.toggleShuffle();
    await player.play(TRACKS[0], TRACKS);
    const remaining = TRACKS.filter((t) => t.title !== "E");
    player.syncQueue(remaining);

    const played = [player.current?.title];
    for (let i = 0; i < remaining.length - 1; i++) played.push(await endTrack(player));
    expect([...played].sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("remembers the shuffle setting", () => {
    new PlayerStore().toggleShuffle();
    expect(storage[LS_MUSIC_SHUFFLE]).toBe("true");
    expect(new PlayerStore().shuffle).toBe(true);
  });
});

describe("errors", () => {
  it("shows the play button after a load error and retries with a fresh URL", async () => {
    const { getDownloadURL } = await import("firebase/storage");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const player = new PlayerStore();
    await player.play(TRACKS[0], TRACKS);
    expect(player.paused).toBe(false);

    // The element keeps paused === false after a failed load (per spec).
    currentAudio().dispatchEvent(new Event("error"));
    expect(player.error).toBeTruthy();
    expect(player.paused).toBe(true);

    vi.mocked(getDownloadURL).mockClear();
    player.toggle();
    await flush();
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
    expect(player.error).toBe("");
    expect(player.paused).toBe(false);
  });
});
