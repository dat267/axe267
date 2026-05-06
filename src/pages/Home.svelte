<script lang="ts">
    import { Link } from "svelte-routing";

    const APPS = [
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
            icon: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>',
        },
    ];
</script>

<div class="flex flex-1 flex-col justify-center">
    <div class="mb-16 text-center">
        <h1 class="text-4xl font-black tracking-tighter md:text-6xl text-foreground lowercase">axe</h1>
        <p class="mt-3 text-sm font-medium text-gray-400 dark:text-gray-500 md:text-xl">Central Hub</p>
    </div>

    <div class="grid grid-cols-2 gap-6 sm:grid-cols-4 md:gap-10">
        {#each APPS as app}
            <Link 
                to={app.to}
                class="group flex flex-col items-center gap-4 transition-all hover:-translate-y-1"
            >
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm transition-all group-hover:border-gray-500/50 group-hover:bg-gray-500/5 group-hover:shadow-lg dark:bg-white/5 dark:backdrop-blur-xl md:h-24 md:w-24 md:rounded-3xl">
                    <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-foreground transition-all group-hover:scale-110 md:h-12 md:w-12"
                    >
                        {@html app.icon}
                    </svg>
                </div>
                <span class="text-xs font-bold tracking-tight text-gray-500 transition-colors group-hover:text-foreground md:text-sm">{app.label}</span>
            </Link>
        {/each}
    </div>

    <div class="mt-24 text-center">
        <div class="inline-flex items-center gap-2 rounded-full border border-border bg-surface/30 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 backdrop-blur-sm">
            <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-20"></span>
                <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-foreground/40"></span>
            </span>
            Operational
        </div>
    </div>
</div>
