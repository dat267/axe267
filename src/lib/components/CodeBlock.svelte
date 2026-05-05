<script lang="ts">
  let { code, onCopy } = $props<{ code: string; onCopy?: () => void }>();
  let copied = $state(false);

  async function copyToClipboard() {
    try {
      if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } else {
        await navigator.clipboard.writeText(code);
      }
      copied = true;
      onCopy?.();
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  }
</script>

<div class="relative group w-full overflow-hidden rounded-lg border border-border bg-gray-950">
  <div class="flex items-center justify-between bg-gray-900/50 px-4 py-2 border-b border-border/50">
    <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Bash / Curl</span>
    <button 
      onclick={copyToClipboard}
      class="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors {copied ? 'text-emerald-500' : 'text-gray-400 hover:text-white hover:bg-white/5'}"
    >
      {#if copied}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Copied
      {:else}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy
      {/if}
    </button>
  </div>
  
  <div class="overflow-x-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
    <pre class="text-xs text-gray-300 whitespace-pre"><code>{code}</code></pre>
  </div>
</div>
