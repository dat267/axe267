<script lang="ts">
  import { auth } from './firebase';
  import Button from './ui/Button.svelte';
  import CodeBlock from './ui/CodeBlock.svelte';
  import Input from './ui/Input.svelte';

  let token = $state("");
  let loading = $state(false);

  // Field values for the curl builder
  let type = $state("info");
  let source = $state("CLI");
  let title = $state("Hello World");
  let message = $state("Message from curl");
  let category = $state("system");

  const types = ["info", "success", "warning", "error"];
  const categories = ["system", "mobile", "desktop"];

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

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "";
  const region = "asia-southeast1";
  const apiUrl = projectId 
    ? `https://${region}-${projectId}.cloudfunctions.net/api/notify`
    : "[PROJECT_ID_MISSING_IN_ENV]";

  const curlCommand = $derived(`curl -X POST "${apiUrl}" \\
-H "Authorization: Bearer ${token || '[YOUR_TOKEN]'}" \\
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
    <!-- Token Section -->
    <div class="rounded-xl border border-border bg-surface p-6">
      <h2 class="mb-4 text-lg font-semibold">1. Your API Token</h2>
      <p class="mb-6 text-sm text-gray-500">
        Use this token in the Authorization header. It expires every hour.
      </p>

      <div class="flex flex-col gap-4">
        <textarea
          readonly
          class="h-28 w-full rounded-lg border border-border bg-background p-4 text-xs font-mono break-all focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          value={token || "Click 'Generate Token' below to view your current Bearer token."}
        ></textarea>
        
        <div class="flex">
          <Button onclick={refreshToken} loading={loading} className="w-full md:w-auto">
            {token ? 'Refresh Token' : 'Generate Token'}
          </Button>
        </div>
      </div>
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
