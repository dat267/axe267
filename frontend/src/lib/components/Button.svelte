<script lang="ts">
  import type { Snippet } from "svelte";

  type ButtonType = "button" | "reset" | "submit";
  type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

  interface Props {
    type?: ButtonType;
    variant?: ButtonVariant;
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    type = "button",
    variant = "primary",
    loading = false,
    disabled = false,
    className = "",
    onclick = undefined,
    children,
  }: Props = $props();

  const baseStyles =
    "rounded-md px-4 py-3 font-bold uppercase tracking-wider text-xs focus:outline-none disabled:opacity-40 inline-flex items-center justify-center gap-2 cursor-pointer transition-none select-none";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-foreground text-background border border-foreground hover:bg-background hover:text-foreground",
    secondary:
      "border border-border bg-surface text-foreground hover:bg-foreground hover:text-background hover:border-foreground",
    danger:
      "border border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600",
    ghost: "text-gray-500 hover:text-foreground bg-transparent hover:bg-foreground/5",
  };
</script>

<button {type} disabled={disabled || loading} class="{baseStyles} {variants[variant]} {className}" {onclick}>
  <div class="inline-flex items-center gap-2">
    {#if loading}
      <span class="text-[10px] font-bold uppercase tracking-widest opacity-70">loading...</span>
    {:else}
      {@render children?.()}
    {/if}
  </div>
</button>
