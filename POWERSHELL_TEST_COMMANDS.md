# 🔧 PowerShell Test Commands for Kimi API

## ✅ PowerShell-Compatible Commands

### Test 1: Check API Key (PowerShell)

```powershell
# Check if API key exists
if ($env:MOONSHOT_API_KEY) {
    Write-Host "✅ MOONSHOT_API_KEY is set"
    Write-Host "   Length: $($env:MOONSHOT_API_KEY.Length)"
    Write-Host "   Prefix: $($env:MOONSHOT_API_KEY.Substring(0, [Math]::Min(10, $env:MOONSHOT_API_KEY.Length)))***"
} else {
    Write-Host "❌ MOONSHOT_API_KEY not set"
}
```

### Test 2: Test API Directly (PowerShell)

```powershell
# Test Kimi API
$apiKey = $env:MOONSHOT_API_KEY
$headers = @{
    "Authorization" = "Bearer $apiKey"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "https://api.moonshot.ai/v1/models" -Method Get -Headers $headers
    Write-Host "✅ API Key is VALID!"
    Write-Host "Available models:"
    $response.data | ForEach-Object { Write-Host "  - $($_.id)" }
} catch {
    Write-Host "❌ API Test FAILED: $($_.Exception.Message)"
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)"
}
```

### Test 3: Run Test Script (PowerShell)

```powershell
# Run PowerShell test script
.\scripts\test-kimi-api.ps1

# Or run TypeScript version
npm run test:kimi
```

---

## 🚀 Quick Test

### Option 1: PowerShell Script

```powershell
cd C:\Users\vilme\frost-night-factory
.\scripts\test-kimi-api.ps1
```

### Option 2: TypeScript Script

```powershell
cd agent-runner
npm run test:kimi
```

### Option 3: Manual PowerShell Test

```powershell
# Set API key (if not already set)
$env:MOONSHOT_API_KEY = "your-api-key-here"

# Test
$headers = @{ "Authorization" = "Bearer $env:MOONSHOT_API_KEY" }
Invoke-RestMethod -Uri "https://api.moonshot.ai/v1/models" -Headers $headers
```

---

## 🔍 Debugging

### Check Environment Variables

```powershell
# List all MOONSHOT/KIMI related env vars
Get-ChildItem Env: | Where-Object { $_.Name -like "*MOONSHOT*" -or $_.Name -like "*KIMI*" }
```

### Check API Key Format

```powershell
# Check if key starts with "sk-"
if ($env:MOONSHOT_API_KEY -like "sk-*") {
    Write-Host "✅ Key format looks correct"
} else {
    Write-Host "⚠️  Key doesn't start with 'sk-'"
}

# Check for whitespace
if ($env:MOONSHOT_API_KEY -match "^\s|\s$") {
    Write-Host "⚠️  Key has leading/trailing whitespace"
} else {
    Write-Host "✅ No whitespace detected"
}
```

### Test with curl.exe (if available)

```powershell
# Use curl.exe (not PowerShell's curl alias)
curl.exe -H "Authorization: Bearer $env:MOONSHOT_API_KEY" https://api.moonshot.ai/v1/models
```

---

## 📝 Expected Output

### Success:
```
✅ API Key found: sk-xxxxx***
   Length: XX characters

📡 Testing endpoint: https://api.moonshot.ai/v1/models

✅ API Key is VALID!

Available models:
  - kimi-k2-thinking
  - kimi-k2-instruct
  - ...
```

### Failure (401):
```
❌ API Test FAILED
   Status Code: 401
   Error: Invalid Authentication

🔑 Authentication Error - Check:
   1. API key is correct (starts with 'sk-')
   2. API key is not expired
   3. No extra spaces in API key
   4. Account is active at: https://platform.moonshot.ai
```

---

## ✅ Quick Checklist

- [ ] API key is set: `$env:MOONSHOT_API_KEY`
- [ ] Key starts with `sk-`
- [ ] No whitespace in key
- [ ] Run test script: `.\scripts\test-kimi-api.ps1`
- [ ] Check output for success/failure
- [ ] If 401: Verify account at https://platform.moonshot.ai

