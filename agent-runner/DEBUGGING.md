# Debugging Guide for `npm start`

## Pre-Start Validation

Before running `npm start`, a pre-start check automatically runs to validate your setup. You can also run it manually:

```bash
npm run pre-start-check
```

## Common Issues and Fixes

### 1. Missing Environment Variables

**Error:** `❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`

**Fix:** Create a `.env` file in `agent-runner/` directory with:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url  # Alternative
SUPABASE_SERVICE_KEY=your_service_role_key  # Alternative
```

### 2. Missing Dependencies

**Error:** `node_modules not found`

**Fix:** Run `npm install` in the `agent-runner/` directory

### 3. Wrong Node.js Version

**Error:** Node.js version < 20

**Fix:** Upgrade to Node.js 20 or higher. Check version with `node --version`

### 4. Missing Supabase Client File

**Error:** `Cannot find module '../supabase-client'`

**Fix:** The `supabase-client.ts` file should exist in `agent-runner/` directory. If missing, it will be created automatically.

### 5. Database Connection Issues

**Symptoms:** Errors when trying to connect to Supabase

**Fix:** 
- Verify `SUPABASE_URL` is correct
- Verify `SUPABASE_SERVICE_ROLE_KEY` is the service_role key (not anon key)
- Check network connectivity
- Verify Supabase project is active

### 6. Missing API Keys (Non-Critical)

**Warning:** Missing API keys for AI models

**Impact:** Some features may not work, but the runner will still start

**Optional Keys:**
- `ANTHROPIC_API_KEY` - For Claude Coder
- `OPENAI_API_KEY` - For OpenAI models
- `DEEPSEEK_API_KEY` - For DeepSeek Planner
- `GROQ_API_KEY` - For Groq Code Reviewer
- `KIMI_API_KEY` or `MOONSHOT_API_KEY` - For Kimi Research Synthesis

### 7. Workspace Directory Issues

**Warning:** Workspace sandbox directory doesn't exist

**Fix:** Will be created automatically on first run

### 8. TypeScript Compilation Errors

**Error:** TypeScript errors when starting

**Fix:** 
- Check `tsconfig.json` exists
- Run `npm run build` to see detailed errors
- Fix TypeScript errors before starting

## Runtime Issues

### Import Errors

If you see import errors:
1. Check that all required files exist
2. Verify import paths are correct
3. Ensure `node_modules` is installed

### Port Conflicts

If port is already in use:
- Set `PORT` environment variable to a different port
- Or stop the process using the port

### Memory Issues

If running out of memory:
- Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096" npm start`
- Close other applications
- Consider running on a machine with more RAM

## Debugging Steps

1. **Run pre-start check:**
   ```bash
   npm run pre-start-check
   ```

2. **Check environment variables:**
   ```bash
   # Windows PowerShell
   Get-Content .env
   
   # Linux/Mac
   cat .env
   ```

3. **Verify dependencies:**
   ```bash
   npm list --depth=0
   ```

4. **Check logs:**
   - Look for error messages in console output
   - Check for stack traces
   - Verify error messages match known issues above

5. **Test individual components:**
   ```bash
   # Test Supabase connection
   npm run health-check
   
   # Test integration
   npm run test:contracts
   ```

## Recent Fixes Applied

1. ✅ Fixed `supabase-client.ts` to load dotenv properly
2. ✅ Increased Kimi K2 timeout from 5 minutes to 10 minutes
3. ✅ Added dotenv.config() to index.ts for early environment loading
4. ✅ Created pre-start validation script
5. ✅ Fixed TypeScript incremental option error in contract-check.ts

## Getting Help

If issues persist:
1. Check the error message carefully
2. Verify all environment variables are set correctly
3. Ensure Node.js version is >= 20
4. Check that all dependencies are installed
5. Review the pre-start check output for specific issues

