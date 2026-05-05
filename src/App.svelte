<script lang="ts">
  import { onMount } from 'svelte';
  import { Router, Route, Link } from "svelte-routing";
  import { signOut } from "firebase/auth";
  import { auth } from "./lib/firebase";
  import { authStore } from "./lib/authStore.svelte.ts";
  import { subscribeNotifications, deleteNotification, type Notification } from "./lib/notificationService";
  import { requestNotificationPermission, sendLocalNotification } from "./lib/notificationPermission";
  import NotificationFeed from './lib/NotificationFeed.svelte';
  import Login from './lib/Login.svelte';
  import Profile from './lib/Profile.svelte';
  import VerifyEmail from './lib/VerifyEmail.svelte';
  import Instructions from './lib/Instructions.svelte';

  let { url = "" } = $props();

  let darkMode = $state(true);
  let sidebarOpen = $state(false);
  let notifications = $state<Notification[]>([]);
  let knownNotificationIds = new Set<string>();
  let unsubscribe: (() => void) | null = null;
  let initialLoadDone = false;

  onMount(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    darkMode = savedTheme === 'dark' || (!savedTheme && prefersDark);
    applyTheme();
  });

  // Watch for auth changes using $effect
  $effect(() => {
    const u = authStore.user;
    const isVerified = authStore.isVerified;

    if (u && isVerified) {
      if (unsubscribe) unsubscribe();
      
      requestNotificationPermission();

      unsubscribe = subscribeNotifications(u.email!, (data) => {
        if (initialLoadDone && data.length > 0) {
          const newest = data[0];
          if (newest.id !== lastNotificationId) {
            sendLocalNotification(newest.title, {
              body: `${newest.source}: ${newest.message}`,
              tag: newest.id
            });
          }
        }
        
        notifications = data;
        if (data.length > 0) {
          lastNotificationId = data[0].id;
        }
        initialLoadDone = true;
      });
    } else {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        notifications = [];
        initialLoadDone = false;
      }
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  function toggleTheme() {
    darkMode = !darkMode;
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    applyTheme();
  }

  function applyTheme() {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = 'hsl(222 47% 11%)';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = 'hsl(210 40% 98%)';
    }
  }

  async function dismiss(id: string) {
    try {
      await deleteNotification(id);
    } catch (e) {
      console.error("Failed to delete notification", e);
    }
  }
  
  async function clearAll() {
    if (!confirm("Are you sure you want to clear all notifications?")) return;
    for (const n of notifications) {
      await deleteNotification(n.id);
    }
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Logout failed", e);
    }
  }
</script>

{#if authStore.loading}
  <div class="flex h-screen w-full items-center justify-center bg-background text-foreground">
    <div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
  </div>
{:else if !authStore.user}
  <Login />
{:else if !authStore.isVerified}
  <VerifyEmail />
{:else}
  <Router {url}>
    <div class="flex h-screen w-full bg-background text-foreground transition-colors duration-300">
      <!-- Sidebar for desktop -->
      <aside class="hidden w-64 flex-col border-r border-border bg-surface md:flex">
        <div class="flex items-center gap-3 border-b border-border p-6 text-blue-600 dark:text-blue-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path>
          </svg>
          <h2 class="text-xl font-bold">NotifiDash</h2>
        </div>
        
        <nav class="flex flex-col gap-1 p-4">
          <Link to="/" class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10" getProps={({ isCurrent }) => isCurrent ? { class: "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
            All
          </Link>
          <Link to="/system" class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10" getProps={({ isCurrent }) => isCurrent ? { class: "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            System
          </Link>
          <Link to="/mobile" class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10" getProps={({ isCurrent }) => isCurrent ? { class: "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
            Mobile
          </Link>
          <Link to="/desktop" class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10" getProps={({ isCurrent }) => isCurrent ? { class: "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            Desktop
          </Link>
          <div class="my-4 border-t border-border"></div>
          <Link to="/instructions" class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10" getProps={({ isCurrent }) => isCurrent ? { class: "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"></path></svg>
            CLI Integration
          </Link>
          <Link to="/profile" class="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10" getProps={({ isCurrent }) => isCurrent ? { class: "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400" } : {}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Settings
          </Link>
        </nav>

        <div class="mt-auto border-t border-border p-4">
          <div class="flex items-center gap-3 px-4 py-2">
            <div class="h-8 w-8 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
              {authStore.user?.email?.[0].toUpperCase()}
            </div>
            <div class="flex flex-col overflow-hidden">
              <span class="text-xs font-semibold truncate">{authStore.user?.email}</span>
              <button onclick={handleLogout} class="text-[10px] text-left text-red-500 hover:underline">Sign Out</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Mobile Sidebar Overlay -->
      {#if sidebarOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="fixed inset-0 z-40 bg-black/20 transition-opacity md:hidden" onclick={toggleSidebar}></div>
      {/if}

      <!-- Mobile Sidebar -->
      <aside class="fixed inset-y-0 left-0 z-50 w-64 transform bg-surface transition-transform duration-300 md:hidden {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}">
        <div class="flex items-center justify-between border-b border-border p-6 text-blue-600 dark:text-blue-400">
          <div class="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path></svg>
            <h2 class="text-xl font-bold">NotifiDash</h2>
          </div>
          <button onclick={toggleSidebar} class="text-gray-500" aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <nav class="flex flex-col gap-1 p-4">
          <Link to="/" onclick={toggleSidebar} class="px-4 py-2 rounded-lg text-sm" getProps={({ isCurrent }) => isCurrent ? { class: "px-4 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" } : {}}>All Notifications</Link>
          <Link to="/system" onclick={toggleSidebar} class="px-4 py-2 rounded-lg text-sm" getProps={({ isCurrent }) => isCurrent ? { class: "px-4 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" } : {}}>System Alerts</Link>
          <Link to="/mobile" onclick={toggleSidebar} class="px-4 py-2 rounded-lg text-sm" getProps={({ isCurrent }) => isCurrent ? { class: "px-4 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" } : {}}>Mobile Devices</Link>
          <Link to="/desktop" onclick={toggleSidebar} class="px-4 py-2 rounded-lg text-sm" getProps={({ isCurrent }) => isCurrent ? { class: "px-4 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" } : {}}>Desktop</Link>
          <Link to="/instructions" onclick={toggleSidebar} class="px-4 py-2 rounded-lg text-sm" getProps={({ isCurrent }) => isCurrent ? { class: "px-4 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" } : {}}>CLI Integration</Link>
          <Link to="/profile" onclick={toggleSidebar} class="px-4 py-2 rounded-lg text-sm" getProps={({ isCurrent }) => isCurrent ? { class: "px-4 py-2 rounded-lg text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold" } : {}}>Settings</Link>
          <button onclick={handleLogout} class="mt-4 px-4 py-2 text-left text-red-500 font-medium text-sm">Sign Out</button>
        </nav>
      </aside>

      <main class="flex flex-grow flex-col overflow-y-auto">
        <header class="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-md md:px-8 md:py-6">
          <div class="flex items-center gap-4">
            <button class="text-gray-500 md:hidden" onclick={toggleSidebar} aria-label="Open sidebar">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div>
              <h1 class="text-xl font-bold md:text-2xl">Dashboard</h1>
              <p class="text-xs text-gray-400 md:text-sm">
                Real-time monitoring
              </p>
            </div>
          </div>
          
          <div class="flex items-center gap-2 md:gap-4">
            <button onclick={toggleTheme} class="rounded-lg border border-border p-2 text-gray-600 transition-colors hover:bg-gray-500/10 dark:text-gray-400 dark:hover:bg-gray-500/20" aria-label="Toggle theme">
              {#if darkMode}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              {/if}
            </button>
            <button 
              class="hidden rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-500/10 dark:hover:bg-gray-500/20 sm:block disabled:opacity-50" 
              onclick={clearAll}
              disabled={notifications.length === 0}
            >
              Clear All
            </button>
          </div>
        </header>

        <Route path="/">
          <NotificationFeed title="All Notifications" {notifications} onDismiss={dismiss} />
        </Route>
        <Route path="/system">
          <NotificationFeed title="System Alerts" filter={(n) => n.category === 'system'} {notifications} onDismiss={dismiss} />
        </Route>
        <Route path="/mobile">
          <NotificationFeed title="Mobile Devices" filter={(n) => n.category === 'mobile'} {notifications} onDismiss={dismiss} />
        </Route>
        <Route path="/desktop">
          <NotificationFeed title="Desktop Notifications" filter={(n) => n.category === 'desktop'} {notifications} onDismiss={dismiss} />
        </Route>
        <Route path="/instructions">
          <Instructions />
        </Route>
        <Route path="/profile">
          <Profile />
        </Route>
      </main>
    </div>
  </Router>
{/if}
