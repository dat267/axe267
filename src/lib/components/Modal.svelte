<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let {
    show = false,
    title = "",
    onClose,
    showCloseButton = true,
    showFooter = true,
    children,
  } = $props<{
    show?: boolean;
    title?: string;
    onClose: () => void;
    showCloseButton?: boolean;
    showFooter?: boolean;
    children?: any;
  }>();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && show) onClose();
  }

  // Prevent scrolling when modal is open
  $effect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
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
  <div
    class="fixed inset-0 z-100 flex items-center justify-center p-4"
  >
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-black/40"
      onclick={onClose}
    ></div>

    <!-- Modal Content -->
    <div
      class="relative w-full max-w-lg overflow-hidden rounded-xl bg-surface p-6"
    >
      <div class="mb-4 flex items-center justify-between">
        <h3 class="text-lg font-bold text-foreground">{title}</h3>
        {#if showCloseButton}
          <button
            onclick={onClose}
            class="rounded-full p-1 text-gray-400 hover:bg-gray-500/10 hover:text-gray-600 dark:hover:text-gray-200"
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
            class="rounded-lg bg-gray-500/10 px-4 py-2 text-sm font-semibold hover:bg-gray-500/20"
          >
            Close
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
