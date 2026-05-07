<script lang="ts">
    import { Link } from "svelte-routing";

    const APPS = [
        {
            to: "/notifications",
            label: "Notifications",
            icon: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>',
        },
        {
            to: "/integrations",
            label: "Integrations",
            icon: '<path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path>',
        },
        {
            to: "/settings",
            label: "Settings",
            icon: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle>',
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
                class="group flex h-20 w-full items-center gap-4 border-b border-border px-1 hover:bg-gray-500/5"
            >
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface dark:bg-white/5">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        class="text-foreground"
                    >
                        {@html app.icon}
                    </svg>
                </div>
                <span class="text-sm font-bold uppercase tracking-widest text-gray-500 group-hover:text-foreground">{app.label}</span>
            </Link>
        {/each}
    </div>
</div>
