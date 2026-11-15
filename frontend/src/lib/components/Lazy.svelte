<script lang="ts">
  import type { Component as SvelteComponent } from "svelte";

  type LoadedComponent = SvelteComponent<Record<string, unknown>>;

  interface Props {
    load: () => Promise<{ default: unknown }>;
    [key: string]: unknown;
  }

  let props: Props = $props();
  let Component = $state<LoadedComponent | null>(null);
  let error = $state<string | null>(null);
  let loadRequest = 0;

  async function loadComponent(): Promise<void> {
    const request = ++loadRequest;
    error = null;
    try {
      const module = await props.load();
      if (request === loadRequest) Component = module.default as LoadedComponent;
    } catch (loadError) {
      if (request !== loadRequest) return;
      console.error("Failed to load page:", loadError);
      Component = null;
      error = "failed to load";
    }
  }

  $effect(() => {
    void loadComponent();
  });
</script>

{#if Component}
  {@const rest = Object.fromEntries(Object.entries(props).filter(([key]) => key !== "load"))}
  <Component {...rest} />
{:else if error}
  <div class="flex h-20 flex-col items-center justify-center gap-2">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/30">{error}</span>
    <button
      type="button"
      onclick={loadComponent}
      class="text-[10px] font-bold uppercase tracking-widest text-foreground hover:opacity-70 cursor-pointer"
      >retry</button
    >
  </div>
{:else}
  <div class="flex h-20 items-center justify-center">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/30">loading...</span>
  </div>
{/if}
