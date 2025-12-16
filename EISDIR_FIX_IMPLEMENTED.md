# ✅ EISDIR Fix Implemented

## Problem

**Error:** `EISDIR: illegal operation on a directory, read`

**Root Cause:**
- Stub generator creates `src/lib/extractors.ts` (flat file)
- Planner generates `src/lib/extractors/index.ts` (directory structure)
- When code tries to import `@/lib/extractors`, it resolves to the directory
- File system tries to read directory as file → EISDIR error

---

## ✅ Fixes Implemented

### 1. Updated `preScaffoldImports()` Function
**File:** `agent-runner/multi-pass-generator.ts`

**Changes:**
- Added `plan` parameter to check if plan expects index.ts structure
- Checks plan files for `src/lib/extractors/index.ts` vs `src/lib/extractors.ts`
- Creates correct stub based on plan structure
- Prevents creating flat file when plan expects directory/index.ts

**Key Logic:**
```typescript
const indexPath = `${basePath}/index.ts`;
const directPath = `${basePath}.ts`;

if (plan?.files) {
  const hasIndexFile = plan.files.some(f => f.path === indexPath);
  const hasDirectFile = plan.files.some(f => f.path === directPath);
  
  if (hasIndexFile) {
    targetPath = indexPath;  // Use directory/index.ts
  } else if (hasDirectFile) {
    targetPath = directPath; // Use flat file
  }
}
```

### 2. Updated `createStubFiles()` Function
**File:** `agent-runner/pipeline-runner.ts`

**Changes:**
- Added EISDIR error detection and prevention
- Checks if parent directory exists as a FILE before creating directory/index.ts
- Skips stub creation if conflict detected
- Better error handling with specific EISDIR messages

**Key Logic:**
```typescript
// Check if parent directory path exists as a FILE (not directory)
if (fs.existsSync(parentDirPath) && fs.statSync(parentDirPath).isFile()) {
  // Parent path is a file, but we're trying to create a directory/index.ts
  console.warn(`⚠️ Skipping stub (parent path exists as file)`);
  continue;
}

// EISDIR error handling
catch (error: any) {
  if (error.code === 'EISDIR') {
    console.warn(`⚠️ Skipping stub (path is a directory)`);
  }
}
```

### 3. Updated Planner Prompt
**File:** `lib/nightFactory/structurePlanner.ts`

**Changes:**
- Added rule #7: Prefer flat files over directory/index.ts structures
- Explicitly tells AI to use `src/lib/extractors.ts` NOT `src/lib/extractors/index.ts`
- Prevents planner from generating directory structures

**New Rule:**
```
7. FILE STRUCTURE: Use FLAT FILES, NOT directory/index.ts structures.
   - ✅ CORRECT: src/lib/extractors.ts
   - ❌ WRONG: src/lib/extractors/index.ts
   - This prevents EISDIR errors and simplifies imports.
```

### 4. Updated `generateWithValidation()` Signature
**File:** `agent-runner/multi-pass-generator.ts`

**Changes:**
- Added optional `plan` parameter
- Passes plan to `preScaffoldImports()` for index.ts detection

**Updated Call Site:**
```typescript
const result = await generateWithValidation(
  pipeline.id,
  'coder',
  fullPrompt,
  targetFile,
  repoPath,
  10, // maxAttempts
  fileStructurePlan // plan parameter
);
```

---

## 🎯 How It Works Now

### Scenario 1: Plan Has Flat File
- **Plan:** `src/lib/extractors.ts`
- **Import:** `@/lib/extractors`
- **Stub Created:** `src/lib/extractors.ts` ✅
- **Result:** No conflict

### Scenario 2: Plan Has Index File
- **Plan:** `src/lib/extractors/index.ts`
- **Import:** `@/lib/extractors`
- **Stub Created:** `src/lib/extractors/index.ts` ✅
- **Result:** No conflict

### Scenario 3: Conflict Detection
- **Existing:** `src/lib/extractors.ts` (file)
- **Plan:** `src/lib/extractors/index.ts`
- **Action:** Skip stub creation, log warning
- **Result:** Actual file generation handles it correctly

---

## 📊 Expected Results

### Before Fix
- ❌ EISDIR error when stub conflicts with plan
- ❌ Pipeline crashes on file system operations
- ❌ Inconsistent file structures

### After Fix
- ✅ Stub generator checks plan before creating files
- ✅ EISDIR errors prevented with conflict detection
- ✅ Planner prefers flat files (simpler structure)
- ✅ Graceful handling of conflicts

---

## 🧪 Testing

To verify the fix works:

1. **Create a pipeline** with imports like `@/lib/extractors`
2. **Check stub generation logs** - should show correct file paths
3. **Verify no EISDIR errors** in pipeline output
4. **Check file structure** - should match plan exactly

---

## 📝 Files Modified

1. `agent-runner/multi-pass-generator.ts`
   - Updated `preScaffoldImports()` signature and logic
   - Added plan parameter to `generateWithValidation()`

2. `agent-runner/pipeline-runner.ts`
   - Updated `createStubFiles()` with EISDIR prevention
   - Updated `generateWithValidation()` call to pass plan

3. `lib/nightFactory/structurePlanner.ts`
   - Added rule #7: Prefer flat files over directory/index.ts

---

## ✅ Status

**All fixes implemented!** The stub generator now:
- ✅ Checks plan before creating stubs
- ✅ Handles index.ts vs flat file conflicts
- ✅ Prevents EISDIR errors
- ✅ Planner prefers flat files

**Expected Result:** No more EISDIR errors in pipeline runs! 🎉
