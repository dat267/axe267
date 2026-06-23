<script>
  let { type = "info", message } = $props();
  const styles = {
    error: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40",
    info: "bg-foreground/5 text-foreground border-border"
  };
</script>
{#if message}
  <div class="mb-6 rounded-md p-4 text-xs font-medium border {styles[type]}">
    {message}
  </div>
{/if}
