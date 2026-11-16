<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import Input from "./Input.svelte";
  import Button from "./Button.svelte";
  import { ICONS } from "../utils/icons";
  import type { EpubMetadata, EpubSearchResult } from "epubjs";
  import type { BookFlow, TocItem } from "../services/bookRenderer";
  import type { ThemeMode } from "../stores/themeStore.svelte";

  interface TypographyInput {
    fontSize: number;
    fontFamily: string;
    lineHeight: number;
  }

  interface Props {
    metadata?: EpubMetadata | null;
    progress?: number;
    toc?: TocItem[];
    currentBookName?: string;
    flow?: BookFlow;
    fontSize?: number;
    fontFamily?: string;
    lineHeight?: number;
    isBookLoading?: boolean;
    themeMode?: ThemeMode;
    onClose?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onJumpTo?: (target: string) => boolean | void | Promise<boolean | void>;
    onSearch?: (query: string) => Promise<EpubSearchResult[]>;
    onApplyTypography?: (settings: TypographyInput) => void;
    onSwitchFlow?: (flow: BookFlow) => void;
    onThemeCycle?: () => void;
    onReaderElement?: (element: HTMLElement) => void;
  }

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
  }: Props = $props();

  let readerElement = $state<HTMLDivElement>();
  $effect(() => {
    if (readerElement) onReaderElement?.(readerElement);
  });

  let showToc = $state(false);
  let showGoTo = $state(false);
  let showSettings = $state(false);
  let tocToggleButton = $state<HTMLButtonElement>();
  let tocCloseButton = $state<HTMLButtonElement>();
  let pendingTocIndex = $state<number | null>(null);
  let tocError = $state("");
  let tocRequest = 0;
  let gotoSearch = $state("");
  let searchResults = $state<EpubSearchResult[]>([]);
  let isSearching = $state(false);
  let hasSearched = $state(false);
  let searchRequest = 0;

  const FONT_OPTIONS = [
    { label: "Sans", value: "ui-sans-serif, system-ui, sans-serif" },
    { label: "Serif", value: "Georgia, serif" },
    { label: "Mono", value: "ui-monospace, monospace" },
  ];

  async function handleSearch() {
    if (!gotoSearch || !onSearch) return;
    const request = ++searchRequest;
    isSearching = true;
    hasSearched = true;
    searchResults = [];
    try {
      const results = await onSearch(gotoSearch);
      if (request === searchRequest) searchResults = results;
    } catch (err) {
      if (request === searchRequest) console.error("Search failed:", err);
    } finally {
      if (request === searchRequest) isSearching = false;
    }
  }

  function resetSearchResults() {
    searchRequest += 1;
    searchResults = [];
    isSearching = false;
    hasSearched = false;
  }

  async function toggleToc() {
    if (showToc) {
      closeToc();
      return;
    }
    showToc = true;
    showGoTo = false;
    showSettings = false;
    tocError = "";
    await tick();
    tocCloseButton?.focus();
  }

  function hideToc() {
    tocRequest += 1;
    showToc = false;
    pendingTocIndex = null;
  }

  function closeToc() {
    hideToc();
    tocToggleButton?.focus();
  }

  async function selectTocItem(item: TocItem, index: number) {
    if (!item.target || pendingTocIndex !== null) return;
    const request = ++tocRequest;
    tocError = "";
    pendingTocIndex = index;
    try {
      const result = await onJumpTo?.(item.target);
      if (request !== tocRequest) return;
      if (result === false) {
        tocError = "Could not open that chapter. Try another entry.";
        pendingTocIndex = null;
        return;
      }
      closeToc();
    } catch (err) {
      if (request !== tocRequest) return;
      console.error("Chapter jump failed:", err);
      tocError = "Could not open that chapter. Try another entry.";
      pendingTocIndex = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (showToc) {
      closeToc();
    } else if (showGoTo) {
      showGoTo = false;
    } else if (showSettings) {
      showSettings = false;
    } else {
      return;
    }
    event.preventDefault();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fixed inset-0 h-[100dvh] max-h-[100dvh] z-[60] flex flex-col bg-background overflow-hidden text-foreground">
  <header class="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border p-4 md:px-8 bg-background">
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <span
        class="block min-w-0 text-[10px] font-bold uppercase tracking-widest text-gray-500 truncate"
        title={metadata?.title || currentBookName}
        >{metadata?.title || currentBookName}</span
      >
      {#if progress > 0}
        <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400/60 mt-0.5"
          >{(progress * 100).toFixed(0)}% read</span
        >
      {/if}
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button onclick={() => onThemeCycle?.()} class="icon-btn" aria-label="Cycle theme">
        {#if themeMode === "dark"}
          <Icon svg={ICONS.MOON} size={20} />
        {:else if themeMode === "light"}
          <Icon svg={ICONS.SUN} size={20} />
        {:else}
          <Icon svg={ICONS.MONITOR} size={20} />
        {/if}
      </button>
      <button onclick={() => onClose?.()} class="icon-btn danger" aria-label="Close reader">
        <Icon svg={ICONS.CLOSE} size={20} />
      </button>
    </div>
  </header>

  <div class="relative flex-1 flex min-h-0 overflow-hidden">
    <div
      bind:this={readerElement}
      class="flex-1 h-full mx-auto w-full overflow-hidden {flow === 'paginated'
        ? 'py-4 md:py-12'
        : ''} {flow === 'scrolled' ? 'max-w-3xl' : 'max-w-none'}"
    ></div>

    {#if isBookLoading}
      <div class="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
        <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">loading book...</span>
      </div>
    {/if}

    {#if showToc}
      <div
        id="reader-toc"
        role="dialog"
        aria-labelledby="reader-toc-title"
        class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-5 md:p-6 transition-none"
      >
        <div class="flex items-center justify-between mb-4 md:mb-6">
          <h2 id="reader-toc-title" class="text-[11px] font-bold uppercase tracking-widest text-foreground">contents</h2>
          <button
            bind:this={tocCloseButton}
            onclick={closeToc}
            class="icon-btn -mr-2"
            aria-label="Close contents"
          >
            <Icon svg={ICONS.CLOSE} size={16} />
          </button>
        </div>
        {#if tocError}
          <p role="alert" class="mb-3 text-xs text-rose-500">{tocError}</p>
        {/if}
        {#if toc.length === 0}
          <p class="py-8 text-center text-xs text-foreground/60">No contents available.</p>
        {:else}
          <div class="flex-1 overflow-y-auto pb-6">
            {#each toc as item, index (index)}
              {#if item.target}
                <button
                  onclick={() => void selectTocItem(item, index)}
                  aria-busy={pendingTocIndex === index ? "true" : undefined}
                  style="padding-left: {Math.min(item.level, 3) * 14 + 12}px;"
                  class="flex min-h-11 w-full items-center justify-between gap-3 border-b border-border/30 py-3 pr-3 text-left text-sm leading-5 transition-none cursor-pointer hover:bg-foreground/5 hover:text-foreground active:bg-foreground/10 {pendingTocIndex === index
                    ? 'bg-foreground/10 text-foreground'
                    : item.level === 0
                      ? 'font-semibold text-foreground'
                      : 'text-foreground/70'}"
                >
                  <span class="min-w-0">{item.label || "Untitled section"}</span>
                  {#if pendingTocIndex === index}
                    <span class="shrink-0 text-[10px] font-bold uppercase tracking-widest text-foreground/60" aria-hidden="true"
                      >...</span
                    >
                  {/if}
                </button>
              {:else if item.label}
                <div
                  aria-disabled="true"
                  style="padding-left: {Math.min(item.level, 3) * 14 + 12}px;"
                  class="flex min-h-11 w-full items-center border-b border-border/30 py-3 pr-3 text-sm leading-5 text-foreground/50"
                >
                  {item.label}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if showGoTo}
      <div
        class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none"
      >
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">search</h2>
          <button
            onclick={() => {
              showGoTo = false;
            }}
            class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer"
            >back</button
          >
        </div>
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="flex items-end gap-2 mb-6">
            <div class="flex-1">
              <Input
                id="book-search"
                label="find keyword"
                bind:value={gotoSearch}
                oninput={resetSearchResults}
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
      <div
        class="absolute inset-y-0 right-0 w-full md:w-80 bg-background border-l-0 md:border-l border-border z-10 flex flex-col p-6 transition-none"
      >
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-[10px] font-bold uppercase tracking-widest text-foreground">settings</h2>
          <button
            onclick={() => {
              showSettings = false;
            }}
            class="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-foreground transition-none cursor-pointer"
            >back</button
          >
        </div>
        <div class="space-y-6">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font size (px)</p>
            <div class="flex items-center gap-2">
              <button
                onclick={() => {
                  fontSize = Math.max(8, (Number(fontSize) || 16) - 1);
                  onApplyTypography?.({ fontSize, fontFamily, lineHeight });
                }}
                class="icon-btn font-bold">-</button
              >
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
                onclick={() => {
                  fontSize = Math.min(96, (Number(fontSize) || 16) + 1);
                  onApplyTypography?.({ fontSize, fontFamily, lineHeight });
                }}
                class="icon-btn font-bold">+</button
              >
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">font family</p>
            <div class="grid grid-cols-3 gap-2">
              {#each FONT_OPTIONS as option (option.value)}
                <button
                  onclick={() => {
                    fontFamily = option.value;
                    onApplyTypography?.({ fontSize, fontFamily, lineHeight });
                  }}
                  class="chip {fontFamily === option.value ? 'active' : 'inactive'} py-2">{option.label}</button
                >
              {/each}
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">line spacing</p>
            <div class="flex items-center gap-2">
              <button
                onclick={() => {
                  lineHeight = Math.max(1.0, parseFloat(((Number(lineHeight) || 1.5) - 0.1).toFixed(1)));
                  onApplyTypography?.({ fontSize, fontFamily, lineHeight });
                }}
                class="icon-btn font-bold">-</button
              >
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
                onclick={() => {
                  lineHeight = Math.min(3.0, parseFloat(((Number(lineHeight) || 1.5) + 0.1).toFixed(1)));
                  onApplyTypography?.({ fontSize, fontFamily, lineHeight });
                }}
                class="icon-btn font-bold">+</button
              >
            </div>
          </div>
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">layout</p>
            <div class="grid grid-cols-2 gap-2">
              <button
                onclick={() => {
                  if (flow !== "paginated") onSwitchFlow?.("paginated");
                }}
                class="chip {flow === 'paginated' ? 'active' : 'inactive'} py-2">pages</button
              >
              <button
                onclick={() => {
                  if (flow !== "scrolled") onSwitchFlow?.("scrolled");
                }}
                class="chip {flow === 'scrolled' ? 'active' : 'inactive'} py-2">scroll</button
              >
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
              onApplyTypography?.({ fontSize, fontFamily, lineHeight });
              if (flow !== "paginated") onSwitchFlow?.("paginated");
            }}>reset defaults</Button
          >
        </div>
      </div>
    {/if}
  </div>

  <footer class="shrink-0 h-16 flex items-center justify-between border-t border-border bg-background p-4 md:px-8">
    <button onclick={() => onPrev?.()} class="icon-btn" aria-label="Prev">
      <Icon svg={ICONS.PREV} size={20} />
    </button>
    <div class="icon-toggle-group">
      <button
        onclick={() => {
          showSettings = !showSettings;
          showGoTo = false;
          hideToc();
        }}
        class="icon-btn {showSettings ? 'icon-active' : 'icon-inactive'}"
        aria-label="Typography settings"
      >
        <Icon svg={ICONS.TYPOGRAPHY} size={18} />
      </button>
      <button
        onclick={() => {
          showGoTo = !showGoTo;
          hideToc();
          showSettings = false;
        }}
        class="icon-btn {showGoTo ? 'icon-active' : 'icon-inactive'}"
        aria-label="Search book"
      >
        <Icon svg={ICONS.SEARCH} size={18} />
      </button>
      <button
        bind:this={tocToggleButton}
        onclick={() => void toggleToc()}
        class="icon-btn {showToc ? 'icon-active' : 'icon-inactive'}"
        aria-label="Table of contents"
        aria-expanded={showToc}
        aria-controls="reader-toc"
      >
        <Icon svg={ICONS.TOC} size={18} />
      </button>
    </div>
    <button onclick={() => onNext?.()} class="icon-btn" aria-label="Next">
      <Icon svg={ICONS.NEXT} size={20} />
    </button>
  </footer>
</div>
