<script lang="ts">
  let { 
    text, 
    onCopy, 
    className = "",
    label = ""
  } = $props<{ 
    text: string; 
    onCopy?: () => void;
    className?: string;
    label?: string;
  }>();

  let copied = $state(false);

  async function copyToClipboard() {
    if (!text) return;
    try {
      if (!navigator.clipboard) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } else {
        await navigator.clipboard.writeText(text);
      }
      copied = true;
      onCopy?.();
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }
</script>

<button 
  type="button"
  onclick={copyToClipboard}
  class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider {className} {copied ? 'text-emerald-500' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-500/5'}"
  aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
>
  {#if copied}
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    <span>{label ? "Copied" : "Copied!"}</span>
  {:else}
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    {#if label}<span>{label}</span>{/if}
  {/if}
</button>
