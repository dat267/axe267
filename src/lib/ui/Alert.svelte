<script lang="ts">
  let { type = "info", message } = $props<{
    type?: "error" | "success" | "info";
    message: string;
  }>();

  const styles = {
    error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    success: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
  };
</script>

{#if message}
  <div class="mb-6 rounded-lg p-3 text-sm border {styles[type]}">
    {message}
  </div>
{/if}
