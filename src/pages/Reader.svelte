<script lang="ts">
  import { onMount, tick } from "svelte";
  import ePub from "epubjs";
  import { auth, storage, db } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.ts";
  import { themeStore } from "../lib/stores/themeStore.svelte.ts";
  import { ICONS } from "../lib/utils/icons";
  import { ref, getDownloadURL, deleteObject, listAll, uploadBytes } from "firebase/storage";
  import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
  import Button from "../lib/components/Button.svelte";
  import Modal from "../lib/components/Modal.svelte";
  import Input from "../lib/components/Input.svelte";

  let readerElement = $state<HTMLElement>();
  let rendition: any;
  let book: any;
  let tracks = $state<any[]>([]);
  let collections = $state<any[]>([]);
  let isLoading = $state(true);
  let currentBookName = $state("");
  let isReaderOpen = $state(false);
  let isBookLoading = $state(false);
  let metadata = $state<any>(null);
  let locations = $state<any>(null);
  let progress = $state(0);
  let saveTimeout: ReturnType<typeof setTimeout>;

  // UI State
  let toc = $state<any[]>([]);
  let showToc = $state(false);
  let showGoTo = $state(false);
  let showSettings = $state(false);
  let gotoSearch = $state("");
  let searchResults = $state<any[]>([]);
  let isSearching = $state(false);
  let hasSearched = $state(false);
  let selectedCollectionId = $state<string>("all");
  let uploadFile = $state<File | null>(null);
  let uploadCollection = $state("Books");
  let isUploading = $state(false);
  let newCollectionName = $state("");
  let showUploadModal = $state(false);
  async function handleUpload(e: Event) {
    e.preventDefault();
    if (!uploadFile) return;
    const col = uploadCollection === "new" ? newCollectionName.trim() : uploadCollection;
    if (!col) return;
    isUploading = true;
    try {
      const fileName = uploadFile.name;
      if (!fileName.toLowerCase().endsWith(".epub")) {
        alert("Please select a valid EPUB file.");
        isUploading = false;
        return;
      }
      const storagePath = col === "Books" ? `books/${fileName}` : `books/${col}/${fileName}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, uploadFile);
      uploadFile = null;
      newCollectionName = "";
      uploadCollection = "Books";
      const fileInput = document.getElementById("epub-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      await loadLibrary();
      showUploadModal = false;
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err as Error).message);
    } finally {
      isUploading = false;
    }
  }
  let fontSize = $state(16);
  let fontFamily = $state("ui-sans-serif, system-ui, sans-serif");
  let lineHeight = $state(1.5);
  let flow = $state<"paginated" | "scrolled">("paginated");

  const FONT_OPTIONS = [
    { label: "Sans", value: "ui-sans-serif, system-ui, sans-serif" },
    { label: "Serif", value: "Georgia, serif" },
    { label: "Mono", value: "ui-monospace, monospace" }
  ];

  async function loadLibrary() {
    isLoading = true;
    try {
      const rootRef = ref(storage, "books");
      const res = await listAll(rootRef);
      const newCollections: any[] = [];
      const newTracks: any[] = [];
      const folderPromises = res.prefixes.map(async (folderRef) => {
        const folderRes = await listAll(folderRef);
        const epubs = folderRes.items.filter(i => i.name.toLowerCase().endsWith('.epub'));
        if (epubs.length > 0) {
          newCollections.push({ id: folderRef.name, name: folderRef.name });
          for (const itemRef of epubs) {
            newTracks.push({
              id: itemRef.fullPath,
              title: itemRef.name.replace(/\.[^/.]+$/, ""),
              fileName: itemRef.name,
              filePath: itemRef.fullPath,
              url: "",
              collectionId: folderRef.name
            });
          }
        }
      });
      await Promise.all(folderPromises);
      const rootEpubs = res.items.filter(i => i.name.toLowerCase().endsWith('.epub'));
      if (rootEpubs.length > 0) {
        newCollections.push({ id: "Books", name: "Books" });
        for (const itemRef of rootEpubs) {
          newTracks.push({
            id: itemRef.fullPath,
            title: itemRef.name.replace(/\.[^/.]+$/, ""),
            fileName: itemRef.name,
            filePath: itemRef.fullPath,
            url: "",
            collectionId: "Books"
          });
        }
      }
      collections = newCollections;
      tracks = newTracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
      localStorage.setItem("axe_library_cache", JSON.stringify({ collections, tracks }));
    } catch (e) {
      console.error("Failed to list bucket:", e);
    } finally {
      isLoading = false;
    }
  }

  function applyTypography() {
    if (!rendition) return;
    fontSize = Math.min(96, Math.max(8, Number(fontSize) || 16));
    lineHeight = Math.min(3.0, Math.max(1.0, Number(lineHeight) || 1.5));
    rendition.themes.register("custom", {
      "html": { "background": "transparent !important" },
      "body": { "color": themeStore.darkMode ? "#e5e7eb" : "#111827", "background": "transparent !important" },
      "p, div, span, section, li": {
        "font-family": `${fontFamily} !important`,
        "line-height": `${lineHeight} !important`,
        "font-size": `${fontSize}px !important`,
        "color": "inherit !important"
      }
    });
    rendition.themes.select("custom");
    rendition.themes.font(fontFamily);
    rendition.themes.fontSize(`${fontSize}px`);
    localStorage.setItem("axe_reader_settings", JSON.stringify({ fontSize, fontFamily, lineHeight, flow }));
  }

  $effect(() => { if (themeStore.darkMode !== undefined) applyTypography(); });
  function flattenToc(items: any[], level = 0): any[] {
    const flat: any[] = [];
    for (const item of items) {
      const cleanLabel = item.label ? item.label.trim().replace(/\s+/g, " ") : "";
      flat.push({ label: cleanLabel, href: item.href, level });
      if (item.subitems && item.subitems.length > 0) {
        flat.push(...flattenToc(item.subitems, level + 1));
      }
    }
    return flat;
  }
  function attachRenditionEvents(bookTitle: string) {
    rendition.hooks.content.register((contents: any) => {
      const doc = contents.document;
      const style = doc.createElement("style");
      style.textContent = `
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: ${themeStore.darkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"};
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${themeStore.darkMode ? "rgba(255, 255, 255, 0.4)" : "rgba(0, 0, 0, 0.4)"};
        }
        html {
          scrollbar-width: thin;
          scrollbar-color: ${themeStore.darkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"} transparent;
        }
      `;
      doc.head.appendChild(style);
    });
    rendition.on("relocated", (location: any) => {
      const cfi = location.start.cfi;
      if (book.locations && book.locations.total > 0) progress = book.locations.percentageFromCfi(cfi);
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        if (auth.currentUser) {
          const progressId = `${auth.currentUser.uid}_${bookTitle.replace(/[^a-z0-9]/gi, "_")}`;
          await setDoc(doc(db, "user_progress", progressId), { cfi, updatedAt: serverTimestamp() }, { merge: true });
        }
      }, 3000);
    });
  }
  async function applyFlow() {
    if (!book || !rendition) return;
    const currentCfi = rendition.location?.start?.cfi;
    rendition.destroy();
    rendition = book.renderTo(readerElement, {
      width: "100%",
      height: "100%",
      flow,
      manager: flow === "scrolled" ? "continuous" : "default",
      spread: flow === "scrolled" ? "none" : "auto"
    });
    applyTypography();
    if (currentCfi) {
      try { await rendition.display(currentCfi); }
      catch (e) { await rendition.display(); }
    } else {
      await rendition.display();
    }
    attachRenditionEvents(currentBookName);
  }
  async function openBook(title: string, filePath: string) {
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
    localStorage.setItem("axe_reader_session", JSON.stringify({ name: title, url, filePath }));
    if (window.history.state?.reader !== true) window.history.pushState({ reader: true }, "");
    await tick();
    if (book) book.destroy();
    let bookData: any;
    try {
      const cacheName = "axe-epub-cache-v1";
      const cacheKey = `https://axe-local/${encodeURIComponent(filePath)}?url=${encodeURIComponent(url)}`;
      const cache = await caches.open(cacheName);
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        bookData = await cachedResponse.blob();
      } else {
        if (!url) throw new Error("No download URL available");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Fetch failed");
        const prefix = `https://axe-local/${encodeURIComponent(filePath)}`;
        const keys = await cache.keys();
        for (const req of keys) {
          if (req.url.startsWith(prefix) && req.url !== cacheKey) {
            await cache.delete(req);
          }
        }
        await cache.put(cacheKey, response.clone());
        bookData = await response.blob();
      }
    } catch (e) {
      console.warn("Cache error, falling back:", e);
      try {
        const cacheName = "axe-epub-cache-v1";
        const prefix = `https://axe-local/${encodeURIComponent(filePath)}`;
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        const match = keys.find(r => r.url.startsWith(prefix));
        if (match) {
          const cachedResponse = await cache.match(match);
          if (cachedResponse) bookData = await cachedResponse.blob();
        }
      } catch (offlineErr) {
        console.warn("Offline cache check failed:", offlineErr);
      }
      if (!bookData) bookData = url;
    }
    book = ePub(bookData);
    rendition = book.renderTo(readerElement, {
      width: "100%",
      height: "100%",
      flow,
      manager: flow === "scrolled" ? "continuous" : "default",
      spread: flow === "scrolled" ? "none" : "auto"
    });
    applyTypography();
    let savedCfi = null;
    if (auth.currentUser) {
      const progressId = `${auth.currentUser.uid}_${title.replace(/[^a-z0-9]/gi, "_")}`;
      const docRef = doc(db, "user_progress", progressId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) savedCfi = docSnap.data().cfi;
    }
    try {
      await rendition.display(savedCfi || undefined);
    } catch (e) {
      await rendition.display();
    } finally {
      isBookLoading = false;
    }
    book.loaded.metadata.then((m: any) => metadata = m);
    book.loaded.navigation.then((nav: any) => toc = flattenToc(nav.toc || []));
    book.ready.then(() => {
      const storageKey = `axe_locations_${title.replace(/[^a-z0-9]/gi, "_")}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        book.locations.load(saved);
        return book.locations;
      } else {
        return book.locations.generate(1600).then(() => {
          try {
            localStorage.setItem(storageKey, book.locations.save());
          } catch (le) {
            console.warn("Save locations failed:", le);
          }
          return book.locations;
        });
      }
    }).then(() => {
      locations = book.locations;
      if (rendition.location) progress = book.locations.percentageFromCfi(rendition.location.start.cfi);
    });
    attachRenditionEvents(title);
  }

  function next() { rendition?.next(); }
  function prev() { rendition?.prev(); }
  
  function closeReader(triggerHistory = true) {
    isReaderOpen = false;
    localStorage.removeItem("axe_reader_session");
    if (triggerHistory && window.history.state?.reader === true) window.history.back();
    if (book) { book.destroy(); book = null; }
  }

  async function performSearch() {
    if (!gotoSearch || !book) return;
    isSearching = true; hasSearched = true; searchResults = [];
    const results = await Promise.all(book.spine.spineItems.map((item: any) => {
      return item.load(book.load.bind(book)).then(async (doc: Document) => {
        const res = await item.find(gotoSearch);
        item.unload();
        return res;
      });
    }));
    searchResults = results.flat();
    isSearching = false;
  }

  async function jumpTo(cfi: string) {
    try { await rendition.display(cfi); showToc = false; showGoTo = false; showSettings = false; }
    catch (e) { console.warn("Jump failed:", e); }
  }

  async function deleteBook(bookItem: any) {
    if (!authStore.isAdmin || !confirm(`Permanently delete ${bookItem.title}?`)) return;
    try {
      await deleteObject(ref(storage, bookItem.filePath));
      try {
        const cacheName = "axe-epub-cache-v1";
        const prefix = `https://axe-local/${encodeURIComponent(bookItem.filePath)}`;
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        for (const req of keys) {
          if (req.url.startsWith(prefix)) {
            await cache.delete(req);
          }
        }
      } catch (ce) {
        console.warn("Cache delete failed:", ce);
      }
      try {
        const storageKey = `axe_locations_${bookItem.title.replace(/[^a-z0-9]/gi, "_")}`;
        localStorage.removeItem(storageKey);
      } catch (le) {
        console.warn("Failed to remove locations:", le);
      }
      await loadLibrary();
      if (currentBookName === bookItem.title) closeReader();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  onMount(() => {
    const cachedLib = localStorage.getItem("axe_library_cache");
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
    loadLibrary();
    const savedSettings = localStorage.getItem("axe_reader_settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      fontSize = Math.min(96, Math.max(8, parsed.fontSize || 16));
      fontFamily = parsed.fontFamily || FONT_OPTIONS[0].value;
      lineHeight = Math.min(3.0, Math.max(1.0, parsed.lineHeight || 1.5));
      flow = parsed.flow || "paginated";
    }
    const handlePopState = (e: PopStateEvent) => {
      if (isReaderOpen && !e.state?.reader) closeReader(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => { if (book) book.destroy(); window.removeEventListener("popstate", handlePopState); };
  });

  const filteredTracks = $derived(
    selectedCollectionId === "all" ? tracks : tracks.filter(t => t.collectionId === selectedCollectionId)
  );
</script>

{#snippet icon(svg: string, size = 18)}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    {@html svg}
  </svg>
{/snippet}

<div class="flex flex-1 flex-col">
  <div class="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
    <div class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold tracking-tight lowercase">reader</h1>
      <div class="flex items-center gap-4 sm:hidden">
        <button onclick={loadLibrary} disabled={isLoading} class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 disabled:opacity-30 transition-none cursor-pointer">
          {isLoading ? '...' : 'refresh'}
        </button>
        {#if authStore.isAdmin}
          <button onclick={() => (showUploadModal = true)} class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 transition-none cursor-pointer">
            upload
          </button>
        {/if}
      </div>
    </div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      {#if collections.length > 0}
        <div class="flex gap-1 rounded-md border border-border bg-background p-1 overflow-x-auto max-w-full">
          <button onclick={() => (selectedCollectionId = "all")} class="rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer whitespace-nowrap {selectedCollectionId === 'all' ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}">
            all
          </button>
          {#each collections as col}
            <button onclick={() => (selectedCollectionId = col.id)} class="rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer whitespace-nowrap {selectedCollectionId === col.id ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}">
              {col.name}
            </button>
          {/each}
        </div>
      {/if}
      <button onclick={loadLibrary} disabled={isLoading} class="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 disabled:opacity-30 transition-none cursor-pointer">
        {isLoading ? '...' : 'refresh'}
      </button>
      {#if authStore.isAdmin}
        <button onclick={() => (showUploadModal = true)} class="hidden sm:inline-block text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 transition-none cursor-pointer">
          upload
        </button>
      {/if}
    </div>
  </div>
  {#if authStore.isAdmin}
    <Modal show={showUploadModal} title="upload epub book" onClose={() => (showUploadModal = false)} showFooter={false}>
      <form onsubmit={handleUpload} class="flex flex-col gap-6">
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1" for="epub-file">select file</label>
          <input 
            type="file" 
            id="epub-file" 
            accept=".epub" 
            onchange={(e) => { const files = (e.target as HTMLInputElement).files; if (files && files.length > 0) uploadFile = files[0]; }} 
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
            {#each collections as col}
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
      {#each filteredTracks as bookItem}
        <div class="group flex h-20 w-full items-center gap-4 border-b border-border px-1 transition-none hover:bg-foreground/5">
          <button 
            onclick={() => openBook(bookItem.title, bookItem.filePath)} 
            class="flex flex-1 items-center gap-4 text-left overflow-hidden h-full cursor-pointer"
          >
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground group-hover:bg-foreground group-hover:text-background group-hover:border-foreground transition-none">
              {@render icon(ICONS.BOOK, 20)}
            </div>
            <div class="flex flex-col overflow-hidden">
              <span class="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-foreground transition-none truncate">{bookItem.title}</span>
              <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400/60 truncate mt-0.5">{bookItem.collectionId}</span>
            </div>
          </button>

          {#if authStore.isAdmin}
            <button 
              onclick={() => deleteBook(bookItem)} 
              class="flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-gray-400 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-none cursor-pointer shrink-0"
              aria-label="Delete book"
            >
              {@render icon(ICONS.DELETE, 18)}
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
          <button onclick={() => themeStore.toggleTheme()} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground cursor-pointer transition-none select-none" aria-label="Theme">
            {#if themeStore.darkMode} {@render icon(ICONS.SUN, 20)}
            {:else} {@render icon(ICONS.MOON, 20)} {/if}
          </button>
          <button onclick={() => closeReader()} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-rose-500 hover:bg-rose-500 hover:text-white hover:border-rose-500 cursor-pointer transition-none select-none" aria-label="Close reader">
            {@render icon(ICONS.CLOSE, 20)}
          </button>
        </div>
      </header>
      <div class="relative flex-1 flex min-h-0 overflow-hidden">
        <div bind:this={readerElement} class="flex-1 h-full mx-auto w-full overflow-hidden {flow === 'scrolled' ? 'max-w-3xl' : 'max-w-none'}"></div>
        {#if isBookLoading} <div class="absolute inset-0 flex items-center justify-center bg-background/50 z-20"><span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">loading book...</span></div> {/if}
        
        {#if showToc}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">contents</h2>
              <button onclick={() => showToc = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
            </div>
            <div class="flex-1 overflow-y-auto space-y-2">
              {#each toc as item} 
                <button onclick={() => jumpTo(item.href)} style="padding-left: {item.level * 16 + 12}px;" class="w-full text-left text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-foreground hover:bg-foreground/5 rounded-md pr-3 py-2.5 transition-none cursor-pointer border-b border-border/30">
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
                    onkeydown={(e: KeyboardEvent) => e.key === "Enter" && performSearch()} 
                    placeholder="Search..." 
                  />
                </div>
                <button onclick={performSearch} disabled={isSearching} class="h-10 w-10 flex items-center justify-center shrink-0 border border-border rounded-md bg-surface hover:bg-foreground hover:text-background hover:border-foreground text-foreground transition-none cursor-pointer">
                  {#if isSearching} <span class="text-[10px] font-bold opacity-70 tracking-widest">...</span>
                  {:else} {@render icon(ICONS.SEARCH, 14)} {/if}
                </button>
              </div>
              <div class="flex-1 overflow-y-auto space-y-3 pr-3">
                {#each searchResults as res} 
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
                  <button onclick={() => { fontSize = Math.max(8, (Number(fontSize) || 16) - 1); applyTypography(); }} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground cursor-pointer transition-none select-none font-bold">-</button>
                  <input type="number" min="8" max="96" bind:value={fontSize} onchange={applyTypography} onblur={applyTypography} class="flex-1 h-10 bg-background border border-border rounded-md text-center text-sm font-mono font-bold outline-none focus:border-foreground text-foreground" />
                  <button onclick={() => { fontSize = Math.min(96, (Number(fontSize) || 16) + 1); applyTypography(); }} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground cursor-pointer transition-none select-none font-bold">+</button>
                </div>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font family</p>
                <div class="grid grid-cols-3 gap-2">
                  {#each FONT_OPTIONS as option}
                    <button onclick={() => { fontFamily = option.value; applyTypography(); }} class="py-2 border border-border rounded-md text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer {fontFamily === option.value ? 'bg-foreground text-background border-foreground' : 'text-gray-500 hover:bg-foreground/5 hover:text-foreground bg-transparent'}">{option.label}</button>
                  {/each}
                </div>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">line spacing</p>
                <div class="flex items-center gap-2">
                  <button onclick={() => { lineHeight = Math.max(1.0, parseFloat(((Number(lineHeight) || 1.5) - 0.1).toFixed(1))); applyTypography(); }} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground cursor-pointer transition-none select-none font-bold">-</button>
                  <input type="number" min="1.0" max="3.0" step="0.1" bind:value={lineHeight} onchange={applyTypography} onblur={applyTypography} class="flex-1 h-10 bg-background border border-border rounded-md text-center text-sm font-mono font-bold outline-none focus:border-foreground text-foreground" />
                  <button onclick={() => { lineHeight = Math.min(3.0, parseFloat(((Number(lineHeight) || 1.5) + 0.1).toFixed(1))); applyTypography(); }} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground cursor-pointer transition-none select-none font-bold">+</button>
                </div>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">layout</p>
                <div class="grid grid-cols-2 gap-2">
                  <button onclick={() => { flow = "paginated"; applyFlow(); }} class="py-2 border border-border rounded-md text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer {flow === 'paginated' ? 'bg-foreground text-background border-foreground' : 'text-gray-500 hover:bg-foreground/5 hover:text-foreground bg-transparent'}">pages</button>
                  <button onclick={() => { flow = "scrolled"; applyFlow(); }} class="py-2 border border-border rounded-md text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer {flow === 'scrolled' ? 'bg-foreground text-background border-foreground' : 'text-gray-500 hover:bg-foreground/5 hover:text-foreground bg-transparent'}">scroll</button>
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
        <button onclick={prev} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-none cursor-pointer" aria-label="Prev">
          {@render icon(ICONS.PREV, 20)}
        </button>
        <div class="flex items-center gap-1 rounded-md border border-border bg-background p-1">
          <button onclick={() => { showSettings = !showSettings; showGoTo = false; showToc = false; }} class="flex h-10 w-10 items-center justify-center rounded-sm transition-none cursor-pointer {showSettings ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}" aria-label="Typography settings">
            {@render icon(ICONS.TYPOGRAPHY, 18)}
          </button>
          <button onclick={() => { showGoTo = !showGoTo; showToc = false; showSettings = false; }} class="flex h-10 w-10 items-center justify-center rounded-sm transition-none cursor-pointer {showGoTo ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}" aria-label="Search book">
            {@render icon(ICONS.SEARCH, 18)}
          </button>
          <button onclick={() => { showToc = !showToc; showGoTo = false; showSettings = false; }} class="flex h-10 w-10 items-center justify-center rounded-sm transition-none cursor-pointer {showToc ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}" aria-label="Table of contents">
            {@render icon(ICONS.TOC, 18)}
          </button>
        </div>
        <button onclick={next} class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-none cursor-pointer" aria-label="Next">
          {@render icon(ICONS.NEXT, 20)}
        </button>
      </footer>
    </div>
  {/if}
</div>
<svelte:body class:overflow-hidden={isReaderOpen} />
