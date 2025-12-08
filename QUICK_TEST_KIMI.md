# 🚀 Quick Test - Kimi API Key (PowerShell)

## ✅ Test Your API Key Now

### Option 1: PowerShell Script (Easiest)

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
# Check if API key is set
if ($env:MOONSHOT_API_KEY) {
    Write-Host "✅ API Key found: $($env:MOONSHOT_API_KEY.Substring(0, 10))***"
    
    # Test API
    $headers = @{
        "Authorization" = "Bearer $env:MOONSHOT_API_KEY"
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "https://api.moonshot.ai/v1/models" -Method Get -Headers $headers
        Write-Host "✅ API Key is VALID!"
        Write-Host "Available models:"
        $response.data | ForEach-Object { Write-Host "  - $($_.id)" }
    } catch {
        Write-Host "❌ FAILED: $($_.Exception.Message)"
        Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)"
    }
} else {
    Write-Host "❌ MOONSHOT_API_KEY not set"
    Write-Host "Set it with: `$env:MOONSHOT_API_KEY = 'your-key'"
}
```

---

## 🔍 What to Look For

### ✅ Success:
```
✅ API Key found: sk-xxxxx***
✅ API Key is VALID!
Available models:
  - kimi-k2-thinking
  - kimi-k2-instruct
```

### ❌ Failure (401):
```
❌ FAILED: Invalid Authentication
   Status: 401

🔑 Check:
   1. API key format (should start with 'sk-')
   2. No extra spaces
   3. Account is active
```

---

## 🎯 Next Steps

1. **Run test script** (choose one):
   ```powershell
   # PowerShell script
   .\scripts\test-kimi-api.ps1
   
   # OR TypeScript script
   cd agent-runner
   npm run test:kimi
   ```

2. **If 401 error persists:**
   - Check API key at: https://platform.moonshot.ai
   - Verify key is active
   - Check for whitespace: `$env:MOONSHOT_API_KEY.Trim()`

3. **If test passes:**
   - Restart agent-runner: `npm run dev`
   - Check logs for: `✅ [Kimi] Client initialized successfully`

---

**Ready to test! Run the script above. 🚀**

