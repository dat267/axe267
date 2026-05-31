<script lang="ts">
  let { 
    type = "text", 
    id, 
    label = "", 
    value = $bindable(""), 
    placeholder = "", 
    required = false, 
    disabled = false,
    labelRight,
    ...rest
  } = $props<{
    type?: string;
    id: string;
    label?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    labelRight?: any;
    [key: string]: any;
  }>();
</script>
<div>
  {#if label}
    <div class="flex items-center justify-between mb-1">
      <label for={id} class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</label>
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
