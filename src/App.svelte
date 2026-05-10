<script lang="ts">
  import { onMount } from "svelte";
  import { Router, Route, Link, navigate } from "svelte-routing";
  import { signOut } from "firebase/auth";
  import { auth } from "./lib/services/firebase";
  import { authStore } from "./lib/stores/authStore.svelte.ts";
  import { themeStore } from "./lib/stores/themeStore.svelte.ts";
  import { ICONS } from "./lib/utils/icons";
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
  import Lazy from "./lib/components/Lazy.svelte";

  let { url = "" } = $props();

  let notifications = $state<Notification[]>([]);
  let totalNotificationsCount = $state(0);
  let notificationLimit = $state(20);
  let initialLoadDone = false;
  let unsubscribe: (() => void) | null = null;
  let currentPath = $state(window.location.pathname);

  onMount(() => {
    const handleLocationChange = () => { currentPath = window.location.pathname; };
    window.addEventListener("popstate", handleLocationChange);
    const originalPushState = history.pushState;
    history.pushState = function() {
      // @ts-ignore
      originalPushState.apply(this, arguments);
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

  const handleLogout = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
  };

  const dismiss = async (id: string) => {
    try { await deleteNotification(id); } catch (e) { console.error(e); }
  };

  let showClearConfirm = $state(false);
  let confirmTimer: ReturnType<typeof setTimeout>;

  const handleClearAll = async () => {
    if (!showClearConfirm) {
      showClearConfirm = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => { showClearConfirm = false; }, 3000);
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        await clearAllNotifications(token);
        showClearConfirm = false;
        clearTimeout(confirmTimer);
      }
    } catch (e) { console.error(e); }
  };

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
                onClick: () => navigate("/notifications")
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
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    {@html svg}
  </svg>
{/snippet}

{#if authStore.loading}
  <div class="flex h-dvh w-full items-center justify-center overflow-hidden bg-background text-foreground">
    <div class="text-sm font-bold uppercase tracking-widest text-gray-500">loading...</div>
  </div>
{:else if !authStore.user || !authStore.isVerified}
  <Auth />
{:else}
  <Router {url}>
    <div class="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header class="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background p-4 md:px-8">
        <div class="flex items-center gap-2">
          {#if currentPath !== "/"}
            <Link to="/" class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10" aria-label="Back">
              {@render icon(ICONS.BACK, 20)}
            </Link>
          {:else}
            <div class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-gray-600">
              {@render icon(ICONS.BACK, 20)}
            </div>
          {/if}
          <Link to="/" class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10" aria-label="Home">
            {@render icon(ICONS.HOME, 20)}
          </Link>
        </div>

        <div class="flex items-center gap-2">
          {#if currentPath === "/notifications"}
            <button onclick={handleClearAll} disabled={notifications.length === 0} class="flex h-10 w-10 items-center justify-center rounded-lg border {showClearConfirm ? 'border-red-500 bg-red-500 text-white hover:bg-red-600' : 'border-gray-300 bg-white text-gray-900 hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10'} disabled:opacity-50">
              {#if showClearConfirm} {@render icon(ICONS.CHECK, 20)}
              {:else} {@render icon(ICONS.DELETE, 20)} {/if}
            </button>
          {/if}
          <button onclick={() => themeStore.toggleTheme()} class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10" aria-label="Theme">
            {#if themeStore.darkMode} {@render icon(ICONS.SUN, 20)}
            {:else} {@render icon(ICONS.MOON, 20)} {/if}
          </button>
          <button onclick={handleLogout} class="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-red-500 hover:bg-red-50 dark:border-white/20 dark:bg-white/5 dark:hover:bg-red-500/10" aria-label="Sign out">
            {@render icon(ICONS.SIGN_OUT, 20)}
          </button>
        </div>
      </header>

      <main class="flex flex-1 overflow-y-auto overflow-x-hidden">
        <section class="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 py-8 md:p-8">
          <Route path="/"><Home /></Route>
          <Route path="/notifications">
            <Lazy 
              load={() => import("./pages/Notifications.svelte")}
              title="Notifications"
              {notifications}
              totalCount={totalNotificationsCount}
              limit={notificationLimit}
              onLoadMore={loadMore}
              onDismiss={dismiss}
            />
          </Route>
          <Route path="/reader">
            <Lazy load={() => import("./pages/Reader.svelte")} />
          </Route>
          <Route path="/integrations">
            <Lazy load={() => import("./pages/Integrations.svelte")} />
          </Route>
          <Route path="/settings">
            <Lazy load={() => import("./pages/Settings.svelte")} />
          </Route>

          <footer class="mt-auto pt-20 pb-10 text-center">
            <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/30">
              axe &bull; {new Date().getFullYear()}
            </span>
          </footer>
        </section>
      </main>
    </div>
  </Router>
{/if}
