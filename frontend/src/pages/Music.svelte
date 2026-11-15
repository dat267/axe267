<script lang="ts">
  import { onMount } from "svelte";
  import { getStorageInstance } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.ts";
  import { ICONS } from "../lib/utils/icons";
  import { playerStore } from "../lib/stores/playerStore.svelte.ts";
  import { MAX_UPLOAD_SIZE_MB } from "../lib/utils/constants";
  import {
    AUDIO_ACCEPT,
    isAudioFileName,
    listTracks,
    uploadTrack,
    deleteTrack as deleteTrackFromStorage,
    type MusicTrack,
  } from "../lib/services/musicService";
  import Button from "../lib/components/Button.svelte";
  import Modal from "../lib/components/Modal.svelte";
  import Icon from "../lib/components/Icon.svelte";
  import type { FirebaseStorage } from "firebase/storage";

  let storage: FirebaseStorage | undefined;
  let tracks = $state<MusicTrack[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");

  const currentPath = $derived(playerStore.current?.filePath ?? null);

  // Upload state.
  let showUploadModal = $state(false);
  let uploadFiles = $state<File[]>([]);
  let isUploading = $state(false);
  let uploadProgress = $state("");
  let uploadError = $state("");
  let fileInput = $state<HTMLInputElement>();

  let isDeleting = $state(false);

  async function loadLibrary() {
    isLoading = true;
    loadError = "";
    try {
      if (!storage) storage = await getStorageInstance();
      tracks = await listTracks(storage);
      playerStore.syncQueue(tracks);
    } catch (e) {
      console.error("Failed to list music:", e);
      loadError = "failed to load library";
    } finally {
      isLoading = false;
    }
  }

  function playTrack(track: MusicTrack) {
    void playerStore.play(track, tracks);
  }

  onMount(() => {
    void loadLibrary();
  });

  function openUploadModal() {
    uploadFiles = [];
    uploadError = "";
    uploadProgress = "";
    showUploadModal = true;
  }

  function closeUploadModal() {
    if (isUploading) return;
    showUploadModal = false;
  }

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    uploadFiles = Array.from(input.files ?? []);
    uploadError = "";
  }

  async function handleUpload(e: SubmitEvent) {
    e.preventDefault();
    if (uploadFiles.length === 0) return;
    uploadError = "";

    const maxBytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    const unsupported = uploadFiles.filter((f) => !isAudioFileName(f.name));
    if (unsupported.length > 0) {
      uploadError = `Unsupported format: ${unsupported.map((f) => f.name).join(", ")}`;
      return;
    }
    const oversized = uploadFiles.filter((f) => f.size >= maxBytes);
    if (oversized.length > 0) {
      uploadError = `Exceeds ${MAX_UPLOAD_SIZE_MB}MB limit: ${oversized.map((f) => f.name).join(", ")}`;
      return;
    }

    const storageInstance = storage;
    if (!storageInstance) {
      uploadError = "Storage is unavailable. Refresh and try again.";
      return;
    }

    isUploading = true;
    const failed: string[] = [];
    try {
      for (const [i, file] of uploadFiles.entries()) {
        uploadProgress = `${i + 1}/${uploadFiles.length}`;
        try {
          await uploadTrack(storageInstance, file);
          // Re-uploading a name replaces the object; drop any stale URL.
          playerStore.invalidate(`music/${file.name}`);
        } catch (err) {
          console.error("Upload failed:", file.name, err);
          failed.push(file.name);
        }
      }
      await loadLibrary();
    } finally {
      isUploading = false;
      uploadProgress = "";
    }

    if (failed.length > 0) {
      uploadFiles = uploadFiles.filter((f) => failed.includes(f.name));
      uploadError = `Upload failed: ${failed.join(", ")}`;
      return;
    }
    uploadFiles = [];
    if (fileInput) fileInput.value = "";
    showUploadModal = false;
  }

  async function deleteTrack(track: MusicTrack) {
    if (!authStore.isAdmin || isDeleting) return;
    if (!confirm(`Permanently delete ${track.title}?`)) return;
    if (!storage) return;
    isDeleting = true;
    try {
      await deleteTrackFromStorage(storage, track.filePath);
      playerStore.invalidate(track.filePath);
      if (track.filePath === currentPath) playerStore.stop();
      await loadLibrary();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      isDeleting = false;
    }
  }
</script>

<div class="flex flex-1 flex-col">
  <div class="mb-8 flex items-center justify-between gap-4">
    <h1 class="text-2xl font-bold tracking-tight lowercase">music</h1>
    <div class="flex items-center gap-6">
      <button
        onclick={loadLibrary}
        disabled={isLoading}
        class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 disabled:opacity-30 transition-none cursor-pointer"
      >
        {isLoading ? "..." : "refresh"}
      </button>
      {#if authStore.isAdmin}
        <button
          onclick={openUploadModal}
          class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 transition-none cursor-pointer"
        >
          upload
        </button>
      {/if}
    </div>
  </div>

  {#if authStore.isAdmin}
    <Modal show={showUploadModal} title="upload music" onClose={closeUploadModal} showFooter={false}>
      <form onsubmit={handleUpload} class="flex flex-col gap-6">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1" for="music-files"
            >select files</label
          >
          <input
            bind:this={fileInput}
            type="file"
            id="music-files"
            accept={AUDIO_ACCEPT}
            multiple
            onchange={handleFileChange}
            disabled={isUploading}
            class="block w-full border-b border-border bg-transparent py-3 text-sm outline-none focus:border-foreground text-foreground cursor-pointer"
          />
          <p class="mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500/70">
            mp3, m4a, aac, ogg, opus, wav, flac &bull; up to {MAX_UPLOAD_SIZE_MB}MB each
          </p>
        </div>
        {#if uploadError}
          <div class="rounded-md bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-500">{uploadError}</div>
        {/if}
        <Button type="submit" disabled={uploadFiles.length === 0} loading={isUploading} className="w-full mt-2">
          {#if isUploading}
            uploading {uploadProgress}
          {:else}
            upload{uploadFiles.length > 1 ? ` ${uploadFiles.length} files` : ""}
          {/if}
        </Button>
      </form>
    </Modal>
  {/if}

  <div class="border-border" class:border-t={tracks.length > 0}>
    {#if isLoading && tracks.length === 0}
      <div class="py-20 text-center">
        <span class="text-sm font-bold uppercase tracking-widest text-gray-500/50">syncing bucket...</span>
      </div>
    {:else if loadError && tracks.length === 0}
      <div class="py-20 text-center">
        <span class="text-sm font-bold uppercase tracking-widest text-rose-500/70">{loadError}</span>
      </div>
    {:else if tracks.length === 0}
      <div class="py-20 text-center">
        <span class="text-sm font-bold uppercase tracking-widest text-gray-500/50">no tracks yet</span>
      </div>
    {:else}
      {#each tracks as track (track.filePath)}
        {@const isCurrent = track.filePath === currentPath}
        {@const isPlayingThis = isCurrent && !playerStore.paused}
        <div class="group flex h-20 w-full items-center gap-4 border-b border-border px-1 transition-none hover:bg-foreground/5">
          <button
            onclick={() => playTrack(track)}
            class="flex flex-1 items-center gap-4 text-left overflow-hidden h-full cursor-pointer"
            aria-label={isPlayingThis ? `Pause ${track.title}` : `Play ${track.title}`}
            aria-current={isCurrent ? "true" : undefined}
          >
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border transition-none {isCurrent
                ? 'border-foreground bg-foreground text-background'
                : 'border-border bg-surface text-foreground group-hover:bg-foreground group-hover:text-background group-hover:border-foreground'}"
            >
              {#if isPlayingThis}
                <Icon svg={ICONS.PAUSE} size={18} />
              {:else if isCurrent}
                <Icon svg={ICONS.PLAY} size={18} />
              {:else}
                <span class="group-hover:hidden"><Icon svg={ICONS.MUSIC} size={20} /></span>
                <span class="hidden group-hover:inline"><Icon svg={ICONS.PLAY} size={18} /></span>
              {/if}
            </div>
            <div class="flex flex-col overflow-hidden">
              <span
                class="line-clamp-2 break-words text-xs font-bold uppercase tracking-widest transition-none {isCurrent
                  ? 'text-foreground'
                  : 'text-gray-500 group-hover:text-foreground'}">{track.title}</span
              >
              <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400/60 truncate mt-0.5"
                >{track.fileName.split(".").pop()}</span
              >
            </div>
          </button>
          {#if authStore.isAdmin}
            <button
              onclick={() => deleteTrack(track)}
              disabled={isDeleting}
              class="icon-btn muted shrink-0"
              aria-label="Delete {track.title}"
            >
              <Icon svg={ICONS.DELETE} size={18} />
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
