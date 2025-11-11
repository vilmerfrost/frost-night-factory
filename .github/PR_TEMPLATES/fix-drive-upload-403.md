# PR #1: fix/drive-upload-403

## Problem
Nightly workflow fails at "Upload briefs to Google Drive" with:
```
status: 403, reason: accessNotConfigured
message: "Google Drive API has not been used in project ... or is disabled"
```

## Root Cause
1. **Wrong Auth Method**: Used `JWT` auth instead of `GoogleAuth`
2. **No Retry Logic**: Transient 429/5xx errors not handled
3. **Poor Error Messages**: 403 errors didn't explain required actions
4. **No Metadata**: No tracking of what was uploaded

## Solution

### 1. **GoogleAuth Migration** ✅
- Replaced `google.auth.JWT` with `google.auth.GoogleAuth`
- Added both `drive.file` and `drive` scopes
- Proper credential validation with helpful error messages

### 2. **Exponential Backoff with Jitter** ✅
- Retry on 429 (rate limit) and 5xx (server errors)
- 3 attempts max with exponential backoff: 1s → 2s → 4s
- 30% jitter to prevent thundering herd

### 3. **403 Special Handling** ✅
When `accessNotConfigured` detected, show actionable error:
```
❌ Google Drive API not enabled or not propagated yet.
   Action required:
   1. Enable Google Drive API in Google Cloud Console for project: <project_id>
   2. Share folder <folder_id> with service account: <email>
   3. Wait ~5 minutes for propagation, then retry.
```

### 4. **Metadata Logging** ✅
- Save upload results to `reports/drive_uploads.json`
- Include: file name, ID, size, webViewLink, action, timestamp
- Show in morning brief: "3 fil(er): 1 ny, 2 uppdaterad (47 KB)"

### 5. **Better Console Output** ✅
```
🚀 Starting Google Drive upload...
   Service Account: night-factory-sa@...
   Target Folder ID: 1A2B3C...
📤 Uploading 3 file(s)...
🔁 Updated: briefs_all.txt (12345 bytes)
⬆️  Uploaded: brief_001.txt (5678 bytes)
✅ Drive sync complete: 3 file(s) uploaded
   📊 Summary: 1 created, 2 updated, 18023 bytes total
```

## Changes

### Modified Files
- `scripts/upload_to_drive.js` - Complete rewrite with retry logic
- `scripts/morning_brief.js` - Add Drive metadata section

### New Files
- `reports/drive_uploads.json` - Upload metadata (created at runtime)

## Testing Plan

### Manual Test (Local)
```bash
# Set test secrets
export GDRIVE_SA_JSON='{"type":"service_account",...}'
export GDRIVE_FOLDER_ID='your-folder-id'

# Create test files
mkdir -p podcast/export
echo "Test content" > podcast/export/test_brief.txt

# Run script
node scripts/upload_to_drive.js

# Verify:
# 1. File appears in Drive folder
# 2. reports/drive_uploads.json created
# 3. Console shows detailed logs
```

### CI Test
```bash
# Trigger nightly workflow manually
gh workflow run nightly.yml

# Wait for "Upload briefs to Google Drive" step
# Expected: GREEN ✅ if API enabled + folder shared
# Expected: Clear error message if not configured
```

### Expected Errors & Fixes

**Error 1: "API not enabled"**
```
❌ Google Drive API not enabled or not propagated yet.
```
**Fix:** Enable Drive API in GCP Console, wait 5 min, retry

**Error 2: "Folder not shared"**
```
❌ Failed to upload: 404 File not found
```
**Fix:** Share folder with `night-factory-sa@frost-night-factory.iam.gserviceaccount.com` as Editor

**Error 3: "Invalid credentials"**
```
❌ Invalid GDRIVE_SA_JSON format
```
**Fix:** Verify secret contains full JSON (not just email)

## Rollback Plan
If this PR causes issues:
```bash
git revert <commit-sha>
git push origin main
```
Nightly will skip Drive upload gracefully (script exits 0 if no files found).

## Follow-up PRs
- PR #2: Workflow stability (npm cache, git identity)
- PR #3: Budget meter enhancements
- PR #4: Cursor PLAN→ACT integration
- PR #5: NotebookLM briefs polish

## Checklist
- [x] Code follows existing style (JS with JSDoc)
- [x] Error messages are actionable
- [x] Retry logic with jitter implemented
- [x] Metadata logged to reports/
- [x] Morning brief updated
- [x] No secrets hardcoded
- [x] Graceful degradation (skip if no files)
- [x] Clear commit message
