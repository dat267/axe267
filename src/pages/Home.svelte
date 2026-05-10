<script lang="ts">
    import { Link } from "svelte-routing";
    import { ICONS } from "../lib/utils/icons";

    const APPS = [
        {
            to: "/notifications",
            label: "Notifications",
            icon: ICONS.NOTIFICATION,
        },
        {
            to: "/reader",
            label: "Reader",
            icon: ICONS.BOOK,
        },
        {
            to: "/integrations",
            label: "Integrations",
            icon: ICONS.INTEGRATION,
        },
        {
            to: "/settings",
            label: "Settings",
            icon: ICONS.SETTINGS,
        },
    ];
</script>

<div class="flex flex-1 flex-col">
    <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight lowercase">axe</h1>
    </div>
    <div class="border-t border-border">
        {#each APPS as app}
            <Link 
                to={app.to}
                class="group flex h-20 w-full items-center gap-4 border-b border-border px-1 hover:bg-gray-500/5 transition-colors"
            >
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface dark:bg-white/5 group-hover:bg-foreground group-hover:text-background transition-colors">
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
                        {@html app.icon}
                    </svg>
                </div>
                <span class="text-sm font-bold uppercase tracking-widest text-gray-500 group-hover:text-foreground">{app.label}</span>
            </Link>
        {/each}
    </div>
</div>
