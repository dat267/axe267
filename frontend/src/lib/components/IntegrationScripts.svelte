<script>
  import CodeBlock from "./CodeBlock.svelte";

  let { apiUrl, authHeader, authHeaderName, authHeaderValue } = $props();

  let automationTab = $state("bash");

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

& {
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

        # Extract this block's string content and build encoded command relaunch
        $scriptText = $MyInvocation.MyCommand.ScriptBlock.ToString()
        $command = "& { $scriptText } $paramString"

        $bytes = [System.Text.Encoding]::Unicode.GetBytes($command)
        $encoded = [Convert]::ToBase64String($bytes)

        # Run using the native powershell.exe engine
        powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded
        exit $LASTEXITCODE
    }

    # 2. Load API Key from the .env file if ApiKey is not explicitly passed
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
} @args`);

  const androidScript = $derived(`#!/bin/bash
# Axe Notification Mirror (Android / Termux)
# Requires: Termux:API app and 'pkg install termux-api jq'

API_URL="${apiUrl}"
SEEN_FILE="$HOME/.ntfy_seen"
LOG_FILE="$HOME/log/ntfy.log"

# Ensure log directory and file exist
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

log() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# Ensure seen file exists
touch "$SEEN_FILE"

log "Monitoring Android notifications..."

# Clear seen file on start to send all existing notifications in first iteration
> "$SEEN_FILE"

while true; do
    # 1. Fetch current notifications
    NOTIFS_JSON=$(termux-notification-list)

    # 2. Extract current keys and find NEW ones
    echo "$NOTIFS_JSON" | jq -r '.[].key' | sort > "\${SEEN_FILE}.tmp"
    NEW_KEYS=$(comm -13 "$SEEN_FILE" "\${SEEN_FILE}.tmp")

    # 3. Update seen file for next iteration
    mv "\${SEEN_FILE}.tmp" "$SEEN_FILE"

    # 4. Process new notifications
    if [[ -n "$NEW_KEYS" ]]; then
        while read -r KEY; do
            [[ -z "$KEY" ]] && continue

            # Extract single notification details
            NOTIF=$(echo "$NOTIFS_JSON" | jq -c --arg k "$KEY" '.[] | select(.key == $k)')

            # Filter: Skip system apps
            PKG=$(echo "$NOTIF" | jq -r '.packageName')
            if [[ "$PKG" =~ ^(android|com\\.android|com\\.google\\.android|com\\.sec\\.android) ]]; then
                continue
            fi

            # Extract content (fallback to lines for summary notifications)
            TITLE=$(echo "$NOTIF" | jq -r '.title // ""')
            CONTENT=$(echo "$NOTIF" | jq -r '.content // ""')
            if [[ -z "$CONTENT" || "$CONTENT" == "null" ]]; then
                CONTENT=$(echo "$NOTIF" | jq -r '.lines // [] | join("\\n")')
            fi

            # Skip if both are empty
            if [[ -z "$TITLE" && -z "$CONTENT" ]]; then
                continue
            fi

            log "Sending: $TITLE"

            # 5. Send to API safely using jq to build the payload
            jq -n --arg t "$TITLE" --arg c "$CONTENT" \\
                '{type: "info", source: "Android Mirror", title: $t, message: $c, category: "mobile"}' | \\
            curl -s -X POST "$API_URL" \\
                ${authHeader} \\
                -H "Content-Type: application/json" \\
                -d @- > /dev/null

        done <<< "$NEW_KEYS"
    fi

    sleep 2
done`);
</script>

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
