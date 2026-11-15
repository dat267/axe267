import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import type { ListResult } from "firebase/storage";

vi.mock("../lib/services/firebase", () => ({
  getStorageInstance: vi.fn(async () => ({})),
}));
vi.mock("../lib/stores/authStore.svelte.ts", () => ({
  authStore: { isAdmin: true },
}));
vi.mock("firebase/storage", () => ({
  ref: vi.fn((_storage, p) => ({ fullPath: p, name: p.split("/").pop() })),
  listAll: vi.fn(),
  getDownloadURL: vi.fn(async (r) => `https://example.test/${encodeURIComponent(r.fullPath)}`),
  deleteObject: vi.fn(),
  uploadBytes: vi.fn(),
}));

import { listAll, uploadBytes } from "firebase/storage";
import Music from "./Music.svelte";
import PlayerBar from "../lib/components/PlayerBar.svelte";
import { playerStore } from "../lib/stores/playerStore.svelte.ts";

const TRACKS = [
  { name: "Alpha.mp3", fullPath: "music/Alpha.mp3" },
  { name: "Beta.flac", fullPath: "music/Beta.flac" },
];

const listAllMock = vi.mocked(listAll);
const uploadBytesMock = vi.mocked(uploadBytes);

let playSpy: MockInstance<() => Promise<void>>;
let pauseSpy: MockInstance<() => void>;
const capturedAudio: HTMLMediaElement[] = [];

function currentAudio(): HTMLMediaElement {
  const element = capturedAudio.at(-1);
  if (!element) throw new Error("audio element was not created");
  return element;
}

beforeEach(() => {
  capturedAudio.length = 0;
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  listAllMock.mockResolvedValue({ prefixes: [], items: TRACKS } as unknown as ListResult);
  // jsdom does not implement media playback; emulate the element's paused flag
  // and capture the store's detached <audio> element.
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    capturedAudio.push(this);
    Object.defineProperty(this, "paused", { value: false, configurable: true });
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    Object.defineProperty(this, "paused", { value: true, configurable: true });
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  playerStore.stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  capturedAudio.length = 0;
});

it("plays the selected track and marks it as playing in the list", async () => {
  const user = userEvent.setup();
  render(Music);

  await user.click(await screen.findByRole("button", { name: "Play Beta" }));

  await waitFor(() => expect(playSpy).toHaveBeenCalled());
  expect(currentAudio().src).toBe(`https://example.test/${encodeURIComponent("music/Beta.flac")}`);
  expect(playerStore.current?.title).toBe("Beta");
  expect(await screen.findByRole("button", { name: "Pause Beta" })).toHaveAttribute("aria-current", "true");
});

it("keeps playing after leaving the music page", async () => {
  const user = userEvent.setup();
  const { unmount } = render(Music);
  await user.click(await screen.findByRole("button", { name: "Play Alpha" }));
  await waitFor(() => expect(playerStore.paused).toBe(false));

  unmount();

  expect(pauseSpy).not.toHaveBeenCalled();
  expect(playerStore.current?.title).toBe("Alpha");
  expect(playerStore.paused).toBe(false);
});

it("shows the playing track again when returning to the page", async () => {
  const user = userEvent.setup();
  const first = render(Music);
  await user.click(await screen.findByRole("button", { name: "Play Alpha" }));
  await waitFor(() => expect(playerStore.paused).toBe(false));
  first.unmount();

  render(Music);

  expect(await screen.findByRole("button", { name: "Pause Alpha" })).toBeInTheDocument();
});

it("advances to the next track when one ends, even off the page", async () => {
  const user = userEvent.setup();
  const { unmount } = render(Music);
  await user.click(await screen.findByRole("button", { name: "Play Alpha" }));
  await waitFor(() => expect(currentAudio().src).toContain(encodeURIComponent("music/Alpha.mp3")));
  unmount();

  currentAudio().dispatchEvent(new Event("ended"));

  await waitFor(() => expect(currentAudio().src).toContain(encodeURIComponent("music/Beta.flac")));
  expect(playerStore.current?.title).toBe("Beta");
});

it("player bar controls the shared playback", async () => {
  const user = userEvent.setup();
  render(Music);
  await user.click(await screen.findByRole("button", { name: "Play Alpha" }));
  await waitFor(() => expect(playerStore.paused).toBe(false));

  render(PlayerBar);
  const bar = screen.getByRole("region", { name: "Player" });
  expect(bar).toHaveTextContent("Alpha");

  await user.click(screen.getByRole("button", { name: "Pause" }));
  expect(playerStore.paused).toBe(true);
  await user.click(screen.getByRole("button", { name: "Next track" }));
  await waitFor(() => expect(bar).toHaveTextContent("Beta"));
});

it("player bar toggles shuffle and cycles loop modes", async () => {
  const user = userEvent.setup();
  render(Music);
  await user.click(await screen.findByRole("button", { name: "Play Alpha" }));
  render(PlayerBar);

  const shuffle = screen.getByRole("button", { name: "Shuffle" });
  expect(shuffle).toHaveAttribute("aria-pressed", "false");
  await user.click(shuffle);
  expect(shuffle).toHaveAttribute("aria-pressed", "true");
  expect(playerStore.shuffle).toBe(true);
  await user.click(shuffle);

  await user.click(screen.getByRole("button", { name: "Loop: off" }));
  await user.click(screen.getByRole("button", { name: "Loop: all" }));
  expect(screen.getByRole("button", { name: "Loop: one" })).toBeInTheDocument();
  expect(playerStore.loop).toBe("one");
  await user.click(screen.getByRole("button", { name: "Loop: one" }));
});

it("uploads several audio files and refreshes the list", async () => {
  const user = userEvent.setup();
  render(Music);
  await screen.findByRole("button", { name: "Play Alpha" });

  await user.click(screen.getByRole("button", { name: "upload" }));
  const files = [new File(["a"], "Gamma.mp3", { type: "audio/mpeg" }), new File(["b"], "Delta.flac", { type: "" })];
  listAllMock.mockResolvedValue({
    prefixes: [],
    items: [...TRACKS, ...files.map((f) => ({ name: f.name, fullPath: `music/${f.name}` }))],
  } as unknown as ListResult);
  await user.upload(screen.getByLabelText("select files"), files);
  await user.click(screen.getByRole("button", { name: /upload 2 files/ }));

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(uploadBytesMock).toHaveBeenCalledTimes(2);
  expect(uploadBytesMock).toHaveBeenCalledWith(expect.objectContaining({ fullPath: "music/Delta.flac" }), files[1], {
    contentType: "audio/flac",
  });
  expect(screen.getByRole("button", { name: "Play Gamma" })).toBeInTheDocument();
});
