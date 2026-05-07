<script lang="ts">
  import { onMount } from "svelte";
  import { auth } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte";
  import {
    createApiKey,
    subscribeApiKeys,
    deleteApiKey,
    type ApiKey,
  } from "../lib/services/apiKeyService";
  import Button from "../lib/components/Button.svelte";
  import CodeBlock from "../lib/components/CodeBlock.svelte";
  import Input from "../lib/components/Input.svelte";
  import Alert from "../lib/components/Alert.svelte";
  import CopyButton from "../lib/components/CopyButton.svelte";

  let loading = $state(false);
  let error = $state("");
  let token = $state("");

  let keyState = $state({
    list: [] as ApiKey[],
    method: "bearer" as "bearer" | "apikey",
    selected: "",
    newName: "",
    generated: "",
  });

  let form = $state({
    type: "info",
    source: "CLI",
    title: "Hello World",
    message: "Message from curl",
    category: "system",
  });

  const types = ["info", "success", "warning", "error"];
  const categories = ["system", "mobile", "desktop"];

  const RANDOM_SAMPLES = [
    { source: "CI/CD", title: "Build Success", message: "Production build completed in 2m 45s.", type: "success", category: "system" },
    { source: "Auth Service", title: "New Sign-in", message: "New login detected from unusual IP: 192.168.1.1", type: "warning", category: "system" },
    { source: "Mobile App", title: "Crash Report", message: "Uncaught ReferenceError on Home screen.", type: "error", category: "mobile" },
    { source: "Database", title: "Daily Backup", message: "Cloud snapshot created successfully.", type: "success", category: "system" },
    { source: "Desktop App", title: "Update Available", message: "Version 2.4.0 is ready to install.", type: "info", category: "desktop" },
    { source: "S3 Storage", title: "Quota Reached", message: "Bucket storage exceeds 90% threshold.", type: "warning", category: "system" },
    { source: "Stripe", title: "New Subscription", message: "Pro plan activated for user_249.", type: "success", category: "system" },
    { source: "CLI Tool", title: "Task Failed", message: "Permission denied while writing to /var/log.", type: "error", category: "system" },
  ];

  function randomizeContent() {
    const sample = RANDOM_SAMPLES[Math.floor(Math.random() * RANDOM_SAMPLES.length)];
    form.source = sample.source;
    form.title = sample.title;
    form.message = sample.message;
    form.type = sample.type;
    form.category = sample.category;
  }

  const projectId =
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "[PROJECT_ID_MISSING]";
  const apiUrl = `https://asia-southeast1-${projectId}.cloudfunctions.net/api/notify`;

  const authHeader = $derived(
    keyState.method === "bearer"
      ? `-H "Authorization: Bearer ${token || "[YOUR_TOKEN]"}"`
      : `-H "x-api-key: ${keyState.selected || "[YOUR_API_KEY]"}"`,
  );

  const curlCommand = $derived(`curl -X POST "${apiUrl}" \\
${authHeader} \\
-H "Content-Type: application/json" \\
-d '{
  "type": "${form.type}",
  "source": "${form.source}",
  "title": "${form.title}",
  "message": "${form.message}",
  "category": "${form.category}"
}'`);

  onMount(() => {
    if (!authStore.user) return;
    return subscribeApiKeys(authStore.user.uid, (keys) => {
      keyState.list = keys;
      if (keys.length > 0 && !keyState.selected)
        keyState.selected = keys[0].key;
    });
  });

  async function refreshToken() {
    loading = true;
    try {
      token = (await auth.currentUser?.getIdToken(true)) || "";
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function handleCreateKey() {
    const trimmed = keyState.newName.trim();
    if (!trimmed || !authStore.user) return;

    if (
      keyState.list.some((k) => k.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      error = `An API key named "${trimmed}" already exists.`;
      return;
    }

    loading = true;
    error = "";
    try {
      const { key } = await createApiKey(
        authStore.user.uid,
        authStore.user.email!,
        trimmed,
      );
      keyState.generated = key;
      keyState.selected = key;
      keyState.newName = "";
    } catch (e: any) {
      error = e.message || "Failed to create API key";
    } finally {
      loading = false;
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    try {
      await deleteApiKey(id);
      if (keyState.list.length === 1) keyState.selected = "";
    } catch (e) {
      console.error(e);
    }
  }
</script>

{#snippet selectDropdown(id: string, label: string, options: string[])}
  <div>
    <label
      for={id}
      class="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500"
      >{label}</label
    >
    <select
      {id}
      bind:value={form[id as keyof typeof form]}
      class="w-full outline-none rounded-lg border border-border bg-background p-2.5 text-sm focus:border-gray-500"
    >
      {#each options as opt}
        <option value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option
        >
      {/each}
    </select>
  </div>
{/snippet}

<div>
  <div class="mb-8">
    <h1 class="text-2xl font-bold tracking-tight">CLI Integration</h1>
  </div>

  <section class="space-y-8">
    <div class="rounded-xl border border-border bg-surface p-6">
      <div
        class="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
      >
        <h2 class="text-lg font-semibold">1. Authentication</h2>
        <div
          class="flex grow rounded-lg border border-border bg-background p-1 sm:grow-0"
        >
          {#each ["bearer", "apikey"] as method}
            <button
              onclick={() => (keyState.method = method as any)}
              class="grow rounded-md px-3 py-1.5 text-xs font-medium sm:flex-initial {keyState.method ===
              method
                ? 'bg-gray-800 text-white dark:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
            >
              {method === "bearer" ? "Bearer Token" : "API Key"}
            </button>
          {/each}
        </div>
      </div>

      {#if keyState.method === "bearer"}
        <div class="space-y-4">
          <p class="text-sm text-gray-500">
            Standard Firebase ID token. Highly secure but expires every hour.
          </p>
          <div class="flex flex-col gap-4">
            <div class="relative w-full overflow-hidden rounded-lg border border-border bg-surface">
              <div class="flex items-center justify-between bg-foreground/5 px-4 py-2 border-b border-border">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Firebase Bearer Token</span>
                {#if token}
                  <CopyButton text={token} label="Copy" />
                {/if}
              </div>
              <div class="p-4">
                <textarea
                  readonly
                  class="h-24 w-full break-all outline-none bg-transparent text-xs font-mono text-foreground resize-none"
                  value={token ||
                    "Click 'Generate Token' below to view your current Bearer token."}
                ></textarea>
              </div>
            </div>
            <div class="flex">
              <Button
                onclick={refreshToken}
                {loading}
                className="w-full md:w-auto"
                >{token ? "Refresh Token" : "Generate Token"}</Button
              >
            </div>
          </div>
        </div>
      {:else}
        <div class="space-y-6">
          <p class="text-sm text-gray-500">
            Long-lived keys for persistent workflows like server monitoring or
            automation.
          </p>

          {#if keyState.generated}
            <div
              class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4"
            >
              <p
                class="mb-2 text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400"
              >
                Key Generated Successfully
              </p>
              <p class="mb-3 text-xs text-emerald-600 dark:text-emerald-400">
                Copy this key now. For your security, it won't be shown again.
              </p>
              <div class="flex flex-wrap gap-2">
                <div class="flex min-w-0 grow gap-2">
                  <input
                    readonly
                    value={keyState.generated}
                    class="min-w-0 grow outline-none rounded border border-emerald-500/30 bg-background px-3 py-2 text-xs font-mono"
                  />
                  <CopyButton 
                    text={keyState.generated} 
                    className="bg-emerald-500/10!"
                  />
                </div>
                <Button
                  variant="secondary"
                  className="py-2! w-full sm:w-auto"
                  onclick={() => (keyState.generated = "")}>Done</Button
                >
              </div>
            </div>
          {/if}

          {#if error}<Alert type="error" message={error} />{/if}

          <div class="space-y-4">
            {#if keyState.list.length > 0}
              <div class="space-y-2">
                <div
                  class="text-xs font-bold uppercase tracking-wider text-gray-500"
                >
                  Active Keys
                </div>
                <div
                  class="divide-y divide-border rounded-lg border border-border bg-background"
                >
                  {#each keyState.list as key}
                    <div class="flex items-center justify-between gap-4 p-3">
                      <div class="flex min-w-0 flex-col">
                        <span class="truncate text-sm font-medium"
                          >{key.name}</span
                        >
                        <span class="text-[10px] text-gray-500"
                          >Created {key.createdAt?.toDate
                            ? key.createdAt.toDate().toLocaleDateString()
                            : "Just now"}</span
                        >
                      </div>
                      <div class="flex shrink-0 items-center gap-3">
                        <button
                          onclick={() => (keyState.selected = key.key)}
                          class="text-[10px] font-bold uppercase tracking-wider {keyState.selected ===
                          key.key
                            ? 'text-foreground'
                            : 'text-gray-400 hover:text-gray-600'}"
                        >
                          {keyState.selected === key.key
                            ? "Selected"
                            : "Select"}
                        </button>
                        <button
                          onclick={() => handleDeleteKey(key.id)}
                          aria-label="Delete API key {key.name}"
                          class="text-gray-400 hover:text-rose-500"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path
                              d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                            ></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="pt-2">
              <label
                for="new-key-input"
                class="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500"
                >Create New Key</label
              >
              <div class="flex flex-wrap gap-2">
                <input
                  id="new-key-input"
                  bind:value={keyState.newName}
                  placeholder="e.g. Production Server"
                  class="min-w-0 grow outline-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-gray-500 sm:min-w-50"
                />
                <Button
                  className="w-full sm:w-auto"
                  onclick={handleCreateKey}
                  {loading}
                  disabled={!keyState.newName.trim()}>Create</Button
                >
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="rounded-xl border border-border bg-surface p-6">
      <h2 class="mb-6 text-lg font-semibold">2. Customize Notification</h2>
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {@render selectDropdown("type", "Notification Type", types)}
        {@render selectDropdown("category", "Target Category", categories)}
        <Input
          id="source"
          label="Source"
          bind:value={form.source}
          placeholder="e.g. Ubuntu Server"
        />
        <Input
          id="title"
          label="Title"
          bind:value={form.title}
          placeholder="e.g. Backup Complete"
        />
        <div class="sm:col-span-2">
          <Input
            id="message"
            label="Message"
            bind:value={form.message}
            placeholder="e.g. All 15 files were successfully uploaded."
          />
        </div>
      </div>
    </div>

    <div class="space-y-4">
      <h2 class="px-1 text-lg font-semibold">3. Copy & Run Command</h2>
      <p class="px-1 text-sm text-gray-500">
        This command updates live as you change the fields above.
      </p>
      <CodeBlock code={curlCommand} onCopy={randomizeContent} />
    </div>
  </section>
</div>
