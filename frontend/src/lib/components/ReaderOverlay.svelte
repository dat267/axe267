<script>
  import Icon from "./Icon.svelte";
  import Input from "./Input.svelte";
  import Button from "./Button.svelte";
  import { ICONS } from "../utils/icons";

  let {
    metadata = null,
    progress = 0,
    toc = [],
    currentBookName = "",
    flow = "paginated",
    fontSize = 16,
    fontFamily = "ui-sans-serif, system-ui, sans-serif",
    lineHeight = 1.5,
    isBookLoading = false,
    themeMode = "dark",
    onClose,
    onNext,
    onPrev,
    onJumpTo,
    onSearch,
    onApplyTypography,
    onSwitchFlow,
    onThemeCycle,
    onReaderElement,
  } = $props();

  let readerElement = $state();
  $effect(() => {
    if (readerElement) onReaderElement?.(readerElement);
  });

  let showToc = $state(false);
  let showGoTo = $state(false);
  let showSettings = $state(false);
  let gotoSearch = $state("");
  let searchResults = $state([]);
  let isSearching = $state(false);
  let hasSearched = $state(false);

  const FONT_OPTIONS = [
    { label: "Sans", value: "ui-sans-serif, system-ui, sans-serif" },
    { label: "Serif", value: "Georgia, serif" },
    { label: "Mono", value: "ui-monospace, monospace" },
  ];

  async function handleSearch() {
    if (!gotoSearch || !onSearch) return;
    isSearching = true;
    hasSearched = true;
    searchResults = [];
    try {
      searchResults = await onSearch(gotoSearch);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      isSearching = false;
    }
  }
</script>

<div class="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[60] flex flex-col bg-background overflow-hidden text-foreground">
  <header class="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border p-4 md:px-8 bg-background">
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <span
        class="block min-w-0 text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate"
        title={metadata?.title || currentBookName}
      >{metadata?.title || currentBookName}</span>
      {#if progress > 0}
        <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400/60 mt-0.5">{(progress * 100).toFixed(0)}% read</span>
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button onclick={onThemeCycle} class="icon-btn" aria-label="Cycle theme">
        {#if themeMode === "dark"}
          <Icon svg={ICONS.MOON} size={20} />
        {:else if themeMode === "light"}
          <Icon svg={ICONS.SUN} size={20} />
        {:else}
          <Icon svg={ICONS.MONITOR} size={20} />
        {/if}
      </button>
      <button onclick={onClose} class="icon-btn danger" aria-label="Close reader">
        <Icon svg={ICONS.CLOSE} size={20} />
      </button>
    </div>
  </header>

  <div class="relative flex-1 flex min-h-0 overflow-hidden">
    <div
      bind:this={readerElement}
      class="flex-1 h-full mx-auto w-full overflow-hidden {flow === 'paginated' ? 'py-4 md:py-12' : ''} {flow === 'scrolled' ? 'max-w-3xl' : 'max-w-none'}"
    ></div>

    {#if isBookLoading}
      <div class="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
        <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">loading book...</span>
      </div>
    {/if}

    {#if showToc}
      <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">contents</h2>
          <button onclick={() => { showToc = false; }} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
        </div>
        <div class="flex-1 overflow-y-auto space-y-2">
          {#each toc as item (item.target || item.label)}
            <button
              onclick={() => onJumpTo?.(item.target)}
              style="padding-left: {item.level * 16 + 12}px;"
              class="w-full text-left text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-foreground hover:bg-foreground/5 rounded-md pr-3 py-2.5 transition-none cursor-pointer border-b border-border/30"
            >
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
          <button onclick={() => { showGoTo = false; }} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
        </div>
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="flex items-end gap-2 mb-6">
            <div class="flex-1">
              <Input
                id="book-search"
                label="find keyword"
                bind:value={gotoSearch}
                oninput={() => { hasSearched = false; }}
                onkeydown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search..."
              />
            </div>
            <button onclick={handleSearch} disabled={isSearching} class="icon-btn shrink-0">
              {#if isSearching}
                <span class="text-[10px] font-bold opacity-70 tracking-widest">...</span>
              {:else}
                <Icon svg={ICONS.SEARCH} size={14} />
              {/if}
            </button>
          </div>
          <div class="flex-1 overflow-y-auto space-y-3 pr-3">
            {#each searchResults as res (res.cfi)}
              <button
                onclick={() => onJumpTo?.(res.cfi)}
                class="w-full text-left text-[11px] p-4 border border-border rounded-md hover:bg-foreground/5 transition-none cursor-pointer"
              >
                <p class="text-gray-500 italic">"...{res.excerpt}..."</p>
              </button>
            {/each}
            {#if hasSearched && !isSearching && searchResults.length === 0}
              <div class="py-20 text-center">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/50">no results found</span>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if showSettings}
      <div class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">settings</h2>
          <button onclick={() => { showSettings = false; }} class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer">back</button>
        </div>
        <div class="space-y-6">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font size (px)</p>
            <div class="flex items-center gap-2">
              <button
                onclick={() => { fontSize = Math.max(8, (Number(fontSize) || 16) - 1); onApplyTypography?.({ fontSize, fontFamily, lineHeight }); }}
                class="icon-btn font-bold"
              >-</button>
              <input
                type="number"
                min="8"
                max="96"
                bind:value={fontSize}
                onchange={() => onApplyTypography?.({ fontSize, fontFamily, lineHeight })}
                onblur={() => onApplyTypography?.({ fontSize, fontFamily, lineHeight })}
                class="flex-1 h-10 bg-background border border-border rounded-md text-center text-sm font-mono font-bold outline-none focus:border-foreground text-foreground"
              />
              <button
                onclick={() => { fontSize = Math.min(96, (Number(fontSize) || 16) + 1); onApplyTypography?.({ fontSize, fontFamily, lineHeight }); }}
                class="icon-btn font-bold"
              >+</button>
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font family</p>
            <div class="grid grid-cols-3 gap-2">
              {#each FONT_OPTIONS as option (option.value)}
                <button
                  onclick={() => { fontFamily = option.value; onApplyTypography?.({ fontSize, fontFamily, lineHeight }); }}
                  class="chip {fontFamily === option.value ? 'active' : 'inactive'} py-2"
                >{option.label}</button>
              {/each}
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">line spacing</p>
            <div class="flex items-center gap-2">
              <button
                onclick={() => { lineHeight = Math.max(1.0, parseFloat(((Number(lineHeight) || 1.5) - 0.1).toFixed(1))); onApplyTypography?.({ fontSize, fontFamily, lineHeight }); }}
                class="icon-btn font-bold"
              >-</button>
              <input
                type="number"
                min="1.0"
                max="3.0"
                step="0.1"
                bind:value={lineHeight}
                onchange={() => onApplyTypography?.({ fontSize, fontFamily, lineHeight })}
                onblur={() => onApplyTypography?.({ fontSize, fontFamily, lineHeight })}
                class="flex-1 h-10 bg-background border border-border rounded-md text-center text-sm font-mono font-bold outline-none focus:border-foreground text-foreground"
              />
              <button
                onclick={() => { lineHeight = Math.min(3.0, parseFloat(((Number(lineHeight) || 1.5) + 0.1).toFixed(1))); onApplyTypography?.({ fontSize, fontFamily, lineHeight }); }}
                class="icon-btn font-bold"
              >+</button>
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">layout</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                onclick={() => { onSwitchFlow?.("paginated"); }}
                class="chip {flow === 'paginated' ? 'active' : 'inactive'} py-2"
              >pages</button>
              <button
                onclick={() => { onSwitchFlow?.("scrolled"); }}
                class="chip {flow === 'scrolled' ? 'active' : 'inactive'} py-2"
              >scroll</button>
            </div>
          </div>
        </div>
        <div class="mt-auto pt-8 border-t border-border/30">
          <Button
            variant="secondary"
            className="w-full"
            onclick={() => {
              fontSize = 16;
              fontFamily = FONT_OPTIONS[0].value;
              lineHeight = 1.5;
              onSwitchFlow?.("paginated");
            }}
          >reset defaults</Button>
        </div>
      </div>
    {/if}
  </div>

  <footer class="shrink-0 h-16 flex items-center justify-between border-t border-border bg-background p-4 md:px-8">
    <button onclick={onPrev} class="icon-btn" aria-label="Prev">
      <Icon svg={ICONS.PREV} size={20} />
    </button>
    <div class="icon-toggle-group">
      <button
        onclick={() => { showSettings = !showSettings; showGoTo = false; showToc = false; }}
        class="icon-btn {showSettings ? 'icon-active' : 'icon-inactive'}"
        aria-label="Typography settings"
      >
        <Icon svg={ICONS.TYPOGRAPHY} size={18} />
      </button>
      <button
        onclick={() => { showGoTo = !showGoTo; showToc = false; showSettings = false; }}
        class="icon-btn {showGoTo ? 'icon-active' : 'icon-inactive'}"
        aria-label="Search book"
      >
        <Icon svg={ICONS.SEARCH} size={18} />
      </button>
      <button
        onclick={() => { showToc = !showToc; showGoTo = false; showSettings = false; }}
        class="icon-btn {showToc ? 'icon-active' : 'icon-inactive'}"
        aria-label="Table of contents"
      >
        <Icon svg={ICONS.TOC} size={18} />
      </button>
    </div>
    <button onclick={onNext} class="icon-btn" aria-label="Next">
      <Icon svg={ICONS.NEXT} size={20} />
    </button>
  </footer>
</div>