<script>
  import { onMount } from "svelte";
  import { Router, Route, Link, navigate } from "svelte-routing";
  import { signOut } from "firebase/auth";
  import { auth } from "./lib/services/firebase";
  import { authStore } from "./lib/stores/authStore.svelte.js";
  import { themeStore } from "./lib/stores/themeStore.svelte.js";
  import { ICONS } from "./lib/utils/icons";
  import {
    subscribeNotifications,
    deleteNotification,
    clearAllNotifications,
    getNotificationsCount,
  } from "./lib/services/notificationService";
  import {
    requestNotificationPermission,
    sendLocalNotification,
  } from "./lib/utils/notificationPermission.js";
  import Icon from "./lib/components/Icon.svelte";
  import Home from "./pages/Home.svelte";
  import Lazy from "./lib/components/Lazy.svelte";

  let { url = "" } = $props();

  let notifications = $state([]);
  let totalNotificationsCount = $state(0);
  let notificationLimit = $state(20);
  let initialLoadDone = false;
  let unsubscribe = null;
  let currentPath = $state(window.location.pathname);

  onMount(() => {
    const handleLocationChange = () => { currentPath = window.location.pathname; };
    window.addEventListener("popstate", handleLocationChange);
    const originalPushState = history.pushState;
    history.pushState = function() {
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

  const dismiss = async (id) => {
    try { await deleteNotification(id); } catch (e) { console.error(e); }
  };

  let showClearConfirm = $state(false);
  let isDeleting = $state(false);
  let confirmTimer;

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
        isDeleting = true;
        await clearAllNotifications(token);
        showClearConfirm = false;
        clearTimeout(confirmTimer);
      }
    } catch (e) {
      console.error(e);
      isDeleting = false;
    }
  };

  $effect(() => {
    const user = authStore.user;
    if (user && authStore.isVerified) {
      if (unsubscribe) unsubscribe();
      requestNotificationPermission();
      loadTotalNotificationsCount();

      unsubscribe = subscribeNotifications(
        user.email,
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
          if (isDeleting && data.length === 0) {
            isDeleting = false;
          }
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

{#if authStore.loading}
  <div class="flex h-dvh w-full items-center justify-center overflow-hidden bg-background text-foreground">
    <div class="text-sm font-bold uppercase tracking-widest text-gray-500">loading...</div>
  </div>
{:else if !authStore.user || !authStore.isVerified}
  <Lazy load={() => import("./pages/Authentication.svelte")} />
{:else}
  <Router {url}>
    <div class="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header class="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background p-4 md:px-8">
        <div class="flex items-center gap-2">
          {#if currentPath !== "/"}
            <Link to="/" class="icon-btn" aria-label="Back">
              <Icon svg={ICONS.BACK} size={20} />
            </Link>
          {:else}
            <div class="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background text-gray-300 dark:text-gray-700 select-none cursor-not-allowed">
              <Icon svg={ICONS.BACK} size={20} />
            </div>
          {/if}
          <Link to="/" class="icon-btn" aria-label="Home">
            <Icon svg={ICONS.HOME} size={20} />
          </Link>
        </div>
        <div class="flex items-center gap-2">
          {#if currentPath === "/notifications"}
            <button onclick={handleClearAll} disabled={notifications.length === 0 || isDeleting} class="icon-btn {showClearConfirm ? '!border-rose-500 !bg-rose-500 !text-white hover:!bg-rose-600 hover:!border-rose-600' : ''}">
              {#if isDeleting}
                <span class="text-sm font-bold font-mono">...</span>
              {:else if showClearConfirm} 
                <Icon svg={ICONS.CHECK} size={20} />
              {:else} 
                <Icon svg={ICONS.DELETE} size={20} /> 
              {/if}
            </button>
          {/if}
          <button onclick={() => themeStore.toggleTheme()} class="icon-btn" aria-label="Theme">
            {#if themeStore.darkMode} <Icon svg={ICONS.SUN} size={20} />
            {:else} <Icon svg={ICONS.MOON} size={20} /> {/if}
          </button>
          <button onclick={handleLogout} class="icon-btn danger" aria-label="Sign out">
            <Icon svg={ICONS.SIGN_OUT} size={20} />
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
            {#if authStore.isAdmin}
              <Lazy load={() => import("./pages/Reader.svelte")} />
            {:else}
              <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="mb-6 rounded-full border border-rose-500/20 bg-rose-500/5 p-4 text-rose-500">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <h1 class="text-xl font-bold tracking-tight lowercase">access denied</h1>
                <p class="mt-2 max-w-sm text-xs font-semibold uppercase tracking-wider text-gray-500">
                  this module is restricted to administrators only.
                </p>
                <Link to="/" class="mt-8 flex h-10 items-center justify-center rounded-md border border-border bg-surface px-6 text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-foreground hover:text-background hover:border-foreground cursor-pointer transition-none select-none">
                  go home
                </Link>
              </div>
            {/if}
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
