<script lang="ts">
  import { onMount, tick } from "svelte";
  import ePub from "epubjs";
  import { auth, storage, db } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.ts";
  import { themeStore } from "../lib/stores/themeStore.svelte.ts";
  import { ICONS } from "../lib/utils/icons";
  import { ref, getDownloadURL, deleteObject, listAll } from "firebase/storage";
  import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

  let readerElement: HTMLElement;
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

  // Typography Settings
  let fontSize = $state(18);
  let fontFamily = $state("ui-sans-serif, system-ui, sans-serif");
  let lineHeight = $state(1.6);
  let paragraphSpacing = $state(1.0);

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

      // 1. Process Subfolders (Collections)
      for (const folderRef of res.prefixes) {
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
              url: await getDownloadURL(itemRef),
              collectionId: folderRef.name
            });
          }
        }
      }

      // 2. Process Root Files (Directly in /books)
      const rootEpubs = res.items.filter(i => i.name.toLowerCase().endsWith('.epub'));
      if (rootEpubs.length > 0) {
        newCollections.push({ id: "Books", name: "Books" });
        for (const itemRef of rootEpubs) {
          newTracks.push({
            id: itemRef.fullPath,
            title: itemRef.name.replace(/\.[^/.]+$/, ""),
            fileName: itemRef.name,
            filePath: itemRef.fullPath,
            url: await getDownloadURL(itemRef),
            collectionId: "Books"
          });
        }
      }

      collections = newCollections;
      tracks = newTracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));
    } catch (e) {
      console.error("Failed to list bucket:", e);
    } finally {
      isLoading = false;
    }
  }

  function applyTypography() {
    if (!rendition) return;
    rendition.themes.register("custom", {
      "body": { "color": themeStore.darkMode ? "#e5e7eb" : "#111827", "background": "transparent !important" },
      "p, div, span, section, li": {
        "font-family": `${fontFamily} !important`,
        "line-height": `${lineHeight} !important`,
        "font-size": `${fontSize}px !important`,
        "color": "inherit !important"
      },
      "p": { "margin-bottom": `${paragraphSpacing}em !important` }
    });
    rendition.themes.select("custom");
    rendition.themes.font(fontFamily);
    rendition.themes.fontSize(`${fontSize}px`);
    localStorage.setItem("axe_reader_settings", JSON.stringify({ fontSize, fontFamily, lineHeight, paragraphSpacing }));
  }

  $effect(() => { if (themeStore.darkMode !== undefined) applyTypography(); });

  async function openBook(url: string, title: string) {
    currentBookName = title;
    isReaderOpen = true;
    isBookLoading = true;
    showToc = false; showGoTo = false; showSettings = false; searchResults = []; progress = 0;
    localStorage.setItem("axe_reader_session", JSON.stringify({ name: title, url }));
    if (window.history.state?.reader !== true) window.history.pushState({ reader: true }, "");
    
    await tick();
    if (book) book.destroy();
    book = ePub(url);
    rendition = book.renderTo(readerElement, { width: "100%", height: "100%", flow: "paginated", manager: "default" });
    applyTypography();
    
    // Progress from Firestore
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
    } finally { isBookLoading = false; }
    
    book.loaded.metadata.then((m: any) => metadata = m);
    book.loaded.navigation.then((nav: any) => toc = nav.toc);
    book.ready.then(() => book.locations.generate(1600)).then(() => {
      locations = book.locations;
      if (rendition.location) progress = book.locations.percentageFromCfi(rendition.location.start.cfi);
    });
    
    rendition.on("relocated", (location: any) => {
      const cfi = location.start.cfi;
      if (book.locations && book.locations.total > 0) progress = book.locations.percentageFromCfi(cfi);
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        if (auth.currentUser) {
          const progressId = `${auth.currentUser.uid}_${title.replace(/[^a-z0-9]/gi, "_")}`;
          await setDoc(doc(db, "user_progress", progressId), { 
            cfi, 
            updatedAt: serverTimestamp() 
          }, { merge: true });
        }
      }, 3000);
    });
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
      return item.load(book.load.bind(book)).then((doc: Document) => {
        const res = item.find(gotoSearch);
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
      await loadLibrary();
      if (currentBookName === bookItem.title) closeReader();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }

  onMount(() => {
    loadLibrary().then(() => {
      const savedSession = localStorage.getItem("axe_reader_session");
      if (savedSession) {
        try {
          const { name, url } = JSON.parse(savedSession);
          const exists = tracks.some(t => t.title === name);
          if (exists) openBook(url, name);
        } catch (e) { console.error(e); }
      }
    });

    const savedSettings = localStorage.getItem("axe_reader_settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      fontSize = parsed.fontSize || 18;
      fontFamily = parsed.fontFamily || FONT_OPTIONS[0].value;
      lineHeight = parsed.lineHeight || 1.6;
      paragraphSpacing = parsed.paragraphSpacing || 1.0;
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
  <!-- Optimized Header -->
  <div class="mb-8 flex items-end justify-between border-b border-border/50 pb-4">
    <div class="flex flex-col gap-1.5 min-w-0">
      <h1 class="text-2xl font-bold tracking-tight lowercase shrink-0">reader</h1>
      {#if collections.length > 0}
        <select 
          bind:value={selectedCollectionId} 
          class="bg-transparent text-[10px] font-bold uppercase tracking-widest text-gray-500 focus:outline-none cursor-pointer border-none p-0 w-fit"
        >
          <option value="all">all collections</option>
          {#each collections as col}
            <option value={col.id}>{col.name}</option>
          {/each}
        </select>
      {/if}
    </div>
    
    <div class="flex items-center gap-4">
      <button 
        onclick={loadLibrary}
        disabled={isLoading}
        class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 disabled:opacity-30 transition-opacity"
      >
        {isLoading ? '...' : 'refresh'}
      </button>
    </div>
  </div>

  <!-- Unified Library List -->
  <div class="space-y-1">
    {#if isLoading && tracks.length === 0}
      <div class="py-20 text-center"><span class="text-sm font-bold uppercase tracking-widest text-gray-500/50">syncing bucket...</span></div>
    {:else if filteredTracks.length === 0}
      <div class="py-20 text-center"><span class="text-sm font-bold uppercase tracking-widest text-gray-500/50">no books found</span></div>
    {:else}
      {#each filteredTracks as bookItem}
        <div class="group flex h-16 sm:h-20 w-full items-center gap-4 border-b border-border/50 px-1 transition-colors rounded-xl hover:bg-gray-500/5">
          <button 
            onclick={() => openBook(bookItem.url, bookItem.title)} 
            class="flex flex-1 items-center gap-4 text-left overflow-hidden h-full"
          >
            <div class="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg sm:rounded-xl border border-border bg-surface dark:bg-white/5 group-hover:bg-foreground group-hover:text-background transition-colors">
              {@render icon(ICONS.BOOK, 20)}
            </div>
            <div class="flex flex-col overflow-hidden">
              <span class="text-sm font-bold uppercase tracking-widest text-gray-500 group-hover:text-foreground transition-colors truncate">{bookItem.title}</span>
              <span class="text-[9px] font-bold uppercase text-gray-400/40 truncate">{bookItem.collectionId}</span>
            </div>
          </button>

          {#if authStore.isAdmin}
            <button 
              onclick={() => deleteBook(bookItem)} 
              class="p-2 text-gray-400 hover:text-red-500 opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
    <div class="fixed inset-0 z-[60] flex flex-col bg-background overflow-hidden text-foreground">
      <header class="flex h-16 shrink-0 items-center justify-between border-b border-border p-4 md:px-8 bg-background">
        <div class="flex flex-col overflow-hidden">
          <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate">{metadata?.title || currentBookName}</span>
          {#if progress > 0} <span class="text-[9px] text-gray-400">{(progress * 100).toFixed(0)}% read</span> {/if}
        </div>
        <div class="flex items-center gap-2">
          <button onclick={() => themeStore.toggleTheme()} class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-500/5 text-gray-500 hover:text-foreground transition-colors">
            {#if themeStore.darkMode} {@render icon(ICONS.SUN, 18)}
            {:else} {@render icon(ICONS.MOON, 18)} {/if}
          </button>
          <div class="w-px h-4 bg-border mx-1"></div>
          <button onclick={() => closeReader()} class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors">{@render icon(ICONS.CLOSE, 18)}</button>
        </div>
      </header>

      <div class="relative flex-1 flex overflow-hidden">
        <div bind:this={readerElement} class="flex-1 h-full overflow-hidden"></div>
        {#if isBookLoading} <div class="absolute inset-0 flex items-center justify-center bg-background/50 z-20"><span class="text-sm font-bold uppercase tracking-widest text-gray-500">loading book...</span></div> {/if}
        
        {#if showToc}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l border-border z-10 flex flex-col p-6 animate-in slide-in-from-right duration-200 shadow-2xl">
            <div class="flex items-center justify-between mb-6"><h2 class="text-[10px] font-bold uppercase tracking-widest text-gray-500">contents</h2><button onclick={() => showToc = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-400">back</button></div>
            <div class="flex-1 overflow-y-auto space-y-3">
              {#each toc as item} <button onclick={() => jumpTo(item.href)} class="w-full text-left text-xs hover:text-foreground text-gray-500 transition-colors py-2 border-b border-border/30">{item.label}</button> {/each}
            </div>
          </div>
        {/if}
        
        {#if showGoTo}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l border-border z-10 flex flex-col p-6 animate-in slide-in-from-right duration-200 shadow-2xl">
            <div class="flex items-center justify-between mb-8"><h2 class="text-[10px] font-bold uppercase tracking-widest text-gray-500">search</h2><button onclick={() => showGoTo = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-400">back</button></div>
            <div class="flex-1 flex flex-col overflow-hidden">
              <p class="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">find keyword</p>
              <div class="flex gap-2 mb-4">
                <input type="text" bind:value={gotoSearch} oninput={() => hasSearched = false} onkeydown={(e) => e.key === "Enter" && performSearch()} placeholder="Search..." class="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-foreground" />
                <button onclick={performSearch} disabled={isSearching} class="h-9 w-11 flex items-center justify-center shrink-0 border border-border rounded hover:bg-gray-500/5 text-gray-500">
                  {#if isSearching} <span class="text-[12px] font-bold opacity-70 tracking-widest leading-none">...</span>
                  {:else} {@render icon(ICONS.SEARCH, 14)} {/if}
                </button>
              </div>
              <div class="flex-1 overflow-y-auto space-y-3">
                {#each searchResults as res} <button onclick={() => jumpTo(res.cfi)} class="w-full text-left text-[11px] p-3 border border-border/30 rounded hover:bg-gray-500/5 transition-colors"><p class="text-gray-400 line-clamp-2 italic">"...{res.excerpt}..."</p></button> {/each}
                {#if hasSearched && !isSearching && searchResults.length === 0} <div class="py-20 text-center"><span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/50">no results found</span></div> {/if}
              </div>
            </div>
          </div>
        {/if}

        {#if showSettings}
          <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l border-border z-10 flex flex-col p-6 animate-in slide-in-from-right duration-200 shadow-2xl">
            <div class="flex items-center justify-between mb-8"><h2 class="text-[10px] font-bold uppercase tracking-widest text-gray-500">settings</h2><button onclick={() => showSettings = false} class="text-[10px] font-bold uppercase tracking-widest text-gray-400">back</button></div>
            <div class="space-y-8">
              <div><div class="flex items-center justify-between mb-2"><p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">font size</p><span class="text-[10px] font-mono text-gray-500">{fontSize}px</span></div><input type="range" min="12" max="32" step="1" bind:value={fontSize} oninput={applyTypography} class="w-full h-1 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground" /></div>
              <div><p class="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-3">font family</p><div class="grid grid-cols-3 gap-2">{#each FONT_OPTIONS as option}<button onclick={() => { fontFamily = option.value; applyTypography(); }} class="py-2 border rounded text-[10px] font-bold uppercase tracking-widest transition-colors {fontFamily === option.value ? 'bg-foreground text-background border-foreground' : 'border-border text-gray-500 hover:bg-gray-500/5'}">{option.label}</button>{/each}</div></div>
              <div><div class="flex items-center justify-between mb-2"><p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">line spacing</p><span class="text-[10px] font-mono text-gray-500">{lineHeight}</span></div><input type="range" min="1.4" max="2.0" step="0.1" bind:value={lineHeight} oninput={applyTypography} class="w-full h-1 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground" /></div>
              <div><div class="flex items-center justify-between mb-2"><p class="text-[9px] font-bold uppercase tracking-widest text-gray-400">paragraph spacing</p><span class="text-[10px] font-mono text-gray-500">{paragraphSpacing}</span></div><input type="range" min="1.0" max="2.0" step="0.1" bind:value={paragraphSpacing} oninput={applyTypography} class="w-full h-1 bg-foreground/10 rounded-full appearance-none cursor-pointer accent-foreground" /></div>
            </div>
            <div class="mt-auto pt-8 border-t border-border/30"><button onclick={() => { fontSize = 18; fontFamily = FONT_OPTIONS[0].value; lineHeight = 1.6; paragraphSpacing = 1.0; applyTypography(); }} class="w-full py-3 border border-border rounded text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground hover:bg-gray-500/5">reset defaults</button></div>
          </div>
        {/if}
      </div>

      <footer class="shrink-0 h-14 flex items-center justify-between border-t border-border bg-background px-4 md:px-8">
        <button onclick={prev} class="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-gray-500/5 text-gray-500 hover:text-foreground transition-colors" aria-label="Prev">{@render icon(ICONS.PREV, 20)}</button>
        <div class="flex items-center gap-2 px-4 py-1 rounded-xl bg-gray-500/5 border border-border/20">
          <button onclick={() => { showSettings = !showSettings; showGoTo = false; showToc = false; }} class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-500/10 text-gray-400 hover:text-foreground transition-colors {showSettings ? 'text-foreground bg-gray-500/10' : ''}">{@render icon(ICONS.TYPOGRAPHY, 18)}</button>
          <button onclick={() => { showGoTo = !showGoTo; showToc = false; showSettings = false; }} class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-500/10 text-gray-400 hover:text-foreground transition-colors {showGoTo ? 'text-foreground bg-gray-500/10' : ''}">{@render icon(ICONS.SEARCH, 18)}</button>
          <button onclick={() => { showToc = !showToc; showGoTo = false; showSettings = false; }} class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-500/10 text-gray-400 hover:text-foreground transition-colors {showToc ? 'text-foreground bg-gray-500/10' : ''}">{@render icon(ICONS.TOC, 18)}</button>
        </div>
        <button onclick={next} class="flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-gray-500/5 text-gray-500 hover:text-foreground transition-colors" aria-label="Next">{@render icon(ICONS.NEXT, 20)}</button>
      </footer>
    </div>
  {/if}
</div>

<style>
  :global(.epub-container) { height: 100% !important; width: 100% !important; }
  :global(body:has(.fixed.inset-0)) { overflow: hidden !important; }
  input[type="range"]::-webkit-slider-thumb { appearance: none; height: 10px; width: 10px; border-radius: 50%; background: currentColor; cursor: pointer; }
  input[type="range"]::-moz-range-thumb { height: 10px; width: 10px; border: none; border-radius: 50%; background: currentColor; cursor: pointer; }
  input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
</style>
