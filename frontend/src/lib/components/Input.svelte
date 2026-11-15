<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLInputAttributes, "value"> {
    id: string;
    label?: string;
    value?: string;
    labelRight?: Snippet;
  }

  let {
    type = "text",
    id,
    label = "",
    value = $bindable(""),
    placeholder = "",
    required = false,
    disabled = false,
    labelRight = undefined,
    ...rest
  }: Props = $props();
</script>

<div>
  {#if label}
    <div class="flex items-center justify-between mb-1">
      <label for={id} class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
        >{label}</label
      >
      {@render labelRight?.()}
    </div>
  {/if}
  <input
    {type}
    {id}
    bind:value
    {placeholder}
    {required}
    {disabled}
    {...rest}
    class="block w-full border-b border-border bg-transparent py-3 text-sm outline-none focus:border-foreground disabled:opacity-30 placeholder-gray-500/40"
  />
</div>
