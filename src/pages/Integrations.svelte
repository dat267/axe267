<script>
  import { onMount } from "svelte";
  import { auth } from "../lib/services/firebase";
  import { authStore } from "../lib/stores/authStore.svelte.js";
  import {
    createApiKey,
    subscribeApiKeys,
    deleteApiKey,
  } from "../lib/services/apiKeyService";
  import Button from "../lib/components/Button.svelte";
  import CodeBlock from "../lib/components/CodeBlock.svelte";
  import Input from "../lib/components/Input.svelte";
  import Alert from "../lib/components/Alert.svelte";
  import CopyButton from "../lib/components/CopyButton.svelte";
  import { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from "../lib/utils/constants";

  let loading = $state(false);
  let error = $state("");
  let token = $state("");

  let keyState = $state({
    list: [],
    method: "bearer",
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

  const types = NOTIFICATION_TYPES;
  const categories = NOTIFICATION_CATEGORIES;

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

  let automationTab = $state("bash");

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "[PROJECT_ID_MISSING]";
  const apiUrl = $derived(typeof window !== "undefined" ? `${window.location.origin}/api/notify` : `https://${projectId}.web.app/api/notify`);

  const authHeader = $derived(
    keyState.method === "bearer"
      ? `-H "Authorization: Bearer ${token || "[YOUR_TOKEN]"}"`
      : `-H "x-api-key: ${keyState.selected || "[YOUR_API_KEY]"}"`,
  );

  const authHeaderName = $derived(
    keyState.method === "bearer" ? "Authorization" : "x-api-key",
  );
  const authHeaderValue = $derived(
    keyState.method === "bearer"
      ? `Bearer ${token || "[YOUR_TOKEN]"}`
      : keyState.selected || "[YOUR_API_KEY]",
  );

  const bashScript = $derived(`#!/bin/bash
# Axe Notification Mirror (Linux)
# Forwards system notifications to your axe dashboard.
# Requires: dbus-monitor (usually pre-installed)

API_URL="${apiUrl}"

echo "Listening for system notifications..."

dbus-monitor "interface='org.freedesktop.Notifications',member='Notify'" | \\
while read -r line; do
  # Extract strings from dbus output (app name, summary, body)
  if [[ "$line" == *"string"* ]]; then
    VALUE=$(echo "$line" | cut -d '"' -f 2)
    
    # Send to axe
    curl -s -X POST "$API_URL" \\
      ${authHeader} \\
      -H "Content-Type: application/json" \\
      -d "{
        \\"type\\": \\"info\\",
        \\"source\\": \\"Desktop Mirror\\",
        \\"title\\": \\"System Notification\\",
        \\"message\\": \\"$VALUE\\",
        \\"category\\": \\"desktop\\"
      }" > /dev/null
  fi
done`);

  const powershellScript = $derived(`# Axe Notification Mirror (Windows)
# Forwards Windows Toast notifications to axe.
# Note: Requires "Notification Access" permission for PowerShell.

$ScriptBlock = {
    param (
        [string]$ApiUrl = "${apiUrl}",
        [string]$ApiKey = "${authHeaderValue}",
        [int]$PollInterval = 2,
        [switch]$SendExisting
    )

    # Load API Key from the .env file if ApiKey is not explicitly passed
    if (-not $ApiKey) {
        # Dynamically search up the directory tree to avoid hardcoding the .env path
        $searchDirs = @()
        $currentDir = Get-Item -Path $PSScriptRoot -ErrorAction SilentlyContinue
        while ($currentDir) {
            $searchDirs += $currentDir.FullName
            $currentDir = $currentDir.Parent
        }
        if ($searchDirs -notcontains $HOME) {
            $searchDirs += $HOME
        }

        $envPath = $null
        foreach ($dir in $searchDirs) {
            $testEnv = Join-Path $dir ".env"
            if (Test-Path $testEnv) {
                $envPath = $testEnv
                break
            }
        }

        if ($envPath -and (Test-Path $envPath)) {
            foreach ($line in (Get-Content $envPath)) {
                $line = $line.Trim()
                if ($line -and -not $line.StartsWith("#")) {
                    $parts = $line.Split("=", 2)
                    if ($parts.Count -eq 2) {
                        $key = $parts[0].Trim()
                        $value = $parts[1].Trim().Trim('"').Trim("'")
                        if ($key -eq "AXE267_API_KEY" -or $key -eq "VITE_FIREBASE_API_KEY") {
                            $ApiKey = $value
                        }
                    }
                }
            }
        }
    }

    # If still not found, warn and use default placeholder
    if (-not $ApiKey) {
        Write-Warning "No API Key or Token specified. Using default placeholder."
    }

    # Load WinRT assembly metadata
    Add-Type -AssemblyName System.Runtime.WindowsRuntime

    # Retrieve the WinRT types dynamically (robust fallback for PowerShell 5.1/7 environments on Windows)
    $ListenerType = [Type]::GetType("Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType = WindowsRuntime")
    $KindsType    = [Type]::GetType("Windows.UI.Notifications.NotificationKinds, Windows.UI.Notifications, ContentType = WindowsRuntime")
    $BindingsType = [Type]::GetType("Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType = WindowsRuntime")
    $NotificationType = [Type]::GetType("Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType = WindowsRuntime")
    $AccessStatusType = [Type]::GetType("Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus, Windows.UI.Notifications, ContentType = WindowsRuntime")

    if (-not $ListenerType -or -not $KindsType -or -not $BindingsType -or -not $NotificationType -or -not $AccessStatusType) {
        Write-Error "Windows Runtime Notification APIs are not available. Ensure you are running Windows 10/11."
        exit 1
    }

    # Helper function to await WinRT IAsyncOperation in PowerShell 5.1
    function Wait-WinRT {
        param(
            [Parameter(Mandatory=$true)]
            $AsyncOp,
            [Parameter(Mandatory=$true)]
            [Type]$ResultType
        )

        $asTaskMethods = [System.WindowsRuntimeSystemExtensions].GetMethods()
        $asTask = $asTaskMethods | Where-Object {
            $_.Name -eq 'AsTask' -and
            $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'
        } | Select-Object -First 1

        $concreteMethod = $asTask.MakeGenericMethod($ResultType)
        $task = $concreteMethod.Invoke($null, @($AsyncOp))
        $task.Wait() | Out-Null
        return $task.Result
    }

    # Instantiate Listener
    $listener = $ListenerType::Current
    Write-Host "Checking/Requesting Windows Notification permissions..." -ForegroundColor Cyan

    # Await permission check asynchronously
    $accessOp = $listener.RequestAccessAsync()
    $accessStatus = Wait-WinRT $accessOp $AccessStatusType

    if ($accessStatus.ToString() -ne 'Allowed') {
        Write-Error "Permission Denied: Access to notifications status is '$accessStatus'. Please enable notification access for PowerShell in Windows Settings."
        exit 1
    }

    Write-Host "Permission Granted! Initializing Notification Monitor..." -ForegroundColor Green
    Write-Host "Forwarding target: $ApiUrl" -ForegroundColor Gray
    Write-Host "API Key loaded: $(if ($ApiKey) { $ApiKey.Substring(0, [Math]::Min(5, $ApiKey.Length)) + '...' } else { 'None' })" -ForegroundColor Gray
    Write-Host "Press [Ctrl+C] to stop monitoring." -ForegroundColor Yellow
    Write-Host ""

    # Construct Generic ReadOnlyList type for UserNotification list retrieval
    $readOnlyListGenericType = [System.Collections.Generic.IReadOnlyList[int]].GetGenericTypeDefinition()
    $listType = $readOnlyListGenericType.MakeGenericType($NotificationType)

    # Cache already existing notifications so we don't forward old history
    $seenIds = @{}
    try {
        $existingOp = $listener.GetNotificationsAsync($KindsType::Toast)
        $existing = Wait-WinRT $existingOp $listType

        if ($SendExisting) {
            Write-Host "Forwarding $($existing.Count) pre-existing notifications currently in Action Center..." -ForegroundColor Cyan
        } else {
            foreach ($n in $existing) {
                $seenIds[$n.Id] = $true
            }
            Write-Host "Ignored $($existing.Count) pre-existing notifications currently in Action Center." -ForegroundColor DarkGray
        }
    } catch {
        Write-Warning "Failed to fetch pre-existing notifications: $_"
    }

    # Main polling loop
    while ($true) {
        try {
            $notificationsOp = $listener.GetNotificationsAsync($KindsType::Toast)
            $notifications = Wait-WinRT $notificationsOp $listType

            foreach ($n in $notifications) {
                $id = $n.Id
                if (-not $seenIds.ContainsKey($id)) {
                    $seenIds[$id] = $true

                    # 1. Extract Application Name
                    $appName = $n.AppInfo.DisplayInfo.DisplayName
                    if (-not $appName) { $appName = "System" }

                    # 2. Extract Title and Body
                    $title = "Notification"
                    $message = ""

                    $toastBinding = $n.Notification.Visual.GetBinding($BindingsType::ToastGeneric)
                    if ($toastBinding) {
                        $textElements = $toastBinding.GetTextElements()
                        $elements = @($textElements)

                        if ($elements.Count -gt 0) {
                            $title = $elements[0].Text
                        }
                        if ($elements.Count -gt 1) {
                            $bodyLines = @()
                            for ($i = 1; $i -lt $elements.Count; $i++) {
                                $bodyLines += $elements[$i].Text
                            }
                            $message = $bodyLines -join " "
                        }
                    }

                    if (-not $message) { $message = "New notification from $appName" }

                    # 3. Categorize Type Based on Keywords
                    $type = "info"
                    $lowerText = "$title $message".ToLower()
                    if ($lowerText -like "*success*" -or $lowerText -like "*completed*" -or $lowerText -like "*done*" -or $lowerText -like "*passed*") {
                        $type = "success"
                    } elseif ($lowerText -like "*fail*" -or $lowerText -like "*error*" -or $lowerText -like "*critical*") {
                        $type = "error"
                    } elseif ($lowerText -like "*warn*") {
                        $type = "warning"
                    }

                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] New Toast - App: $appName | Title: $title" -ForegroundColor Cyan

                    # 4. Construct Payload
                    $payload = @{
                        "type"     = $type
                        "source"   = $appName
                        "title"    = $title
                        "message"  = $message
                        "category" = "system"
                    } | ConvertTo-Json -Compress

                    # 5. Forward to Remote API
                    try {
                        $headers = @{
                            "${authHeaderName}" = $ApiKey
                            "Content-Type"      = "application/json; charset=utf-8"
                        }
                        $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
                        [void](Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $headers -Body $bodyBytes -UseBasicParsing)
                        Write-Host " -> Successfully forwarded to API." -ForegroundColor Green
                    } catch {
                        Write-Host " -> Forwarding failed: $_" -ForegroundColor Red
                    }
                }
            }
        } catch {
            Write-Warning "Error during notification polling: $_"
        }

        Start-Sleep -Seconds $PollInterval
    }
}

param (
    [string]$ApiUrl = "${apiUrl}",
    [string]$ApiKey = "${authHeaderValue}",
    [int]$PollInterval = 2,
    [switch]$SendExisting
)

# 1. Relaunch in Windows PowerShell (5.1) if running in PowerShell Core/7+
# PowerShell 7 does not support native WinRT projections (ContentType=WindowsRuntime)
if ($PSEdition -eq 'Core') {
    Write-Host "PowerShell 7+ detected. Relaunching in Windows PowerShell 5.1 for native Windows Runtime support..." -ForegroundColor Yellow

    $paramString = ""
    if ($PSBoundParameters.ContainsKey('ApiUrl')) { $paramString += " -ApiUrl '$($PSBoundParameters['ApiUrl'])'" } else { $paramString += " -ApiUrl '${apiUrl}'" }
    if ($PSBoundParameters.ContainsKey('ApiKey')) { $paramString += " -ApiKey '$($PSBoundParameters['ApiKey'])'" } else { $paramString += " -ApiKey '${authHeaderValue}'" }
    if ($PSBoundParameters.ContainsKey('PollInterval')) { $paramString += " -PollInterval $($PSBoundParameters['PollInterval'])" }
    if ($PSBoundParameters.ContainsKey('SendExisting') -and $PSBoundParameters['SendExisting'].IsPresent) { $paramString += " -SendExisting" }

    $scriptText = $ScriptBlock.ToString()
    $command = "& { $scriptText } $paramString"

    $bytes = [System.Text.Encoding]::Unicode.GetBytes($command)
    $encoded = [Convert]::ToBase64String($bytes)

    # Run using the native powershell.exe engine
    powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
    exit $LASTEXITCODE
} else {
    # If in Windows PowerShell 5.1, execute the script block directly
    & $ScriptBlock @PSBoundParameters
}`);

  const androidScript = $derived(`#!/bin/bash
# Axe Notification Mirror (Android / Termux)
# Requires: Termux:API app and 'pkg install termux-api jq'

API_URL="${apiUrl}"
LAST_ID=""

echo "Monitoring Android notifications..."

while true; do
  # Get the latest notification
  NEW_NOTIF=$(termux-notification-list | jq -r '.[0]')
  ID=$(echo "$NEW_NOTIF" | jq -r '.id')
  
  if [[ "$ID" != "$LAST_ID" && "$ID" != "null" ]]; then
    TITLE=$(echo "$NEW_NOTIF" | jq -r '.title')
    MSG=$(echo "$NEW_NOTIF" | jq -r '.content')
    
    curl -s -X POST "$API_URL" \\
      ${authHeader} \\
      -H "Content-Type: application/json" \\
      -d "{
        \\"type\\": \\"info\\",
        \\"source\\": \\"Android Mirror\\",
        \\"title\\": \\"$TITLE\\",
        \\"message\\": \\"$MSG\\",
        \\"category\\": \\"mobile\\"
      }" > /dev/null
      
    LAST_ID="$ID"
  fi
  sleep 2
done`);

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
        authStore.user.email,
        trimmed,
      );
      keyState.generated = key;
      keyState.selected = key;
      keyState.newName = "";
    } catch (e) {
      error = e.message || "Failed to create API key";
    } finally {
      loading = false;
    }
  }

  async function handleDeleteKey(id) {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    try {
      await deleteApiKey(id);
      if (keyState.list.length === 1) keyState.selected = "";
    } catch (e) {
      console.error(e);
    }
  }
</script>

{#snippet selectDropdown(id, label, options)}
  <div>
    <label
      for={id}
      class="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1"
      >{label}</label
    >
    <select
      {id}
      bind:value={form[id]}
      class="block w-full border-b border-border bg-transparent py-3 text-sm outline-none focus:border-foreground disabled:opacity-30 rounded-none cursor-pointer text-foreground"
    >
      {#each options as opt}
        <option value={opt} class="bg-background text-foreground">{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
      {/each}
    </select>
  </div>
{/snippet}

<div>
  <div class="mb-8">
    <h1 class="text-2xl font-bold tracking-tight lowercase">cli integration</h1>
  </div>

  <section class="space-y-8">
    <div class="rounded-md border border-border bg-surface p-8">
      <div class="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-xs font-bold uppercase tracking-widest text-foreground">1. Authentication</h2>
        <div class="flex w-full gap-1 rounded-md border border-border bg-background p-1 sm:w-auto">
          {#each [{ id: "bearer", label: "Bearer Token" }, { id: "apikey", label: "API Key" }] as method}
            <button
              onclick={() => (keyState.method = method.id)}
              class="flex-1 rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer sm:flex-none {keyState.method === method.id ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}"
            >
              {method.label}
            </button>
          {/each}
        </div>
      </div>

      {#if keyState.method === "bearer"}
        <div class="space-y-6">
          <p class="text-xs text-gray-500">
            Standard Firebase ID token. Highly secure but expires every hour.
          </p>
          <div class="flex flex-col gap-6">
            <div class="relative w-full overflow-hidden rounded-md border border-border bg-background">
              <div class="flex items-center justify-between border-b border-border bg-foreground/5 px-4 py-2">
                <span class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Firebase Bearer Token</span>
                {#if token}
                  <CopyButton text={token} label="Copy" />
                {/if}
              </div>
              <div class="p-4">
                <textarea
                  readonly
                  class="h-24 w-full break-all outline-none bg-transparent text-xs font-mono text-foreground resize-none"
                  value={token || "Click 'Generate Token' below to view your current Bearer token."}
                ></textarea>
              </div>
            </div>
            <div class="flex">
              <Button
                onclick={refreshToken}
                {loading}
                className="w-full md:w-auto"
              >
                {token ? "Refresh Token" : "Generate Token"}
              </Button>
            </div>
          </div>
        </div>
      {:else}
        <div class="space-y-6">
          <p class="text-xs text-gray-500">
            Long-lived keys for persistent workflows like server monitoring or automation.
          </p>

          {#if keyState.generated}
            <div class="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-6">
              <p class="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Key Generated Successfully
              </p>
              <p class="mb-4 text-xs text-emerald-600/80 dark:text-emerald-400/80">
                Copy this key now. For your security, it won't be shown again.
              </p>
              <div class="flex flex-wrap gap-4">
                <div class="flex min-w-0 grow gap-2">
                  <input
                    readonly
                    value={keyState.generated}
                    class="min-w-0 grow outline-none rounded-md border border-emerald-500/30 bg-background px-3 py-2 text-xs font-mono text-foreground"
                  />
                  <CopyButton 
                    text={keyState.generated} 
                    className="bg-emerald-500/10"
                  />
                </div>
                <Button
                  variant="secondary"
                  className="py-2! w-full sm:w-auto"
                  onclick={() => (keyState.generated = "")}
                >
                  Done
                </Button>
              </div>
            </div>
          {/if}

          {#if error}<Alert type="error" message={error} />{/if}

          <div class="space-y-6">
            {#if keyState.list.length > 0}
              <div class="space-y-2">
                <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Active Keys
                </div>
                <div class="divide-y divide-border rounded-md border border-border bg-background">
                  {#each keyState.list as key}
                    <div class="flex items-center justify-between gap-4 p-4">
                      <div class="flex min-w-0 flex-col">
                        <span class="truncate text-xs font-bold uppercase tracking-wider text-foreground">
                          {key.name}
                        </span>
                        <span class="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                          Created {key.createdAt?.toDate ? key.createdAt.toDate().toLocaleDateString() : "Just now"}
                        </span>
                      </div>
                      <div class="flex shrink-0 items-center gap-4">
                        <button
                          onclick={() => (keyState.selected = key.key)}
                          class="text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer {keyState.selected === key.key ? 'text-foreground font-black' : 'text-gray-500 hover:text-foreground'}"
                        >
                          {keyState.selected === key.key ? "Selected" : "Select"}
                        </button>
                        <button
                          onclick={() => handleDeleteKey(key.id)}
                          aria-label="Delete API key {key.name}"
                          class="text-gray-400 hover:text-rose-500 transition-none cursor-pointer"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                          >
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="pt-4 border-t border-border/30">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div class="grow">
                  <Input
                    id="new-key-input"
                    label="Create New Key"
                    bind:value={keyState.newName}
                    placeholder="e.g. Production Server"
                  />
                </div>
                <Button
                  className="w-full sm:w-auto"
                  onclick={handleCreateKey}
                  {loading}
                  disabled={!keyState.newName.trim()}
                >
                  Create Key
                </Button>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="rounded-md border border-border bg-surface p-8">
      <h2 class="text-xs font-bold uppercase tracking-widest text-foreground mb-8">2. Customize Notification</h2>
      <div class="grid grid-cols-1 gap-8 sm:grid-cols-2">
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
      <h2 class="text-xs font-bold uppercase tracking-widest text-foreground">3. Copy & Run Command</h2>
      <p class="text-xs text-gray-500">
        This command updates live as you change the fields above.
      </p>
      <CodeBlock code={curlCommand} onCopy={randomizeContent} />
    </div>

    <div class="space-y-4">
      <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 class="text-xs font-bold uppercase tracking-widest text-foreground">4. Notification Mirroring</h2>
        <div class="flex w-full gap-1 rounded-md border border-border bg-background p-1 sm:w-auto">
          {#each ["bash", "powershell", "android"] as scriptMode}
            <button
              onclick={() => (automationTab = scriptMode)}
              class="flex-1 rounded-sm px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-none cursor-pointer sm:flex-none {automationTab === scriptMode ? 'bg-foreground text-background' : 'text-gray-500 hover:text-foreground bg-transparent'}"
            >
              {scriptMode}
            </button>
          {/each}
        </div>
      </div>
      <p class="text-xs text-gray-500">
        Run these scripts to mirror system notifications (toasts) directly to your axe dashboard in real-time.
      </p>
      {#if automationTab === "bash"}
        <CodeBlock code={bashScript} title="Linux Mirror (DBus)" />
      {:else if automationTab === "powershell"}
        <CodeBlock code={powershellScript} title="Windows Mirror (WinRT)" />
      {:else if automationTab === "android"}
        <CodeBlock code={androidScript} title="Android Mirror (Termux)" />
      {/if}
    </div>
  </section>
</div>
