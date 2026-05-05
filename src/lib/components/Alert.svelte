<script lang="ts">
  let { type = "info", message } = $props<{
    type?: "error" | "success" | "info";
    message: string;
  }>();

  const styles = {
    error: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    success:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    info: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };
</script>

{#if message}
  <div class="mb-6 rounded-lg p-3 text-sm border {styles[type]}">
    {message}
  </div>
{/if}
