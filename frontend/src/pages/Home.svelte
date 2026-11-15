<script lang="ts">
  import { Link } from "svelte5-router";
  import { ICONS, type IconName } from "../lib/utils/icons";
  import { authStore } from "../lib/stores/authStore.svelte.ts";

  interface AppLink {
    to: string;
    label: string;
    icon: IconName;
  }

  const APPS = $derived<AppLink[]>([
    { to: "/notifications", label: "Notifications", icon: "NOTIFICATION" },
    ...(authStore.isAdmin
      ? ([
          { to: "/reader", label: "Reader", icon: "BOOK" },
          { to: "/music", label: "Music", icon: "MUSIC" },
        ] satisfies AppLink[])
      : []),
    { to: "/integrations", label: "Integrations", icon: "INTEGRATION" },
    { to: "/settings", label: "Settings", icon: "SETTINGS" },
  ]);

  $effect(() => {
    const prefetch = () => {
      import("./Notifications.svelte");
      if (authStore.isAdmin) {
        import("./Reader.svelte");
        import("./Music.svelte");
      }
      import("./Integrations.svelte");
      import("./Settings.svelte");
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(prefetch);
    } else {
      setTimeout(prefetch, 1000);
    }
  });
</script>

<div class="flex flex-1 flex-col">
  <div class="mb-8">
    <h1 class="text-2xl font-bold tracking-tight lowercase">axe</h1>
  </div>
  <div class="border-t border-border">
    {#each APPS as app (app.to)}
      <Link
        to={app.to}
        class="group flex h-20 w-full items-center gap-4 border-b border-border px-1 hover:bg-foreground/5 transition-none"
      >
        <div
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground group-hover:bg-foreground group-hover:text-background group-hover:border-foreground transition-none"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d={ICONS[app.icon]} />
          </svg>
        </div>
        <span
          class="text-xs font-bold uppercase tracking-widest text-gray-500 group-hover:text-foreground transition-none"
          >{app.label}</span
        >
      </Link>
    {/each}
  </div>
</div>
