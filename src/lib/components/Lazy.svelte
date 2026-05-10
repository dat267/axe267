<script lang="ts">
    import { onMount } from "svelte";

    let { load, ...props } = $props<{
        load: () => Promise<{ default: any }>;
        [key: string]: any;
    }>();

    let Component = $state<any>(null);

    onMount(async () => {
        const module = await load();
        Component = module.default;
    });
</script>

{#if Component}
    <Component {...props} />
{:else}
    <div class="flex h-20 items-center justify-center">
        <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/30">loading component...</span>
    </div>
{/if}
