<script lang="ts">
  import CopyButton from "./CopyButton.svelte";
  let { code, onCopy } = $props<{ code: string; onCopy?: () => void }>();
</script>

<div class="relative group w-full overflow-hidden rounded-lg border border-border bg-gray-950">
  <div class="flex items-center justify-between bg-gray-900/50 px-4 py-2 border-b border-border/50">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Bash / Curl</span>
    <CopyButton text={code} {onCopy} label="Copy" />
  </div>
  
  <div class="overflow-x-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
    <pre class="text-xs text-gray-300 whitespace-pre"><code>{code}</code></pre>
  </div>
</div>
