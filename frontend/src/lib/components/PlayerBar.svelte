<script lang="ts">
  import Icon from "./Icon.svelte";
  import { ICONS } from "../utils/icons";
  import { playerStore, type LoopMode } from "../stores/playerStore.svelte.ts";

  // Labels describe the current mode; clicking moves to the next one.
  const LOOP_LABELS: Record<LoopMode, string> = { off: "Loop: off", all: "Loop: all", one: "Loop: one" };

  // While the seek handle is dragged, show the drag position instead of the
  // live playback time, and only seek once on release.
  let scrubbing = $state(false);
  let scrubValue = $state(0);
  const shownTime = $derived(scrubbing ? scrubValue : playerStore.currentTime);
  const duration = $derived(playerStore.duration);

  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  }

  function handleSeekInput(event: Event) {
    scrubbing = true;
    scrubValue = Number((event.currentTarget as HTMLInputElement).value);
  }

  function handleSeekChange(event: Event) {
    playerStore.seek(Number((event.currentTarget as HTMLInputElement).value));
    scrubbing = false;
  }
</script>

{#if playerStore.current}
  <div
    class="shrink-0 border-t border-border bg-background"
    style="padding-bottom: env(safe-area-inset-bottom, 0px)"
    role="region"
    aria-label="Player"
  >
    <div class="player-grid mx-auto w-full max-w-4xl px-4 py-3 md:px-8">
      <div class="min-w-0 [grid-area:info]">
        <p class="truncate text-xs font-bold uppercase tracking-widest text-foreground" title={playerStore.current.title}>
          {playerStore.current.title}
        </p>
        <p
          class="mt-0.5 truncate text-[9px] font-bold uppercase tracking-widest {playerStore.error
            ? 'text-rose-500'
            : 'text-gray-400/60'}"
        >
          {playerStore.error || (playerStore.loading ? "loading..." : playerStore.paused ? "paused" : "playing")}
        </p>
      </div>

      <div class="flex items-center gap-3 [grid-area:seek]">
        <span class="min-w-9 shrink-0 text-[10px] font-bold tabular-nums text-gray-500">{formatTime(shownTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="any"
          value={shownTime}
          oninput={handleSeekInput}
          onchange={handleSeekChange}
          disabled={!duration}
          class="player-range min-w-0 flex-1"
          aria-label="Seek"
          style="--fill: {duration ? (shownTime / duration) * 100 : 0}%"
        />
        <span class="min-w-9 shrink-0 text-right text-[10px] font-bold tabular-nums text-gray-500">{formatTime(duration)}</span>
      </div>

      <div class="player-controls [grid-area:controls]">
        <button
          onclick={() => playerStore.toggleShuffle()}
          class="icon-btn {playerStore.shuffle ? 'icon-active' : 'icon-inactive'}"
          aria-label="Shuffle"
          aria-pressed={playerStore.shuffle}
        >
          <Icon svg={ICONS.SHUFFLE} size={18} />
        </button>
        <button onclick={() => playerStore.previous()} class="icon-btn" aria-label="Previous track">
          <Icon svg={ICONS.SKIP_BACK} size={18} />
        </button>
        <button
          onclick={() => playerStore.toggle()}
          class="icon-btn h-12! w-12! sm:h-10! sm:w-10! bg-foreground! text-background! border-foreground!"
          aria-label={playerStore.paused ? "Play" : "Pause"}
        >
          <Icon svg={playerStore.paused ? ICONS.PLAY : ICONS.PAUSE} size={20} />
        </button>
        <button onclick={() => playerStore.next()} class="icon-btn" aria-label="Next track">
          <Icon svg={ICONS.SKIP_FORWARD} size={18} />
        </button>
        <button
          onclick={() => playerStore.cycleLoop()}
          class="icon-btn {playerStore.loop === 'off' ? 'icon-inactive' : 'icon-active'}"
          aria-label={LOOP_LABELS[playerStore.loop]}
          title={LOOP_LABELS[playerStore.loop]}
        >
          <Icon svg={playerStore.loop === "one" ? ICONS.REPEAT_ONE : ICONS.REPEAT} size={18} />
        </button>
      </div>

      <!-- Phones use hardware volume keys, so the slider is desktop-only. -->
      <div class="player-volume items-center justify-end gap-2 [grid-area:volume]">
        <button
          onclick={() => playerStore.toggleMute()}
          class="icon-btn muted"
          aria-label={playerStore.muted ? "Unmute" : "Mute"}
        >
          <Icon svg={playerStore.muted || playerStore.volume === 0 ? ICONS.VOLUME_MUTE : ICONS.VOLUME} size={18} />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={playerStore.volume}
          oninput={(e) => playerStore.setVolume(Number((e.currentTarget as HTMLInputElement).value))}
          class="player-range w-24"
          aria-label="Volume"
          style="--fill: {playerStore.muted ? 0 : playerStore.volume * 100}%"
        />
      </div>
    </div>
  </div>
{/if}

<style>
  /* Phones: title, then seek, then a full-width row of controls.
     Wider: seek on top, then title | controls | volume. */
  .player-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "info" "seek" "controls";
    gap: 0.625rem;
  }
  .player-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .player-volume {
    display: none;
  }
  @media (min-width: 640px) {
    .player-grid {
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      grid-template-areas: "seek seek seek" "info controls volume";
      align-items: center;
      column-gap: 1.5rem;
      row-gap: 0.5rem;
    }
    .player-controls {
      justify-content: center;
      gap: 0.5rem;
    }
    .player-volume {
      display: flex;
    }
  }
  .player-range {
    appearance: none;
    height: 4px;
    border-radius: 9999px;
    cursor: pointer;
    background: linear-gradient(to right, var(--color-foreground) var(--fill), var(--color-border) var(--fill));
  }
  .player-range:disabled {
    cursor: default;
    opacity: 0.4;
  }
  .player-range::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 9999px;
    background: var(--color-foreground);
  }
  .player-range::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 9999px;
    background: var(--color-foreground);
  }
</style>
