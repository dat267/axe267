<script>
  let props = $props();
  let Component = $state(null);
  $effect(() => {
    props.load().then((module) => {
      Component = module.default;
    });
  });
</script>
{#if Component}
  {@const { load: _, ...rest } = props}
  <Component {...rest} />
{:else}
  <div class="flex h-20 items-center justify-center">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500/30">loading...</span>
  </div>
{/if}
