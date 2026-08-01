<script>
  import { onMount, onDestroy, tick } from "svelte";

  let {
    show = false,
    title = "",
    onClose,
    showCloseButton = true,
    showFooter = true,
    children,
  } = $props();

  let dialogEl = $state();
  let lastFocused;

  function getFocusable() {
    if (!dialogEl) return [];
    return Array.from(
      dialogEl.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  function handleKeydown(e) {
    if (!show) return;
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  $effect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
      lastFocused = document.activeElement;
      tick().then(() => {
        const focusable = getFocusable();
        (focusable[0] || dialogEl)?.focus();
      });
    } else {
      document.body.style.overflow = "";
      lastFocused?.focus?.();
      lastFocused = null;
    }
  });

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = "";
    }
  });
</script>

{#if show}
  <div class="fixed inset-0 z-100 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40" onclick={onClose} aria-hidden="true"></div>

    <div
      bind:this={dialogEl}
      class="relative w-full max-w-lg overflow-hidden rounded-md border border-border bg-surface p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
    >
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-sm font-bold uppercase tracking-wider text-foreground">{title}</h3>
        {#if showCloseButton}
          <button
            onclick={onClose}
            class="rounded-md border border-transparent p-1.5 text-gray-400 hover:bg-foreground/5 hover:text-foreground transition-none cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        {/if}
      </div>

      <div class="max-h-[70dvh] overflow-y-auto pr-2">
        {@render children?.()}
      </div>

      {#if showFooter}
        <div class="mt-8 flex justify-end">
          <button
            onclick={onClose}
            class="rounded-md border border-border bg-surface px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-none cursor-pointer select-none"
          >
            Close
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
