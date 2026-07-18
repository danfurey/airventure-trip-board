$ErrorActionPreference = 'Stop'

function Read-DotEnv([string]$Path) {
    if (-not (Test-Path $Path)) {
        throw "Cannot find $Path"
    }

    $values = @{}
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $parts = $trimmed.Split('=', 2)
        if ($parts.Count -ne 2) { continue }
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        $values[$key] = $value
    }
    return $values
}

function Get-HttpErrorBody($ErrorRecord) {
    if ($ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
        return $ErrorRecord.ErrorDetails.Message
    }
    try {
        $response = $ErrorRecord.Exception.Response
        if ($null -ne $response -and $null -ne $response.GetResponseStream()) {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            return $reader.ReadToEnd()
        }
    } catch {}
    return $ErrorRecord.Exception.Message
}

$envPath = Join-Path $PSScriptRoot '.env.local'
Write-Host "Firebase configuration diagnostic" -ForegroundColor Cyan
Write-Host "Reading: $envPath"
$config = Read-DotEnv $envPath

$required = @(
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
    'VITE_TRIP_ID'
)

$missing = @($required | Where-Object { -not $config.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($config[$_]) })
if ($missing.Count -gt 0) {
    Write-Host "FAIL: Missing required variables:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    exit 1
}

Write-Host "PASS: Required environment variables are present." -ForegroundColor Green
Write-Host "Project ID: $($config['VITE_FIREBASE_PROJECT_ID'])"
Write-Host "Auth domain: $($config['VITE_FIREBASE_AUTH_DOMAIN'])"
Write-Host "Trip ID: $($config['VITE_TRIP_ID'])"

# Test 1: Anonymous Authentication. This validates the API key and whether
# the Anonymous provider is enabled for the Firebase project behind that key.
$authUri = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$($config['VITE_FIREBASE_API_KEY'])"
$authBody = @{ returnSecureToken = $true } | ConvertTo-Json -Compress

try {
    $authResult = Invoke-RestMethod -Method Post -Uri $authUri -ContentType 'application/json' -Body $authBody
    if (-not $authResult.idToken) { throw 'Firebase returned no ID token.' }
    Write-Host "PASS: Anonymous Authentication succeeded." -ForegroundColor Green
    Write-Host "Anonymous UID: $($authResult.localId)"
} catch {
    Write-Host "FAIL: Anonymous Authentication failed." -ForegroundColor Red
    Write-Host (Get-HttpErrorBody $_) -ForegroundColor Yellow
    Write-Host "Check Firebase Console > Authentication > Sign-in method > Anonymous." -ForegroundColor Yellow
    exit 2
}

# Test 2: Firestore server read. This validates that the configured project ID
# matches the Auth project, the (default) Firestore database exists, and the
# deployed rules allow an authenticated read of the shared votes collection.
$projectId = $config['VITE_FIREBASE_PROJECT_ID']
$tripId = [uri]::EscapeDataString($config['VITE_TRIP_ID'])
$firestoreUri = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/trips/$tripId/votes?pageSize=1"
$headers = @{ Authorization = "Bearer $($authResult.idToken)" }

try {
    $firestoreResult = Invoke-RestMethod -Method Get -Uri $firestoreUri -Headers $headers
    $count = 0
    if ($null -ne $firestoreResult.documents) { $count = @($firestoreResult.documents).Count }
    Write-Host "PASS: Firestore server read succeeded." -ForegroundColor Green
    Write-Host "Documents returned: $count"
    Write-Host "Firebase configuration is functional." -ForegroundColor Green
    exit 0
} catch {
    $body = Get-HttpErrorBody $_
    Write-Host "FAIL: Firestore server read failed." -ForegroundColor Red
    Write-Host $body -ForegroundColor Yellow
    Write-Host "Likely causes:" -ForegroundColor Yellow
    Write-Host "  - Firestore Database was not created." -ForegroundColor Yellow
    Write-Host "  - The database is not named (default)." -ForegroundColor Yellow
    Write-Host "  - VITE_FIREBASE_PROJECT_ID does not match the web app configuration." -ForegroundColor Yellow
    Write-Host "  - firebase/firestore.rules were not published." -ForegroundColor Yellow
    Write-Host "  - App Check enforcement was enabled without configuring App Check in the web app." -ForegroundColor Yellow
    exit 3
}
