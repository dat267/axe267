<script lang="ts">
  let { 
    type = "text", 
    id, 
    label = "", 
    value = $bindable(""), 
    placeholder = "", 
    required = false, 
    disabled = false,
    labelRight
  } = $props<{
    type?: string;
    id: string;
    label?: string;
    value?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    labelRight?: any;
  }>();
</script>

<div>
  {#if label}
    <div class="flex items-center justify-between mb-1">
      <label for={id} class="block text-xs font-bold uppercase tracking-wider text-gray-500">{label}</label>
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
    class="block w-full border-b border-border bg-transparent py-2 outline-none focus:border-gray-500 transition-colors disabled:opacity-50"
  />
</div>
