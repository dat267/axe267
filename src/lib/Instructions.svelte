<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from './firebase';
  import { authStore } from './authStore.svelte';
  import { createApiKey, subscribeApiKeys, deleteApiKey, type ApiKey } from './apiKeyService';
  import Button from './ui/Button.svelte';
  import CodeBlock from './ui/CodeBlock.svelte';
  import Input from './ui/Input.svelte';
  import Alert from './ui/Alert.svelte';

  let token = $state("");
  let loading = $state(false);
  
  // API Key state
  let apiKeys = $state<ApiKey[]>([]);
  let authMethod = $state<'bearer' | 'apikey'>('bearer');
  let selectedApiKey = $state("");
  let newKeyName = $state("");
  let generatedKey = $state("");
  let error = $state("");

  // Field values for the curl builder
  let type = $state("info");
  let source = $state("CLI");
  let title = $state("Hello World");
  let message = $state("Message from curl");
  let category = $state("system");

  const types = ["info", "success", "warning", "error"];
  const categories = ["system", "mobile", "desktop"];

  onMount(() => {
    if (authStore.user) {
      return subscribeApiKeys(authStore.user.uid, (keys) => {
        apiKeys = keys;
        if (keys.length > 0 && !selectedApiKey) {
          selectedApiKey = keys[0].key;
        }
      });
    }
  });

  async function refreshToken() {
    loading = true;
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      token = idToken || "";
    } catch (e) {
      console.error("Failed to get token", e);
    } finally {
      loading = false;
    }
  }

  async function handleCreateKey() {
    const trimmedName = newKeyName.trim();
    if (!trimmedName) return;
    
    // Check for duplicate names
    if (apiKeys.some(k => k.name.toLowerCase() === trimmedName.toLowerCase())) {
      error = `An API key named "${trimmedName}" already exists.`;
      return;
    }

    loading = true;
    error = "";
    try {
      if (authStore.user) {
        const { key } = await createApiKey(authStore.user.uid, authStore.user.email!, trimmedName);
        generatedKey = key;
        selectedApiKey = key;
        newKeyName = "";
      }
    } catch (e: any) {
      error = e.message || "Failed to create API key";
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    try {
      await deleteApiKey(id);
      if (apiKeys.length === 1) {
        selectedApiKey = "";
      }
    } catch (e) {
      console.error("Failed to delete key", e);
    }
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
  const region = "asia-southeast1";
  
  // For CLI integration, we use the direct Cloud Function URL as it's the canonical API endpoint
  const apiUrl = $derived(projectId 
    ? `https://${region}-${projectId}.cloudfunctions.net/api/notify`
    : (typeof window !== 'undefined' ? `${window.location.origin}/api/notify` : "[PROJECT_ID_MISSING]")
  );

  let copiedToken = $state(false);
  let copiedKey = $state(false);

  async function copyToClipboard(text: string, type: 'token' | 'key') {
    try {
      if (!navigator.clipboard) {
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
      } else {
        await navigator.clipboard.writeText(text);
      }
      
      if (type === 'token') {
        copiedToken = true;
        setTimeout(() => copiedToken = false, 2000);
      } else {
        copiedKey = true;
        setTimeout(() => copiedKey = false, 2000);
      }
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  const authHeader = $derived(
    authMethod === 'bearer' 
      ? `-H "Authorization: Bearer ${token || '[YOUR_TOKEN]'}"` 
      : `-H "x-api-key: ${selectedApiKey || '[YOUR_API_KEY]'}"`
  );

  const curlCommand = $derived(`curl -X POST "${apiUrl}" \\
${authHeader} \\
-H "Content-Type: application/json" \\
-d '{
  "type": "${type}",
  "source": "${source}",
  "title": "${title}",
  "message": "${message}",
  "category": "${category}"
}'`);
</script>

<div class="mx-auto w-full max-w-3xl p-4 md:p-8">
  <div class="mb-10 text-center md:text-left">
    <h1 class="text-2xl font-bold">CLI Integration</h1>
    <p class="mt-2 text-sm text-gray-400">Build and copy a custom curl command to push notifications.</p>
  </div>

  <section class="space-y-8">
    <!-- Authentication Section -->
    <div class="rounded-xl border border-border bg-surface p-6">
      <div class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 class="text-lg font-semibold">1. Authentication</h2>
        <div class="flex flex-grow sm:flex-grow-0 rounded-lg bg-background p-1 border border-border">
          <button 
            onclick={() => authMethod = 'bearer'}
            class="flex-grow sm:flex-initial rounded-md px-3 py-1.5 text-xs font-medium transition-colors {authMethod === 'bearer' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
          >
            Bearer Token
          </button>
          <button 
            onclick={() => authMethod = 'apikey'}
            class="flex-grow sm:flex-initial rounded-md px-3 py-1.5 text-xs font-medium transition-colors {authMethod === 'apikey' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
          >
            API Key
          </button>
        </div>
      </div>

      {#if authMethod === 'bearer'}
        <div class="space-y-4">
          <p class="text-sm text-gray-500">
            Standard Firebase ID token. Highly secure but expires every hour.
          </p>

          <div class="flex flex-col gap-4">
            <div class="relative">
              <textarea
                readonly
                class="h-28 w-full rounded-lg border border-border bg-background p-4 pr-12 text-xs font-mono break-all focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                value={token || "Click 'Generate Token' below to view your current Bearer token."}
              ></textarea>
              {#if token}
                <button 
                  onclick={() => copyToClipboard(token, 'token')}
                  class="absolute right-3 top-3 flex items-center gap-1.5 rounded-md p-1.5 transition-colors {copiedToken ? 'text-green-500' : 'text-gray-400 hover:bg-gray-500/10 hover:text-gray-600 dark:hover:text-gray-300'}"
                  aria-label="Copy token"
                >
                  {#if copiedToken}
                    <span class="text-[10px] font-bold uppercase tracking-wider">Copied!</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  {:else}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  {/if}
                </button>
              {/if}
            </div>
            
            <div class="flex">
              <Button onclick={refreshToken} loading={loading} className="w-full md:w-auto">
                {token ? 'Refresh Token' : 'Generate Token'}
              </Button>
            </div>
          </div>
        </div>
      {:else}
        <div class="space-y-6">
          <p class="text-sm text-gray-500">
            Long-lived keys for persistent workflows like server monitoring or automation.
          </p>

          {#if generatedKey}
            <div class="rounded-lg bg-green-500/10 p-4 border border-green-500/20">
              <p class="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2">Key Generated Successfully</p>
              <p class="text-xs text-green-600 dark:text-green-400 mb-3">Copy this key now. For your security, it won't be shown again.</p>
              <div class="flex flex-wrap gap-2">
                <div class="flex flex-grow gap-2 min-w-0">
                  <input 
                    readonly 
                    value={generatedKey} 
                    class="flex-grow min-w-0 rounded border border-green-500/30 bg-background px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                  <button 
                    onclick={() => copyToClipboard(generatedKey, 'key')}
                    class="flex-shrink-0 flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors {copiedKey ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-600 hover:bg-green-500/30 dark:text-green-400'}"
                    aria-label="Copy API key"
                  >
                    {#if copiedKey}
                      <span class="text-[10px] font-bold uppercase tracking-wider">Copied!</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    {:else}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    {/if}
                  </button>                </div>
                <Button variant="secondary" className="w-full sm:w-auto !py-2" onclick={() => generatedKey = ""}>Done</Button>
              </div>
            </div>
          {/if}

          {#if error}
            <Alert type="error" message={error} />
          {/if}

          <div class="space-y-4">
            {#if apiKeys.length > 0}
              <div class="space-y-2">
                <label class="text-xs font-bold uppercase tracking-wider text-gray-500">Active Keys</label>
                <div class="divide-y divide-border rounded-lg border border-border bg-background">
                  {#each apiKeys as key}
                    <div class="flex items-center justify-between gap-4 p-3">
                      <div class="flex flex-col min-w-0">
                        <span class="text-sm font-medium truncate">{key.name}</span>
                        <span class="text-[10px] text-gray-500">Created {key.createdAt?.toDate ? key.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                      </div>
                      <div class="flex flex-shrink-0 items-center gap-3">
                        <button 
                          onclick={() => selectedApiKey = key.key}
                          class="text-[10px] font-bold uppercase tracking-wider {selectedApiKey === key.key ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}"
                        >
                          {selectedApiKey === key.key ? 'Selected' : 'Select'}
                        </button>
                        <button 
                          onclick={() => handleDeleteKey(key.id)}
                          class="text-gray-400 hover:text-red-500"
                          aria-label="Delete key"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="pt-2">
              <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Create New Key</label>
              <div class="flex flex-wrap gap-2">
                <input 
                  bind:value={newKeyName}
                  placeholder="e.g. Production Server"
                  class="flex-grow min-w-0 sm:min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-blue-500 outline-none"
                />
                <Button className="w-full sm:w-auto" onclick={handleCreateKey} loading={loading} disabled={!newKeyName.trim()}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Builder Section -->
    <div class="rounded-xl border border-border bg-surface p-6">
      <h2 class="mb-6 text-lg font-semibold">2. Customize Notification</h2>
      
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label for="notif-type" class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Notification Type</label>
          <select id="notif-type" bind:value={type} class="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus:border-blue-500 outline-none">
            {#each types as t}
              <option value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="notif-category" class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Target Category</label>
          <select id="notif-category" bind:value={category} class="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus:border-blue-500 outline-none">
            {#each categories as c}
              <option value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            {/each}
          </select>
        </div>

        <Input id="source" label="Source" bind:value={source} placeholder="e.g. Ubuntu Server" />
        <Input id="title" label="Title" bind:value={title} placeholder="e.g. Backup Complete" />
        
        <div class="sm:col-span-2">
          <Input id="message" label="Message" bind:value={message} placeholder="e.g. All 15 files were successfully uploaded." />
        </div>
      </div>
    </div>

    <!-- Command Section -->
    <div class="space-y-4">
      <h2 class="text-lg font-semibold px-1">3. Copy & Run Command</h2>
      <p class="text-sm text-gray-500 px-1">This command updates live as you change the fields above.</p>
      <CodeBlock code={curlCommand} />
    </div>
  </section>
</div>
