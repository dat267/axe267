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

  const scriptUrl = $derived(typeof window !== "undefined" ? `${window.location.origin}/win.ps1` : `https://${projectId}.web.app/win.ps1`);

  const powershellScript = $derived(`# Axe Notification Mirror (Windows)
# Run this one-liner in PowerShell (5.1 or 7+) to monitor and mirror Windows notifications.
# It downloads and executes the mirrored script hosted on your axe instance.
& ([scriptblock]::Create((irm "${scriptUrl}"))) -ApiUrl "${apiUrl}" -ApiKey "${authHeaderValue}"`);

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
