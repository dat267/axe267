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
    getNotificationsCount,
    type Notification,
  } from "./lib/services/notificationService";
  import {
    requestNotificationPermission,
    sendLocalNotification,
  } from "./lib/utils/notificationPermission.ts";
  import Auth from "./pages/Authentication.svelte";
  import Home from "./pages/Home.svelte";
  import Profile from "./pages/Settings.svelte";
  import Integrations from "./pages/Integrations.svelte";
  import Notifications from "./pages/Notifications.svelte";
  import Notes from "./pages/Notes.svelte";

  let { url = "" } = $props();

  let darkMode = $state(true);
  let notifications = $state<Notification[]>([]);
  let totalNotificationsCount = $state(0);
  let notificationLimit = $state(20);
  let initialLoadDone = false;
  let unsubscribe: (() => void) | null = null;
  let currentPath = $state(window.location.pathname);

  // Sync currentPath with navigation
  onMount(() => {
    const handleLocationChange = () => {
      currentPath = window.location.pathname;
    };
    window.addEventListener("popstate", handleLocationChange);
    // Overwrite history methods to detect internal routing
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments as any);
      handleLocationChange();
    };
    return () => window.removeEventListener("popstate", handleLocationChange);
  });

  async function loadTotalNotificationsCount() {
    if (authStore.user?.email) {
      totalNotificationsCount = await getNotificationsCount(authStore.user.email);
    }
  }

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
      loadTotalNotificationsCount();

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
        <div class="flex items-center gap-2">
          {#if currentPath !== "/"}
            <Link
              to="/"
              class="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-500/10"
              aria-label="Back to home"
            >
              {@render icon('<path d="M19 12H5M12 19l-7-7 7-7"></path>', 20)}
            </Link>
          {/if}
          <Link to="/" class="group flex items-center ml-2 transition-all">
            <div class="h-8 w-8 rounded-lg border border-border bg-surface flex items-center justify-center text-foreground font-black text-[10px] shadow-sm transition-all group-hover:border-gray-500/50 group-hover:bg-gray-500/5 dark:bg-white/5 dark:backdrop-blur-md">AXE</div>
          </Link>
        </div>

        <div class="flex items-center gap-2">
          {#if currentPath === "/notifications"}
            <button
              onclick={handleClearAll}
              disabled={notifications.length === 0}
              aria-label="Clear all notifications"
              class="flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-all {showClearConfirm
                ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
                : 'border-border text-foreground hover:bg-gray-500/10'} disabled:opacity-50"
            >
              {#if showClearConfirm}
                {@render icon('<path d="M20 6L9 17l-5-5"></path>')}
              {:else}
                {@render icon(
                  '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
                )}
              {/if}
            </button>
          {/if}
          
          <button
            onclick={toggleTheme}
            class="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-gray-600 transition-colors hover:bg-gray-500/10 dark:text-gray-400"
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
            onclick={handleLogout}
            class="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-red-500 transition-colors hover:bg-red-500/10"
            aria-label="Sign out"
          >
            {@render icon(
              '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>',
            )}
          </button>
        </div>
      </header>

      <main class="flex flex-1 overflow-y-auto overflow-x-hidden">
        <section class="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 md:px-8 md:py-12">
          <Route path="/"><Home /></Route>
          <Route path="/notifications">
            <Notifications
              title="Notifications"
              {notifications}
              totalCount={totalNotificationsCount}
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
  </Router>
{/if}
