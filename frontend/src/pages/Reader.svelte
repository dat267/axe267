<script>
  import { onMount, tick } from "svelte";
  import { auth, getStorageInstance } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.js";
  import { themeStore } from "../lib/stores/themeStore.svelte.js";
  import { ICONS } from "../lib/utils/icons";
  import {
    SEARCH_CONCURRENCY,
    MAX_UPLOAD_SIZE_MB,
    LS_READER_SESSION,
    LS_READER_SETTINGS,
    LS_LIBRARY_CACHE,
  } from "../lib/utils/constants";
  import { loadBookData } from "../lib/services/bookLoader";
  import { createBookRenderer } from "../lib/services/bookRenderer";
  import ReaderOverlay from "../lib/components/ReaderOverlay.svelte";
  import { ref, getDownloadURL } from "firebase/storage";
  import { listBooks, uploadBook, deleteBook as deleteBookFromStorage, clearBookCache } from "../lib/services/libraryService";
  import { getBookParam, stripBookParam } from "../lib/utils/readerUrl";
  import { saveProgress, loadProgress } from "../lib/services/progressService";
  import Button from "../lib/components/Button.svelte";
  import Modal from "../lib/components/Modal.svelte";
  import Input from "../lib/components/Input.svelte";
  import Icon from "../lib/components/Icon.svelte";

  let storage;
  let readerElement = $state();
  let renderer = $state(null);
  let tracks = $state([]);
  let collections = $state([]);
  let isLoading = $state(true);
  let currentBookName = $state("");

  let isReaderOpen = $state(false);
  let isBookLoading = $state(false);
  let metadata = $state(null);
  let toc = $state([]);
  let progress = $state(0);
  let saveTimeout;
  let selectedCollectionId = $state("all");
  let uploadFile = $state(null);
  let uploadCollection = $state("Books");
  let isUploading = $state(false);
  let newCollectionName = $state("");
  let showUploadModal = $state(window.location.search.includes("upload=1"));
  let uploadError = $state("");

  async function handleUpload(e) {
    e.preventDefault();
    uploadError = "";
    if (!uploadFile) return;
    const col = uploadCollection === "new" ? newCollectionName.trim() : uploadCollection;
    if (!col) return;

    const maxBytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    if (uploadFile.size > maxBytes) {
      uploadError = `File exceeds ${MAX_UPLOAD_SIZE_MB}MB limit`;
      return;
    }

    isUploading = true;
    try {
      const fileName = uploadFile.name;
      if (!fileName.toLowerCase().endsWith(".epub")) {
        uploadError = "Please select a valid EPUB file.";
        isUploading = false;
        return;
      }
      await uploadBook(storage, uploadFile, col);
      uploadFile = null;
      newCollectionName = "";
      uploadCollection = "Books";
      const fileInput = /** @type {HTMLInputElement | null} */ (document.getElementById("epub-file"));
      if (fileInput) fileInput.value = "";
      await loadLibrary();
      history.back();
    } catch (err) {
      uploadError = "Upload failed: " + err.message;
    } finally {
      isUploading = false;
    }
  }
  let fontSize = $state(16);
  let fontFamily = $state("ui-sans-serif, system-ui, sans-serif");
  let lineHeight = $state(1.5);
  let flow = $state("paginated");

  async function loadLibrary() {
    isLoading = true;
    try {
      if (!storage) {
        storage = await getStorageInstance();
      }
      const { collections: newCollections, tracks: newTracks } = await listBooks(storage);
      collections = newCollections;
      tracks = newTracks;
      localStorage.setItem(LS_LIBRARY_CACHE, JSON.stringify({ collections, tracks }));
    } catch (e) {
      console.error("Failed to list bucket:", e);
    } finally {
      isLoading = false;
    }
  }

  function applyTypography() {
    if (!renderer?.rendition) return;
    fontSize = Math.min(96, Math.max(8, Number(fontSize) || 16));
    lineHeight = Math.min(3.0, Math.max(1.0, Number(lineHeight) || 1.5));
    renderer.applyTypography({
      fontSize,
      fontFamily,
      lineHeight,
      isDarkMode: themeStore.darkMode,
    });
    localStorage.setItem(LS_READER_SETTINGS, JSON.stringify({ fontSize, fontFamily, lineHeight, flow }));
  }

  $effect(() => { if (themeStore.darkMode !== undefined) applyTypography(); });
  function attachRenditionEvents(bookTitle) {
    if (!renderer?.rendition) return;
    renderer.onProgress(({ cfi, percent }) => {
      progress = percent;
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        if (auth.currentUser) {
          await saveProgress(auth.currentUser.uid, bookTitle, cfi);
        }
      }, 3000);
    });
  }
  async function applyFlow() {
    if (!renderer?.book || !renderer?.rendition) return;
    await renderer.switchFlow(flow, {
      fontSize,
      fontFamily,
      lineHeight,
      isDarkMode: themeStore.darkMode,
    });
    attachRenditionEvents(currentBookName);
  }
  async function openBook(title, filePath) {
    currentBookName = title;
    isReaderOpen = true;
    isBookLoading = true;
    progress = 0;
    let url = "";
    try {
      const fileRef = ref(storage, filePath);
      url = await getDownloadURL(fileRef);
    } catch (ue) {
      console.warn("Failed to get download URL:", ue);
    }
    localStorage.setItem(LS_READER_SESSION, JSON.stringify({ name: title, url, filePath }));
    if (!getBookParam()) {
      history.pushState({ reader: true, book: filePath }, "", `?book=${encodeURIComponent(filePath)}`);
    }
    await tick();
    let bookData;
    try {
      bookData = await loadBookData(filePath, url);
    } catch (e) {
      console.error("Failed to load book data:", e);
      isBookLoading = false;
      return;
    }

    let savedCfi = null;
    try {
      if (auth.currentUser) {
        savedCfi = await loadProgress(auth.currentUser.uid, title);
      }

      // Create renderer and render the book (renderer owns ePub creation,
      // readiness, rendition, and display).
      renderer = createBookRenderer(readerElement, {
        flow,
        isDarkMode: themeStore.darkMode,
      });

      renderer.onMetadata((m) => { metadata = m; });
      renderer.onToc((items) => { toc = items; });

      await renderer.render(bookData, savedCfi);
    } catch (e) {
      console.warn("Initial display failed:", e);
      try {
        if (renderer?.rendition) await renderer.rendition.display();
      } catch (e2) {
        console.error("Fallback display failed:", e2);
      }
    } finally {
      isBookLoading = false;
    }

    applyTypography();

    renderer.generateLocations(title);

    attachRenditionEvents(title);
  }

  function next() { renderer?.next(); }
  function prev() { renderer?.prev(); }
  
  function closeReader(triggerHistory = true) {
    isReaderOpen = false;
    localStorage.removeItem(LS_READER_SESSION);
    if (triggerHistory && getBookParam()) {
      history.back();
    }
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
  }

  async function performSearch(query) {
    if (!renderer?.book) return [];
    return renderer.search(query, SEARCH_CONCURRENCY);
  }

  async function jumpTo(target) {
    if (!renderer) return;
    await renderer.jumpTo(target);
  }

  let isDeleting = $state(false);

  async function deleteBook(bookItem) {
    if (!authStore.isAdmin || !confirm(`Permanently delete ${bookItem.title}?`)) return;
    if (isDeleting) return;
    isDeleting = true;
    try {
      await deleteBookFromStorage(storage, bookItem.filePath);
      await clearBookCache(bookItem.filePath, bookItem.title);
      await loadLibrary();
      if (currentBookName === bookItem.title) closeReader();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      isDeleting = false;
    }
  }

  onMount(() => {
    (async () => {
      // Initialize storage first (needed by both openBook and loadLibrary).
      try {
        storage = await getStorageInstance();
      } catch (err) {
        console.error("Failed to load Firebase storage module:", err);
      }

      // A `?book=` param in the URL at boot is a stale remnant of a previous
      // session (e.g. a reload). Books open only via the list; strip the param
      // and show the book listing.
      stripBookParam();

      // Load library in background (for the book list view).
      const cachedLib = localStorage.getItem(LS_LIBRARY_CACHE);
      if (cachedLib) {
        try {
          const parsed = JSON.parse(cachedLib);
          collections = parsed.collections || [];
          tracks = parsed.tracks || [];
          isLoading = false;
        } catch (ce) {
          console.warn("Failed to parse library cache:", ce);
        }
      }
      await loadLibrary();

      const savedSettings = localStorage.getItem(LS_READER_SETTINGS);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        fontSize = Math.min(96, Math.max(8, parsed.fontSize || 16));
        fontFamily = parsed.fontFamily || "ui-sans-serif, system-ui, sans-serif";
        lineHeight = Math.min(3.0, Math.max(1.0, parsed.lineHeight || 1.5));
        flow = parsed.flow || "paginated";
      }
    })();

    const handlePopState = () => {
      showUploadModal = window.location.search.includes("upload=1");
      const hasBook = !!getBookParam();
      if (isReaderOpen && !hasBook) closeReader(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => { renderer?.destroy(); window.removeEventListener("popstate", handlePopState); };
  });

  const filteredTracks = $derived(
    selectedCollectionId === "all" ? tracks : tracks.filter(t => t.collectionId === selectedCollectionId)
  );
</script>

<div class="flex flex-1 flex-col" class:hidden={isReaderOpen}>
  <div class="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight lowercase">reader</h1>
      <div class="flex items-center gap-4 sm:hidden">
        <button onclick={loadLibrary} disabled={isLoading} class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 disabled:opacity-30 transition-none cursor-pointer">
          {isLoading ? '...' : 'refresh'}
        </button>
        {#if authStore.isAdmin}
          <button onclick={() => { history.pushState(null, "", "?upload=1"); showUploadModal = true; }} class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 transition-none cursor-pointer">
            upload
          </button>
        {/if}
      </div>
    </div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      {#if collections.length > 0}
        <div class="chip-group overflow-x-auto max-w-full">
          <button onclick={() => (selectedCollectionId = "all")} class="chip {selectedCollectionId === 'all' ? 'active' : 'inactive'} whitespace-nowrap">
            all
          </button>
          {#each collections as col (col.id)}
            <button onclick={() => (selectedCollectionId = col.id)} class="chip {selectedCollectionId === col.id ? 'active' : 'inactive'} whitespace-nowrap">
              {col.name}
            </button>
          {/each}
        </div>
      {/if}
      <button onclick={loadLibrary} disabled={isLoading} class="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 disabled:opacity-30 transition-none cursor-pointer">
        {isLoading ? '...' : 'refresh'}
      </button>
      {#if authStore.isAdmin}
        <button onclick={() => { history.pushState(null, "", "?upload=1"); showUploadModal = true; }} class="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 transition-none cursor-pointer">
          upload
        </button>
      {/if}
    </div>
  </div>
  {#if authStore.isAdmin}
    <Modal show={showUploadModal} title="upload epub book" onClose={() => history.back()} showFooter={false}>
      <form onsubmit={handleUpload} class="flex flex-col gap-6">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1" for="epub-file">select file</label>
          <input 
            type="file" 
            id="epub-file" 
            accept=".epub" 
            onchange={(e) => { const input = /** @type {HTMLInputElement} */ (e.target); const files = input?.files; if (files && files.length > 0) uploadFile = files[0]; }} 
            class="block w-full border-b border-border bg-transparent py-3 text-sm outline-none focus:border-foreground text-foreground cursor-pointer" 
            required 
          />
        </div>
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1" for="collection-select">collection</label>
          <select 
            id="collection-select" 
            bind:value={uploadCollection} 
            class="block w-full border-b border-border bg-transparent py-3 text-sm outline-none focus:border-foreground text-foreground cursor-pointer"
          >
            <option value="Books" class="bg-background">Books (Root)</option>
            {#each collections as col (col.id)}
              {#if col.id !== 'Books'}
                <option value={col.id} class="bg-background">{col.name}</option>
              {/if}
            {/each}
            <option value="new" class="bg-background">+ New Collection...</option>
          </select>
        </div>
        {#if uploadCollection === 'new'}
          <Input
            id="new-col-input"
            label="new collection name"
            bind:value={newCollectionName}
            placeholder="Collection name..."
            required
          />
        {/if}
        {#if uploadError}
          <div class="rounded-md bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-500">{uploadError}</div>
        {/if}
        <Button 
          type="submit" 
          disabled={!uploadFile} 
          loading={isUploading} 
          className="w-full mt-2"
        >
          upload
        </Button>
      </form>
    </Modal>
  {/if}
  <div class="space-y-1">
    {#if isLoading && tracks.length === 0}
      <div class="py-20 text-center"><span class="text-sm font-bold uppercase tracking-widest text-gray-500/50">syncing bucket...</span></div>
    {:else if filteredTracks.length === 0}
      <div class="py-20 text-center"><span class="text-sm font-bold uppercase tracking-widest text-gray-500/50">no books found</span></div>
    {:else}
      {#each filteredTracks as bookItem (bookItem.filePath)}
        <div class="group flex h-20 w-full items-center gap-4 border-b border-border px-1 transition-none hover:bg-foreground/5">
          <button 
            onclick={() => openBook(bookItem.title, bookItem.filePath)} 
            class="flex flex-1 items-center gap-4 text-left overflow-hidden h-full cursor-pointer"
          >
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground group-hover:bg-foreground group-hover:text-background group-hover:border-foreground transition-none">
              <Icon svg={ICONS.BOOK} size={20} />
            </div>
            <div class="flex flex-col overflow-hidden">
              <span class="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-foreground transition-none truncate">{bookItem.title}</span>
              <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400/60 truncate mt-0.5">{bookItem.collectionId}</span>
            </div>
          </button>

          {#if authStore.isAdmin}
            <button 
              onclick={() => deleteBook(bookItem)} 
              class="icon-btn muted shrink-0"
              aria-label="Delete book"
            >
              <Icon svg={ICONS.DELETE} size={18} />
            </button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Reader Overlay -->
  {#if isReaderOpen}
    <ReaderOverlay
      {renderer}
      {metadata}
      {progress}
      {toc}
      {currentBookName}
      {flow}
      {fontSize}
      {fontFamily}
      {lineHeight}
      {isBookLoading}
      isDarkMode={themeStore.darkMode}
      themeMode={themeStore.mode}
      onClose={closeReader}
      onNext={next}
      onPrev={prev}
      onJumpTo={jumpTo}
      onSearch={performSearch}
      onApplyTypography={({ fontSize: fs, fontFamily: ff, lineHeight: lh }) => {
        fontSize = fs;
        fontFamily = ff;
        lineHeight = lh;
        applyTypography();
      }}
      onSwitchFlow={(newFlow) => {
        flow = newFlow;
        applyFlow();
      }}
      onThemeCycle={() => themeStore.cycleTheme()}
      onReaderElement={(el) => { readerElement = el; }}
    />
  {/if}
</div>
<svelte:body class:overflow-hidden={isReaderOpen} />
