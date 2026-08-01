<script>
  let { svg, size = 18, ...rest } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" {...rest}>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- svg comes from ICONS (static, trusted constants); do not pass user input -->
  {@html svg}
</svg>
