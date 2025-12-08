# =============================================================================
# KIMI API KEY TEST - PowerShell Version
# =============================================================================
# Tests Kimi/Moonshot API key validity

Write-Host "🔍 Testing Kimi/Moonshot API Key..." -ForegroundColor Cyan
Write-Host ""

# Get API key from environment
$apiKey = $env:MOONSHOT_API_KEY
if (-not $apiKey) {
    $apiKey = $env:KIMI_API_KEY
}

if (-not $apiKey) {
    Write-Host "❌ ERROR: MOONSHOT_API_KEY or KIMI_API_KEY not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Set it with:" -ForegroundColor Yellow
    Write-Host "  `$env:MOONSHOT_API_KEY = 'your-api-key'" -ForegroundColor Yellow
    exit 1
}

# Display API key info (first 10 chars only)
$keyPrefix = $apiKey.Substring(0, [Math]::Min(10, $apiKey.Length))
Write-Host "✅ API Key found: $keyPrefix***" -ForegroundColor Green
Write-Host "   Length: $($apiKey.Length) characters" -ForegroundColor Gray
Write-Host ""

# Test API endpoint
Write-Host "📡 Testing endpoint: https://api.moonshot.ai/v1/models" -ForegroundColor Cyan
Write-Host ""

try {
    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "https://api.moonshot.ai/v1/models" -Method Get -Headers $headers
    
    Write-Host "✅ API Key is VALID!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available models:" -ForegroundColor Cyan
    foreach ($model in $response.data) {
        Write-Host "  - $($model.id)" -ForegroundColor Gray
    }
    
    # Check for K2 models specifically
    $k2Models = $response.data | Where-Object { $_.id -like "*k2*" }
    if ($k2Models) {
        Write-Host ""
        Write-Host "✅ K2 models available:" -ForegroundColor Green
        foreach ($model in $k2Models) {
            Write-Host "  - $($model.id)" -ForegroundColor Green
        }
    } else {
        Write-Host ""
        Write-Host "⚠️  No K2 models found in response" -ForegroundColor Yellow
    }
    
    exit 0
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    Write-Host "❌ API Test FAILED" -ForegroundColor Red
    Write-Host "   Status Code: $statusCode" -ForegroundColor Red
    Write-Host "   Error: $errorMessage" -ForegroundColor Red
    Write-Host ""
    
    if ($statusCode -eq 401) {
        Write-Host "🔑 Authentication Error - Check:" -ForegroundColor Yellow
        Write-Host "   1. API key is correct (starts with 'sk-')" -ForegroundColor Yellow
        Write-Host "   2. API key is not expired" -ForegroundColor Yellow
        Write-Host "   3. No extra spaces in API key" -ForegroundColor Yellow
        Write-Host "   4. Account is active at: https://platform.moonshot.ai" -ForegroundColor Yellow
    } elseif ($statusCode -eq 429) {
        Write-Host "⏱️  Rate Limit Error - Wait before retrying" -ForegroundColor Yellow
    }
    
    exit 1
}

