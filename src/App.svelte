<script lang="ts">
  import { onMount } from "svelte";
  import { Router, Route, Link } from "svelte-routing";
  import { signOut } from "firebase/auth";
  import { auth } from "./lib/services/firebase";
  import { authStore } from "./lib/stores/authStore.svelte.ts";
  import {
    subscribeNotifications,
    deleteNotification,
    clearAllNotifications,
    type Notification,
  } from "./lib/services/notificationService";
  import {
    requestNotificationPermission,
    sendLocalNotification,
  } from "./lib/utils/notificationPermission.ts";
  import Auth from "./pages/Authentication.svelte";
  import Profile from "./pages/Settings.svelte";
  import Integrations from "./pages/Integrations.svelte";
  import Notifications from "./pages/Notifications.svelte";
  import Notes from "./pages/Notes.svelte";

  let { url = "" } = $props();

  const NAV_LINKS = [
    {
      to: "/notifications",
      label: "Notifications",
      icon: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
    },
    {
      to: "/notes",
      label: "Notes",
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
    },
    {
      to: "/integrations",
      label: "Integrations",
      icon: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"></path>',
    },
    {
      to: "/settings",
      label: "Settings",
      icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
    },
  ];

  let darkMode = $state(true);
  let sidebarOpen = $state(false);
  let notifications = $state<Notification[]>([]);
  let notificationLimit = $state(20);
  let initialLoadDone = false;
  let unsubscribe: (() => void) | null = null;

  const loadMore = () => {
    notificationLimit += 20;
  };

  const toggleTheme = () => {
    darkMode = !darkMode;
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    applyTheme();
  };

  const applyTheme = () => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    root.style.backgroundColor = darkMode
      ? "hsl(220 10% 10%)"
      : "hsl(0 0% 98%)";
  };
const handleLogout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }
};

const dismiss = async (id: string) => {
  try {
    await deleteNotification(id);
  } catch (e) {
    console.error(e);
  }
};

let showClearConfirm = $state(false);
let confirmTimer: ReturnType<typeof setTimeout>;

const handleClearAll = async () => {
  if (!showClearConfirm) {
    showClearConfirm = true;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => {
      showClearConfirm = false;
    }, 3000);
    return;
  }

  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      await clearAllNotifications(token);
      showClearConfirm = false;
      clearTimeout(confirmTimer);
    }
  } catch (e) {
    console.error(e);
  }
};

const getLinkProps = ({ isCurrent }: { isCurrent: boolean }) => ({
    class: `flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-colors ${
      isCurrent
        ? "font-semibold bg-gray-500/10 text-foreground"
        : "font-medium hover:bg-gray-500/10"
    }`,
  });

  onMount(() => {
    const saved = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    darkMode = saved === "dark" || (!saved && prefers);
    applyTheme();
  });

  $effect(() => {
    const user = authStore.user;
    if (user && authStore.isVerified) {
      if (unsubscribe) unsubscribe();
      requestNotificationPermission();

      unsubscribe = subscribeNotifications(
        user.email!,
        (data) => {
          if (initialLoadDone && data.length > 0) {
            const newest = data[0];
            const isTrulyNew = !notifications.some((n) => n.id === newest.id);

            if (isTrulyNew) {
              sendLocalNotification(newest.title, {
                body: `${newest.source}: ${newest.message}`,
                tag: newest.id,
              });
            }
          }
          notifications = data;
          initialLoadDone = true;
        },
        notificationLimit,
      );
    } else if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
      notifications = [];
      initialLoadDone = false;
    }
    return () => unsubscribe?.();
  });
</script>

{#snippet icon(svg: string, size = 18)}
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  >
    {@html svg}
  </svg>
{/snippet}

{#snippet navList(links: typeof NAV_LINKS, isMobile = false)}
  <nav class="flex flex-col gap-1 p-4">
    {#each links as link}
      <Link
        to={link.to}
        onclick={() => isMobile && (sidebarOpen = false)}
        getProps={getLinkProps}
      >
        {@render icon(link.icon)}
        {link.label}
      </Link>
    {/each}
  </nav>
{/snippet}

{#snippet sidebar(isMobile = false)}
  <div class="flex h-full flex-col bg-surface">
    <div class={isMobile ? "" : "pt-4"}>
      {@render navList(NAV_LINKS, isMobile)}
    </div>

    <div class="mt-auto border-t border-border p-4 flex flex-col gap-1">
      <div class="px-4 py-2 text-xs font-medium text-foreground/50 truncate">
        {authStore.user?.email}
      </div>
      <button
        onclick={handleLogout}
        class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
      >
        {@render icon(
          '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
        )}
        Sign Out
      </button>
    </div>
  </div>
{/snippet}

{#if authStore.loading}
  <div
    class="flex h-screen w-full items-center justify-center bg-background text-foreground"
  >
    <div
      class="h-10 w-10 animate-spin rounded-full border-4 border-gray-500 border-t-transparent"
    ></div>
  </div>
{:else if !authStore.user || !authStore.isVerified}
  <Auth />
{:else}
  <Router {url}>
    <div
      class="flex h-screen w-full flex-col bg-background text-foreground transition-colors duration-300"
    >
      <header
        class="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-md md:px-8"
      >
        <div class="flex items-center gap-4">
          <button
            class="md:hidden text-gray-500 hover:bg-gray-500/10 rounded-lg p-2 transition-colors"
            onclick={() => (sidebarOpen = !sidebarOpen)}
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            {#if sidebarOpen}
              {@render icon(
                '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
                24,
              )}
            {:else}
              {@render icon(
                '<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>',
                24,
              )}
            {/if}
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            onclick={toggleTheme}
            class="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-gray-600 hover:bg-gray-500/10 dark:text-gray-400"
            aria-label="Toggle theme"
          >
            {#if darkMode}
              {@render icon(
                '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
              )}
            {:else}
              {@render icon(
                '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
              )}
            {/if}
          </button>
          <button
            onclick={handleClearAll}
            disabled={notifications.length === 0}
            class="flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all {showClearConfirm
              ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
              : 'border-border text-foreground hover:bg-gray-500/10'} disabled:opacity-50"
          >
            {#if showClearConfirm}
              {@render icon('<path d="M20 6L9 17l-5-5"></path>')}
              <span>Confirm?</span>
            {:else}
              {@render icon(
                '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
              )}
              <span class="hidden sm:inline">Clear All</span>
            {/if}
          </button>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden relative">
        <aside class="hidden w-64 shrink-0 flex-col border-r border-border md:flex">
          {@render sidebar()}
        </aside>

        {#if sidebarOpen}
          <div
            class="fixed inset-0 top-16 z-40 bg-black/20 md:hidden"
            onclick={() => (sidebarOpen = false)}
            aria-hidden="true"
          ></div>
        {/if}
        <aside
          class="fixed inset-x-0 bottom-0 top-16 z-50 transform transition-transform duration-300 md:hidden {sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'}"
        >
          {@render sidebar(true)}
        </aside>

        <main class="flex grow min-w-0 flex-col overflow-y-auto">
          <section class="flex flex-col">
            <Route path="/notifications">
              <Notifications
                title="Notifications"
                {notifications}
                limit={notificationLimit}
                onLoadMore={loadMore}
                onDismiss={dismiss}
              />
            </Route>
            <Route path="/notes"><Notes /></Route>
            <Route path="/integrations"><Integrations /></Route>
            <Route path="/settings"><Profile /></Route>
          </section>
        </main>
      </div>
    </div>
  </Router>
{/if}
