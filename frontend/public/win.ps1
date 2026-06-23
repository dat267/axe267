# Axe Notification Mirror (Windows)
# Forwards Windows Toast notifications to axe.
# Note: Requires "Notification Access" permission for PowerShell.

param (
    [string]$ApiUrl = "",
    [string]$ApiKey = "",
    [int]$PollInterval = 2,
    [switch]$SendExisting
)

# 1. Relaunch in Windows PowerShell (5.1) if running in PowerShell Core/7+
# PowerShell 7 does not support native WinRT projections (ContentType=WindowsRuntime)
if ($PSEdition -eq 'Core') {
    Write-Host "PowerShell 7+ detected. Relaunching in Windows PowerShell 5.1 for native Windows Runtime support..." -ForegroundColor Yellow

    $paramString = ""
    if ($PSBoundParameters.ContainsKey('ApiUrl')) { $paramString += " -ApiUrl '$($PSBoundParameters['ApiUrl'])'" }
    if ($PSBoundParameters.ContainsKey('ApiKey')) { $paramString += " -ApiKey '$($PSBoundParameters['ApiKey'])'" }
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

# 2. Automatically format API Key if it's a raw JWT token
if ($ApiKey -and -not ($ApiKey -like "Bearer *") -and -not ($ApiKey -like "ntfy_*") -and $ApiKey.Contains(".")) {
    $ApiKey = "Bearer $ApiKey"
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
                    $headerName = if ($ApiKey -like "Bearer *") { "Authorization" } else { "x-api-key" }
                    $headers = @{
                        $headerName         = $ApiKey
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
