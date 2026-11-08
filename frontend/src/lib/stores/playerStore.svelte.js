import { getStorageInstance } from "../services/firebase";
import { getTrackUrl } from "../services/musicService";
import { LS_MUSIC_LOOP, LS_MUSIC_SHUFFLE, LS_MUSIC_VOLUME } from "../utils/constants";

const PLAY_ERROR = "could not play this track";

/** Loop modes in the order the loop button cycles through them. */
export const LOOP_MODES = ["off", "all", "one"];

function readSaved(key, fallback, isValid) {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null && isValid(raw)) return raw;
  } catch {
    // Storage unavailable (private mode, blocked site data): use the default.
  }
  return fallback;
}

function save(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Non-essential preference; ignore storage failures.
  }
}

/** Fisher-Yates shuffle into a new array. */
function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function readSavedVolume() {
  try {
    const raw = localStorage.getItem(LS_MUSIC_VOLUME);
    const saved = Number(raw);
    if (raw !== null && saved >= 0 && saved <= 1) return saved;
  } catch {
    // Storage unavailable (private mode, blocked site data): use the default.
  }
  return 1;
}

/**
 * App-wide audio player. It owns a single detached `Audio` element, so
 * playback continues while the user navigates between routes; components
 * only read its state and call its methods.
 */
export class PlayerStore {
  #queue = $state([]);
  #current = $state(null);
  #paused = $state(true);
  #currentTime = $state(0);
  #duration = $state(0);
  #volume = $state(readSavedVolume());
  #muted = $state(false);
  #loading = $state(false);
  #error = $state("");
  #shuffle = $state(readSaved(LS_MUSIC_SHUFFLE, "false", (v) => v === "true" || v === "false") === "true");
  #loop = $state(readSaved(LS_MUSIC_LOOP, "off", (v) => LOOP_MODES.includes(v)));
  // Shuffled play order (same tracks as the queue). Only read through
  // #sequence(), so it needs no reactivity.
  #order = [];

  /** @type {HTMLAudioElement | null} */
  #audio = null;
  #playRequest = 0;
  // Download URLs resolved this session; never rendered, so not reactive.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain lookup cache, not UI state
  #urlCache = new Map();

  get queue() {
    return this.#queue;
  }
  /** The loaded track, or null when nothing is loaded. */
  get current() {
    return this.#current;
  }
  get paused() {
    return this.#paused;
  }
  get currentTime() {
    return this.#currentTime;
  }
  get duration() {
    return this.#duration;
  }
  get volume() {
    return this.#volume;
  }
  get muted() {
    return this.#muted;
  }
  get loading() {
    return this.#loading;
  }
  get error() {
    return this.#error;
  }
  get shuffle() {
    return this.#shuffle;
  }
  /** "off" | "all" | "one" */
  get loop() {
    return this.#loop;
  }

  /** The order tracks play in: the queue, or its shuffled order. */
  #sequence() {
    return this.#shuffle ? this.#order : this.#queue;
  }

  #currentIndex() {
    if (!this.#current) return -1;
    return this.#sequence().findIndex((t) => t.filePath === this.#current.filePath);
  }

  /** Reshuffle the queue, starting with `first` when given. */
  #reshuffle(first) {
    if (!first) {
      this.#order = shuffled(this.#queue);
      return;
    }
    const rest = this.#queue.filter((t) => t.filePath !== first.filePath);
    this.#order = [first, ...shuffled(rest)];
  }

  /** Move to `track`, restarting it when it's already loaded (one-track queue). */
  #goTo(track) {
    if (this.#current?.filePath === track.filePath) {
      this.seek(0);
      this.resume();
      return;
    }
    this.play(track);
  }

  #ensureAudio() {
    if (this.#audio) return this.#audio;
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = this.#volume;
    // Loop-one repeats natively, so "ended" never fires in that mode.
    audio.loop = this.#loop === "one";
    audio.addEventListener("play", () => (this.#paused = false));
    audio.addEventListener("pause", () => (this.#paused = true));
    audio.addEventListener("timeupdate", () => (this.#currentTime = audio.currentTime));
    audio.addEventListener("durationchange", () => {
      this.#duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    });
    audio.addEventListener("waiting", () => (this.#loading = true));
    audio.addEventListener("playing", () => (this.#loading = false));
    audio.addEventListener("ended", () => this.#handleEnded());
    audio.addEventListener("error", () => {
      if (!this.#current || !audio.getAttribute("src")) return;
      const { code, message } = audio.error ?? {};
      console.error(`Audio failed to load "${this.#current.filePath}": code ${code}${message ? ` (${message})` : ""}`);
      this.#loading = false;
      // A failed load leaves the element's `paused` false without a "pause"
      // event, but nothing is playing; show the play button.
      this.#paused = true;
      this.#error = PLAY_ERROR;
      // The download URL may have been revoked; resolve a fresh one next time.
      this.#urlCache.delete(this.#current.filePath);
    });
    this.#audio = audio;
    this.#registerMediaSession();
    return audio;
  }

  #registerMediaSession() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const handlers = {
      play: () => this.resume(),
      pause: () => this.pause(),
      previoustrack: () => this.previous(),
      nexttrack: () => this.next(),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }
  }

  #updateMediaMetadata() {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata =
      this.#current && typeof MediaMetadata !== "undefined"
        ? new MediaMetadata({ title: this.#current.title, artist: "axe" })
        : null;
  }

  #handleEnded() {
    // Auto-advance; after the last track, wrap only when looping the list.
    const sequence = this.#sequence();
    const index = this.#currentIndex();
    if (index === -1) return;
    if (index < sequence.length - 1) this.play(sequence[index + 1]);
    else if (this.#loop === "all") this.next();
  }

  /**
   * Play `track`. Passing `queue` replaces the play order (e.g. the library
   * list the track was picked from). Selecting the loaded track toggles it.
   *
   * @param {{ filePath: string, title: string }} track
   * @param {Array<{ filePath: string, title: string }>} [queue]
   */
  async play(track, queue) {
    if (queue) {
      this.#queue = [...queue];
      // Picking a track from a list starts a fresh shuffle from that track.
      if (this.#shuffle && this.#current?.filePath !== track.filePath) this.#reshuffle(track);
    }
    if (this.#current?.filePath === track.filePath) {
      this.toggle();
      return;
    }
    await this.#load(track);
  }

  /** Resolve `track`'s URL and start playing it from the beginning. */
  async #load(track) {
    const audio = this.#ensureAudio();
    const request = ++this.#playRequest;
    this.#current = track;
    this.#error = "";
    this.#loading = true;
    this.#currentTime = 0;
    this.#duration = 0;
    this.#updateMediaMetadata();
    try {
      let url = this.#urlCache.get(track.filePath);
      if (!url) {
        url = await getTrackUrl(await getStorageInstance(), track.filePath);
        this.#urlCache.set(track.filePath, url);
      }
      // A newer selection superseded this one while the URL was resolving.
      if (request !== this.#playRequest) return;
      audio.src = url;
      await audio.play();
    } catch (e) {
      if (request !== this.#playRequest) return;
      // Pausing or switching tracks rejects the pending play(); not an error.
      if (e?.name === "AbortError") return;
      console.error("Playback failed:", e?.name, e?.message);
      this.#paused = true;
      this.#error = PLAY_ERROR;
    } finally {
      if (request === this.#playRequest) this.#loading = false;
    }
  }

  resume() {
    if (!this.#audio || !this.#current) return;
    // After a failed load the element has nothing playable; load it afresh
    // (the error handler already dropped the cached URL).
    if (this.#error) {
      this.#load(this.#current);
      return;
    }
    this.#audio.play().catch((e) => {
      if (e?.name === "AbortError") return;
      console.error("Resume failed:", e?.name, e?.message);
      this.#paused = true;
      this.#error = PLAY_ERROR;
    });
  }

  pause() {
    this.#audio?.pause();
  }

  toggle() {
    if (!this.#audio || !this.#current) return;
    if (this.#paused) this.resume();
    else this.pause();
  }

  next() {
    const sequence = this.#sequence();
    if (sequence.length === 0) return;
    const index = this.#currentIndex();
    if (index !== -1 && index < sequence.length - 1) {
      this.#goTo(sequence[index + 1]);
      return;
    }
    // Past the end: start over. A shuffled list gets a new order each pass,
    // without repeating the track that just played.
    if (this.#shuffle) {
      this.#reshuffle();
      if (this.#order.length > 1 && this.#order[0].filePath === this.#current?.filePath) {
        this.#order.push(this.#order.shift());
      }
    }
    this.#goTo(this.#sequence()[0]);
  }

  previous() {
    if (this.#sequence().length === 0) return;
    // Like most players: restart the current track unless it just began.
    if (this.#audio && this.#current && this.#audio.currentTime > 3) {
      this.seek(0);
      return;
    }
    const sequence = this.#sequence();
    const index = this.#currentIndex();
    this.#goTo(sequence[index <= 0 ? sequence.length - 1 : index - 1]);
  }

  toggleShuffle() {
    this.#shuffle = !this.#shuffle;
    // Shuffle the remaining tracks around the one that's playing.
    if (this.#shuffle) this.#reshuffle(this.#current);
    save(LS_MUSIC_SHUFFLE, this.#shuffle);
  }

  /** Cycle loop mode: off → all → one → off. */
  cycleLoop() {
    this.#loop = LOOP_MODES[(LOOP_MODES.indexOf(this.#loop) + 1) % LOOP_MODES.length];
    if (this.#audio) this.#audio.loop = this.#loop === "one";
    save(LS_MUSIC_LOOP, this.#loop);
  }

  /** @param {number} seconds */
  seek(seconds) {
    if (!this.#audio) return;
    this.#audio.currentTime = seconds;
    this.#currentTime = seconds;
  }

  /** @param {number} value 0..1 */
  setVolume(value) {
    this.#volume = Math.min(1, Math.max(0, value));
    this.#muted = false;
    if (this.#audio) {
      this.#audio.volume = this.#volume;
      this.#audio.muted = false;
    }
    save(LS_MUSIC_VOLUME, this.#volume);
  }

  toggleMute() {
    this.#muted = !this.#muted;
    if (this.#audio) this.#audio.muted = this.#muted;
  }

  /**
   * Keep the play order in step with a refreshed library. If the loaded
   * track no longer exists (deleted), playback stops.
   *
   * @param {Array<{ filePath: string, title: string }>} tracks
   */
  syncQueue(tracks) {
    if (!this.#current) return;
    this.#queue = [...tracks];
    if (this.#shuffle) {
      // Keep the existing shuffled order; new tracks go in shuffled at the end.
      const kept = this.#order.map((old) => tracks.find((t) => t.filePath === old.filePath)).filter(Boolean);
      const added = tracks.filter((t) => !kept.includes(t));
      this.#order = [...kept, ...shuffled(added)];
    }
    if (this.#currentIndex() === -1) this.stop();
  }

  /** Forget a cached URL, e.g. after the object at `filePath` was replaced. */
  invalidate(filePath) {
    this.#urlCache.delete(filePath);
  }

  /** Stop playback and unload the track (e.g. on sign-out). */
  stop() {
    this.#playRequest++;
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.removeAttribute("src");
      this.#audio.load();
    }
    this.#current = null;
    this.#queue = [];
    this.#order = [];
    this.#paused = true;
    this.#currentTime = 0;
    this.#duration = 0;
    this.#loading = false;
    this.#error = "";
    // Download URLs are bearer links; don't keep them past a sign-out.
    this.#urlCache.clear();
    this.#updateMediaMetadata();
  }
}

export const playerStore = new PlayerStore();
