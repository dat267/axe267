<script>
  import { onMount, tick } from "svelte";
  import { auth, db, getStorageInstance } from "../lib/services/firebase";
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
  import { ref, getDownloadURL } from "firebase/storage";
  import { listBooks, uploadBook, deleteBook as deleteBookFromStorage, clearBookCache } from "../lib/services/libraryService";
  import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
  import Button from "../lib/components/Button.svelte";
  import Modal from "../lib/components/Modal.svelte";
  import Input from "../lib/components/Input.svelte";
  import Icon from "../lib/components/Icon.svelte";

  let storage;
  let readerElement = $state();
  let renderer = null;
  let tracks = $state([]);
  let collections = $state([]);
  let isLoading = $state(true);
  let currentBookName = $state("");

  // If URL has ?book=, open reader immediately so template renders the reader
  // overlay instead of flashing the book list.
  const initialBookPath = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("book")
    : null;
  const initialTitle = initialBookPath
    ? decodeURIComponent(initialBookPath).split("/").pop()?.replace(/\.[^/.]+$/, "") || ""
    : "";
  let isReaderOpen = $state(!!initialBookPath);
  let isBookLoading = $state(!!initialBookPath);
  currentBookName = initialTitle;
  let metadata = $state(null);
  let progress = $state(0);
  let saveTimeout;

  // UI State
  let toc = $state([]);
  let showToc = $state(false);
  let showGoTo = $state(false);
  let showSettings = $state(false);
  let gotoSearch = $state("");
  let searchResults = $state([]);
  let isSearching = $state(false);
  let hasSearched = $state(false);
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

  const FONT_OPTIONS = [
    { label: "Sans", value: "ui-sans-serif, system-ui, sans-serif" },
    { label: "Serif", value: "Georgia, serif" },
    { label: "Mono", value: "ui-monospace, monospace" }
  ];

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
          const progressId = `${auth.currentUser.uid}_${bookTitle.replace(/[^a-z0-9]/gi, "_")}`;
          await setDoc(doc(db, "user_progress", progressId), { uid: auth.currentUser.uid, cfi, updatedAt: serverTimestamp() }, { merge: true });
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
    showToc = false;
    showGoTo = false;
    showSettings = false;
    searchResults = [];
    progress = 0;
    let url = "";
    try {
      const fileRef = ref(storage, filePath);
      url = await getDownloadURL(fileRef);
    } catch (ue) {
      console.warn("Failed to get download URL:", ue);
    }
    localStorage.setItem(LS_READER_SESSION, JSON.stringify({ name: title, url, filePath }));
    if (!window.location.search.includes("book=")) {
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
    if (book) {
      book.destroy();
      book = null;
      rendition = null;
    }

    book = ePub(/** @type {any} */ (bookData));
    
    try {
      await book.opened;
      await book.ready;
    } catch (err) {
      console.error("Book loading failed:", err);
      isBookLoading = false;
      return;
    }

    let savedCfi = null;
    try {
      rendition = book.renderTo(readerElement, {
        width: "100%",
        height: "100%",
        flow,
        manager: flow === "scrolled" ? "continuous" : "default",
        spread: flow === "scrolled" ? "none" : "auto"
      });

      if (auth.currentUser) {
        const progressId = `${auth.currentUser.uid}_${title.replace(/[^a-z0-9]/gi, "_")}`;
        const docRef = doc(db, "user_progress", progressId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) savedCfi = docSnap.data().cfi;
      }

      // Create renderer and render the book
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

  async function generateLocations(title) {
    if (!renderer) return;
    await renderer.generateLocations(title);
  }

  function next() { renderer?.next(); }
  function prev() { renderer?.prev(); }
  
  function closeReader(triggerHistory = true) {
    isReaderOpen = false;
    localStorage.removeItem(LS_READER_SESSION);
    if (triggerHistory && window.location.search.includes("book=")) {
      history.back();
    }
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
  }

  async function performSearch() {
    if (!gotoSearch || !renderer?.book) return;
    isSearching = true; hasSearched = true; searchResults = [];
    try {
      const results = await renderer.search(gotoSearch, SEARCH_CONCURRENCY);
      searchResults = results;
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      isSearching = false;
    }
  }

  async function jumpTo(target) {
    if (!renderer) return;
    await renderer.jumpTo(target);
    showToc = false;
    showGoTo = false;
    showSettings = false;
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

      // If a book param is present in the URL, open it immediately.
      // The reader overlay is already rendered (isReaderOpen set at init).
      if (initialBookPath) {
        openBook(initialTitle, decodeURIComponent(initialBookPath));
      }

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
        fontFamily = parsed.fontFamily || FONT_OPTIONS[0].value;
        lineHeight = Math.min(3.0, Math.max(1.0, parsed.lineHeight || 1.5));
        flow = parsed.flow || "paginated";
      }
    })();

    const handlePopState = () => {
      showUploadModal = window.location.search.includes("upload=1");
      const hasBook = window.location.search.includes("book=");
      if (isReaderOpen && !hasBook) closeReader(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => { if (book) book.destroy(); window.removeEventListener("popstate", handlePopState); };
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
    <div class="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[60] flex flex-col bg-background overflow-hidden text-foreground">
      <header class="flex h-16 shrink-0 items-center justify-between border-b border-border p-4 md:px-8 bg-background">
        <div class="flex flex-col overflow-hidden">
          <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate">{metadata?.title || currentBookName}</span>
          {#if progress > 0} <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400/60 mt-0.5">{(progress * 100).toFixed(0)}% read</span> {/if}
        </div>
        <div class="flex items-center gap-2">
          <button onclick={() => themeStore.cycleTheme()} class="icon-btn" aria-label="Cycle theme">
            {#if themeStore.mode === "dark"} <Icon svg={ICONS.MOON} size={20} />
            {:else if themeStore.mode === "light"} <Icon svg={ICONS.SUN} size={20} />
            {:else} <Icon svg={ICONS.MONITOR} size={20} /> {/if}
          </button>
          <button onclick={() => closeReader()} class="icon-btn danger" aria-label="Close reader">
            <Icon svg={ICONS.CLOSE} size={20} />
          </button>
        </div>
      </header>
      <div class="relative flex-1 flex min-h-0 overflow-hidden">
        <div bind:this={readerElement} class="flex-1 h-full mx-auto w-full overflow-hidden {flow === 'paginated' ? 'py-4 md:py-12' : ''} {flow === 'scrolled' ? 'max-w-3xl' : 'max-w-none'}"></div>
        {#if isBookLoading} <div class="absolute inset-0 flex items-center justify-center bg-background/50 z-20"><span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">loading book...</span></div> {/if}
        
        {#if showToc}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">contents</h2>
              <button onclick={() => showToc = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
            </div>
            <div class="flex-1 overflow-y-auto space-y-2">
              {#each toc as item (item.target || item.label)} 
                <button onclick={() => jumpTo(item.target)} style="padding-left: {item.level * 16 + 12}px;" class="w-full text-left text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-foreground hover:bg-foreground/5 rounded-md pr-3 py-2.5 transition-none cursor-pointer border-b border-border/30">
                  {item.label}
                </button>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if showGoTo}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">search</h2>
              <button onclick={() => showGoTo = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
            </div>
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="flex items-end gap-2 mb-6">
                <div class="flex-1">
                  <Input 
                    id="book-search"
                    label="find keyword"
                    bind:value={gotoSearch} 
                    oninput={() => hasSearched = false} 
                    onkeydown={(e) => e.key === "Enter" && performSearch()} 
                    placeholder="Search..." 
                  />
                </div>
                <button onclick={performSearch} disabled={isSearching} class="icon-btn shrink-0">
                  {#if isSearching} <span class="text-[10px] font-bold opacity-70 tracking-widest">...</span>
                  {:else} <Icon svg={ICONS.SEARCH} size={14} /> {/if}
                </button>
              </div>
              <div class="flex-1 overflow-y-auto space-y-3 pr-3">
                {#each searchResults as res (res.cfi)} 
                  <button onclick={() => jumpTo(res.cfi)} class="w-full text-left text-[11px] p-4 border border-border rounded-md hover:bg-foreground/5 transition-none cursor-pointer">
                    <p class="text-gray-500 italic">"...{res.excerpt}..."</p>
                  </button> 
                {/each}
                {#if hasSearched && !isSearching && searchResults.length === 0} 
                  <div class="py-20 text-center"><span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/50">no results found</span></div> 
                {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if showSettings}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none">
            <div class="flex items-center justify-between mb-8">
              <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">settings</h2>
              <button onclick={() => showSettings = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
            </div>
            <div class="space-y-6">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font size (px)</p>
                <div class="flex items-center gap-2">
                  <button onclick={() => { fontSize = Math.max(8, (Number(fontSize) || 16) - 1); applyTypography(); }} class="icon-btn font-bold">-</button>
                  <input type="number" min="8" max="96" bind:value={fontSize} onchange={applyTypography} onblur={applyTypography} class="flex-1 h-10 bg-background border border-border rounded-md text-center text-sm font-mono font-bold outline-none focus:border-foreground text-foreground" />
                  <button onclick={() => { fontSize = Math.min(96, (Number(fontSize) || 16) + 1); applyTypography(); }} class="icon-btn font-bold">+</button>
                </div>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font family</p>
                <div class="grid grid-cols-3 gap-2">
                  {#each FONT_OPTIONS as option (option.value)}
                    <button onclick={() => { fontFamily = option.value; applyTypography(); }} class="chip {fontFamily === option.value ? 'active' : 'inactive'} py-2">{option.label}</button>
                  {/each}
                </div>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">line spacing</p>
                <div class="flex items-center gap-2">
                  <button onclick={() => { lineHeight = Math.max(1.0, parseFloat(((Number(lineHeight) || 1.5) - 0.1).toFixed(1))); applyTypography(); }} class="icon-btn font-bold">-</button>
                  <input type="number" min="1.0" max="3.0" step="0.1" bind:value={lineHeight} onchange={applyTypography} onblur={applyTypography} class="flex-1 h-10 bg-background border border-border rounded-md text-center text-sm font-mono font-bold outline-none focus:border-foreground text-foreground" />
                  <button onclick={() => { lineHeight = Math.min(3.0, parseFloat(((Number(lineHeight) || 1.5) + 0.1).toFixed(1))); applyTypography(); }} class="icon-btn font-bold">+</button>
                </div>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">layout</p>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick={() => { flow = "paginated"; applyFlow(); }} class="chip {flow === 'paginated' ? 'active' : 'inactive'} py-2">pages</button>
                  <button onclick={() => { flow = "scrolled"; applyFlow(); }} class="chip {flow === 'scrolled' ? 'active' : 'inactive'} py-2">scroll</button>
                </div>
              </div>
            </div>
            <div class="mt-auto pt-8 border-t border-border/30">
              <Button variant="secondary" className="w-full" onclick={() => { fontSize = 16; fontFamily = FONT_OPTIONS[0].value; lineHeight = 1.5; flow = "paginated"; applyFlow(); }}>reset defaults</Button>
            </div>
          </div>
        {/if}
      </div>

      <footer class="shrink-0 h-16 flex items-center justify-between border-t border-border bg-background p-4 md:px-8">
        <button onclick={prev} class="icon-btn" aria-label="Prev">
          <Icon svg={ICONS.PREV} size={20} />
        </button>
        <div class="icon-toggle-group">
          <button onclick={() => { showSettings = !showSettings; showGoTo = false; showToc = false; }} class="icon-btn {showSettings ? 'icon-active' : 'icon-inactive'}" aria-label="Typography settings">
            <Icon svg={ICONS.TYPOGRAPHY} size={18} />
          </button>
          <button onclick={() => { showGoTo = !showGoTo; showToc = false; showSettings = false; }} class="icon-btn {showGoTo ? 'icon-active' : 'icon-inactive'}" aria-label="Search book">
            <Icon svg={ICONS.SEARCH} size={18} />
          </button>
          <button onclick={() => { showToc = !showToc; showGoTo = false; showSettings = false; }} class="icon-btn {showToc ? 'icon-active' : 'icon-inactive'}" aria-label="Table of contents">
            <Icon svg={ICONS.TOC} size={18} />
          </button>
        </div>
        <button onclick={next} class="icon-btn" aria-label="Next">
          <Icon svg={ICONS.NEXT} size={20} />
        </button>
      </footer>
    </div>
  {/if}
</div>
<svelte:body class:overflow-hidden={isReaderOpen} />
