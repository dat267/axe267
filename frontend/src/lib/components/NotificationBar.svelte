<script>
  import Icon from "./Icon.svelte";
  import { ICONS } from "../utils/icons";

  let {
    currentPath = "/",
    notifications = [],
    themeMode = "dark",
    onThemeCycle,
    onSignOut,
    onClearAll,
  } = $props();

  let showClearConfirm = $state(false);
  let isDeleting = $state(false);
  let confirmTimer;

  async function handleClearAll() {
    if (!showClearConfirm) {
      showClearConfirm = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { showClearConfirm = false; }, 3000);
      return;
    }
    showClearConfirm = false;
    clearTimeout(confirmTimer);
    isDeleting = true;
    try {
      await onClearAll?.();
    } finally {
      isDeleting = false;
    }
  }
</script>

<header class="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background p-4 md:px-8">
  <div class="flex items-center gap-2">
    {#if currentPath !== "/"}
      <a href="/" class="icon-btn" aria-label="Back">
        <Icon svg={ICONS.BACK} size={20} />
      </a>
    {:else}
      <div class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-gray-300 dark:text-gray-700 select-none cursor-not-allowed">
        <Icon svg={ICONS.BACK} size={20} />
      </div>
    {/if}
    <a href="/" class="icon-btn" aria-label="Home">
      <Icon svg={ICONS.HOME} size={20} />
    </a>
  </div>
  <div class="flex items-center gap-2">
    {#if currentPath === "/notifications"}
      <button
        onclick={handleClearAll}
        disabled={notifications.length === 0 || isDeleting}
        class="icon-btn {showClearConfirm ? '!border-rose-500 !bg-rose-500 !text-white hover:!bg-rose-600 hover:!border-rose-600' : ''}"
        aria-label={showClearConfirm ? "Confirm clear all" : "Clear all notifications"}
      >
        {#if isDeleting}
          <span class="text-sm font-bold font-mono">...</span>
        {:else if showClearConfirm}
          <Icon svg={ICONS.CHECK} size={20} />
        {:else}
          <Icon svg={ICONS.DELETE} size={20} />
        {/if}
      </button>
    {/if}
    <button onclick={onThemeCycle} class="icon-btn" aria-label="Cycle theme">
      {#if themeMode === "dark"}
        <Icon svg={ICONS.MOON} size={20} />
      {:else if themeMode === "light"}
        <Icon svg={ICONS.SUN} size={20} />
      {:else}
        <Icon svg={ICONS.MONITOR} size={20} />
      {/if}
    </button>
    <button onclick={onSignOut} class="icon-btn danger" aria-label="Sign out">
      <Icon svg={ICONS.SIGN_OUT} size={20} />
    </button>
  </div>
</header>