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

  const baseStyles = "rounded-md px-4 py-3 font-bold uppercase tracking-wider text-xs focus:outline-none disabled:opacity-40 inline-flex items-center justify-center gap-2 cursor-pointer transition-none select-none";
  const variants: Record<"primary" | "secondary" | "danger" | "ghost", string> = {
    primary: "bg-foreground text-background border border-foreground hover:bg-background hover:text-foreground",
    secondary: "border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground",
    danger: "border border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600",
    ghost: "text-gray-500 hover:text-foreground bg-transparent hover:bg-foreground/5"
  };
</script>

<button
  {type}
  disabled={disabled || loading}
  class="{baseStyles} {variants[variant as "primary" | "secondary" | "danger" | "ghost"]} {className}"
  {onclick}
>
  <div class="inline-flex items-center gap-2">
    {#if loading}
      <span class="text-[10px] font-bold uppercase tracking-widest opacity-70">loading...</span>
    {:else}
      {@render children?.()}
    {/if}
  </div>
</button>
