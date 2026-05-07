<script lang="ts">
    import Modal from "../lib/components/Modal.svelte";
    import Input from "../lib/components/Input.svelte";
    import type { Notification } from "../lib/services/notificationService";

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

    const categories = [
        { id: "all", label: "All" },
        { id: "system", label: "System" },
        { id: "mobile", label: "Mobile" },
        { id: "desktop", label: "Desktop" },
    ];

    let filteredNotifications = $derived(
        notifications.filter((n) => {
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

    const typeColors: Record<string, string> = {
        info: "bg-gray-500",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        error: "bg-rose-500",
    };

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
        class="group relative flex h-20 w-full cursor-pointer items-stretch gap-4 border-b border-gray-100 px-1 py-3 hover:bg-gray-100/50 dark:border-gray-800/50 dark:hover:bg-gray-800/30"
        onclick={() => handleView(notif)}
        onkeydown={(e) => e.key === 'Enter' && handleView(notif)}
        role="button"
        tabindex="0"
    >
        <div
            class="my-1 w-1.5 shrink-0 rounded-full {typeColors[notif.type] ||
                typeColors.info}"
        ></div>

        <div class="flex min-w-0 grow flex-col justify-center">
            <div
                class="mb-0.5 flex items-center justify-between text-[10px] font-medium tracking-tight text-gray-400 dark:text-gray-500"
            >
                <span
                    class="mr-2 truncate font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >{notif.source}</span
                >
                <span class="shrink-0">{formatTime(notif.createdAt)}</span>
            </div>
            <h3
                class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
                {notif.title}
            </h3>
            <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                {notif.message}
            </p>
        </div>

        <div class="flex shrink-0 items-center pr-1">
            <button
                class="flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
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
        <h1 class="text-2xl font-bold tracking-tight">{title}</h1>
        <div class="flex w-full gap-1 rounded-lg bg-gray-500/5 p-1 sm:w-auto">
            {#each categories as cat}
                <button
                    onclick={() => (selectedCategory = cat.id)}
                    class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold sm:flex-none {selectedCategory ===
                    cat.id
                        ? 'bg-white text-foreground dark:bg-gray-700 dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
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
        <div
            class="mt-20 flex flex-col items-center justify-center text-gray-400"
        >
            <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
                opacity="0.3"
                ><path
                    d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"
                ></path></svg
            >
            <p class="mt-4 text-lg">Nothing here yet!</p>
        </div>
    {:else}
        <div class="border-t border-gray-100 dark:border-gray-800/50">
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
            <div
                class="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 sm:flex-row sm:items-start sm:justify-between sm:text-xs"
            >
                <span class="break-words">{selectedNotification.source}</span>
                <span
                    class="shrink-0 font-medium tracking-tight text-gray-500 dark:text-gray-400 sm:font-bold sm:tracking-widest"
                    >{formatTime(selectedNotification.createdAt, true)}</span
                >
            </div>

            <div class="rounded-lg bg-gray-500/5 p-4">
                <p
                    class="wrap-break-word whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300"
                >
                    {selectedNotification.message}
                </p>
            </div>

            <div class="flex items-center gap-2">
                <span
                    class="rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400"
                >
                    {selectedNotification.type}
                </span>
                <span
                    class="rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                >
                    {selectedNotification.category}
                </span>
            </div>
        </div>
    {/if}
</Modal>
