<script lang="ts">
    import Modal from "../lib/components/Modal.svelte";
    import Input from "../lib/components/Input.svelte";
    import type { Notification } from "../lib/services/notificationService";
    import { CATEGORY_LABELS, TYPE_COLORS } from "../lib/utils/constants";

    let {
        title = "Notifications",
        notifications = [],
        totalCount = 0,
        limit = 20,
        onLoadMore = () => {},
        onDismiss = () => {},
    } = $props<{
        title?: string;
        notifications?: Notification[];
        totalCount?: number;
        limit?: number;
        onLoadMore?: () => void;
        onDismiss?: (id: string) => void;
    }>();

    let selectedNotification = $state<Notification | null>(null);
    let showModal = $state(false);
    let selectedCategory = $state("all");
    let searchQuery = $state("");
    let observerTarget = $state<HTMLElement | null>(null);

    let filteredNotifications = $derived(
        notifications.filter((n: Notification) => {
            const matchesCategory = selectedCategory === "all" ? true : n.category === selectedCategory;
            const matchesSearch = !searchQuery.trim() || 
                n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                n.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                n.source.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        })
    );
    let unreadCount = $derived(filteredNotifications.length);

    function handleClose() {
        showModal = false;
    }

    $effect(() => {
        if (!observerTarget) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && notifications.length >= limit && notifications.length < totalCount) {
                onLoadMore();
            }
        }, { threshold: 0 });

        observer.observe(observerTarget);
        return () => observer.disconnect();
    });

    function formatTime(timestamp: any, full = false) {
        if (!timestamp) return "Just now";
        const date = timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp);
        if (full) return date.toLocaleString();

        const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (diff < 60) return "Just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

        return date.toLocaleDateString();
    }

    function handleView(n: Notification) {
        selectedNotification = n;
        showModal = true;
    }

    function handleDismiss(e: MouseEvent, id: string) {
        e.stopPropagation();
        onDismiss(id);
    }
</script>

{#snippet notificationCard(notif: Notification)}
  <div
    class="group relative flex h-20 w-full cursor-pointer items-stretch gap-4 border-b border-border px-1 py-3 hover:bg-foreground/5 transition-none"
    onclick={() => handleView(notif)}
    onkeydown={(e) => e.key === 'Enter' && handleView(notif)}
    role="button"
    tabindex="0"
  >
    <div class="my-1 w-1.5 shrink-0 rounded-full {TYPE_COLORS[notif.type as keyof typeof TYPE_COLORS] || TYPE_COLORS.info}"></div>
    <div class="flex min-w-0 grow flex-col justify-center">
      <div class="mb-0.5 flex items-center justify-between text-[10px] font-bold tracking-tight text-gray-500">
        <span class="mr-2 truncate font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{notif.source}</span>
        <span class="shrink-0 uppercase tracking-widest text-[9px]">{formatTime(notif.createdAt)}</span>
      </div>
      <h3 class="truncate text-sm font-bold text-foreground">{notif.title}</h3>
      <p class="truncate text-xs text-gray-500 dark:text-gray-400">{notif.message}</p>
    </div>
    <div class="flex shrink-0 items-center pr-1">
      <button
        class="flex items-center justify-center rounded-md border border-transparent p-2 text-gray-400 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-none cursor-pointer"
        onclick={(e) => handleDismiss(e, notif.id)}
        aria-label="Dismiss notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  </div>
{/snippet}
<div>
  <div class="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
    <h1 class="text-2xl font-bold tracking-tight lowercase">notifications</h1>
    <div class="flex w-full gap-1 rounded-md border border-border bg-background p-1 sm:w-auto">
      {#each CATEGORY_LABELS as cat}
        <button
          onclick={() => (selectedCategory = cat.id)}
          class="flex-1 rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer sm:flex-none {selectedCategory === cat.id ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}"
        >
          {cat.label}
        </button>
      {/each}
    </div>
  </div>
  <div class="mb-6">
    <Input 
      id="searchQuery"
      bind:value={searchQuery}
      placeholder="Search notifications by title, message, or source..."
    />
  </div>
  {#if filteredNotifications.length === 0}
    <div class="mt-20 flex flex-col items-center justify-center text-gray-500">
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        opacity="0.3"
      >
        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
      </svg>
      <p class="mt-4 text-xs font-bold uppercase tracking-widest text-gray-500/60">Nothing here yet!</p>
    </div>
  {:else}
    <div class="border-t border-border">
      {#each filteredNotifications as notif (notif.id)}
        {@render notificationCard(notif)}
      {/each}
    </div>
    <div bind:this={observerTarget} class="h-10 w-full"></div>
  {/if}
</div>
<Modal
  show={showModal}
  title={selectedNotification?.title || "Notification Details"}
  onClose={handleClose}
>
  {#if selectedNotification}
    <div class="space-y-4">
      <div class="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:flex-row sm:items-start sm:justify-between">
        <span class="break-words">{selectedNotification.source}</span>
        <span class="shrink-0 text-gray-500">{formatTime(selectedNotification.createdAt, true)}</span>
      </div>
      <div class="rounded-md border border-border bg-background p-4">
        <p class="wrap-break-word whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {selectedNotification.message}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-md border border-border bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
          {selectedNotification.type}
        </span>
        <span class="rounded-md border border-border bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
          {selectedNotification.category}
        </span>
      </div>
    </div>
  {/if}
</Modal>
