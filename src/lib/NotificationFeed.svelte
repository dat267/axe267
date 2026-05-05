<script lang="ts">
  import NotificationCard from './NotificationCard.svelte';
  import Modal from './ui/Modal.svelte';
  import type { Notification } from './notificationService';

  let { title = "Notifications", filter = () => true, notifications = [], onDismiss = () => {} } = $props<{
    title?: string;
    filter?: (n: Notification) => boolean;
    notifications?: Notification[];
    onDismiss?: (id: string) => void;
  }>();

  let selectedNotification = $state<Notification | null>(null);
  let showModal = $state(false);

  let filteredNotifications = $derived(notifications.filter(filter));
  let unreadCount = $derived(filteredNotifications.length);

  function handleView(n: Notification) {
    selectedNotification = n;
    showModal = true;
  }

  function formatFullTime(timestamp: any) {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }
</script>

<div class="mx-auto w-full max-w-3xl p-4 md:p-8">
  <div class="mb-8">
    <h1 class="text-xl font-bold md:text-2xl">{title}</h1>
    <p class="text-xs text-gray-500 dark:text-gray-400 md:text-sm">
      {unreadCount} notifications
    </p>
  </div>

  {#if filteredNotifications.length === 0}
    <div class="mt-20 flex flex-col items-center justify-center text-gray-400">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
        <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
      </svg>
      <p class="mt-4 text-lg">Nothing here yet!</p>
    </div>
  {:else}
    <div class="border-t border-gray-100 dark:border-gray-800/50">
      {#each filteredNotifications as notif (notif.id)}
        <NotificationCard 
          notification={notif} 
          onview={handleView}
          ondismiss={onDismiss}
        />
      {/each}
    </div>
  {/if}
</div>

<Modal 
  show={showModal} 
  title={selectedNotification?.title || "Notification Details"} 
  onClose={() => showModal = false}
>
  {#if selectedNotification}
    <div class="space-y-4">
      <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-400">
        <span>{selectedNotification.source}</span>
        <span class="font-medium tracking-tight text-gray-500 dark:text-gray-400 sm:font-bold sm:tracking-widest">{formatFullTime(selectedNotification.createdAt)}</span>
      </div>
      
      <div class="rounded-lg bg-gray-500/5 p-4">
        <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {selectedNotification.message}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          {selectedNotification.type}
        </span>
        <span class="rounded-full bg-gray-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {selectedNotification.category}
        </span>
      </div>
    </div>
  {/if}
</Modal>
