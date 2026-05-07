<script lang="ts">
  import CopyButton from "./CopyButton.svelte";
  let { code, onCopy, title = "Bash / Curl" } = $props<{ code: string; onCopy?: () => void; title?: string }>();
</script>

<div class="relative group w-full overflow-hidden rounded-lg border border-border bg-surface">
  <div class="flex items-center justify-between bg-foreground/5 px-4 py-2 border-b border-border">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">{title}</span>
    <CopyButton text={code} {onCopy} label="Copy" />
  </div>
  
  <div class="overflow-x-auto p-4">
    <pre class="text-xs text-foreground whitespace-pre"><code>{code}</code></pre>
  </div>
</div>
