<script lang="ts">
  import type { Notification } from './notificationService';

  let { notification, onview, ondismiss } = $props<{
    notification: Notification;
    onview: (n: Notification) => void;
    ondismiss: (id: string) => void;
  }>();

  const typeColors: Record<string, string> = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500'
  };

  function formatTime(timestamp: any) {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  function handleDismiss(e: MouseEvent) {
    e.stopPropagation();
    ondismiss(notification.id);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  class="group relative flex h-20 w-full items-stretch gap-4 border-b border-gray-100 px-1 py-3 transition-colors hover:bg-gray-50/50 dark:border-gray-800/50 dark:hover:bg-gray-800/30 cursor-pointer"
  onclick={() => onview(notification)}
>
  <!-- Status Vertical Bar -->
  <div class="w-1.5 shrink-0 rounded-full my-1 {typeColors[notification.type] || typeColors.info}"></div>
  
  <div class="flex-grow min-w-0 flex flex-col justify-center">
    <div class="mb-0.5 flex items-center justify-between text-[10px] font-medium tracking-tight text-gray-400 dark:text-gray-500">
      <span class="uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 truncate mr-2">{notification.source}</span>
      <span class="shrink-0">{formatTime(notification.createdAt)}</span>
    </div>
    
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
      {notification.title}
    </h3>
    
    <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
      {notification.message}
    </p>
  </div>

  <!-- Dismiss Button -->
  <div class="flex items-center pr-1 shrink-0">
    <button 
      class="flex items-center justify-center rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 md:invisible md:group-hover:visible"
      onclick={handleDismiss}
      aria-label="Dismiss notification"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</div>
