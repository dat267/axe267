<script lang="ts">
  let { 
    type = "button", 
    variant = "primary", 
    loading = false, 
    disabled = false, 
    className = "",
    onclick,
    children
  } = $props<{
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "danger" | "ghost";
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    onclick?: (e: MouseEvent) => void;
    children?: any;
  }>();

  const baseStyles = "rounded-lg px-4 py-2.5 font-semibold transition-colors focus:outline-none disabled:opacity-50 inline-flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-border text-gray-700 hover:bg-gray-500/10 dark:text-gray-300 dark:hover:bg-gray-500/10",
    danger: "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/10",
    ghost: "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent hover:bg-gray-500/10"
  };
</script>

<button
  {type}
  disabled={disabled || loading}
  class="{baseStyles} {variants[variant]} {className}"
  {onclick}
>
  {#if loading}
    <div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
  {/if}
  {@render children?.()}
</button>
