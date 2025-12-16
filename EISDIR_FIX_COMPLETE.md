# ✅ EISDIR Fix Complete - ImportHealer Safe Read

## Problem

The EISDIR error was occurring at line 153 in `importHealer.ts` when trying to read a directory as a file:
```
Error: EISDIR: illegal operation on a directory, read
    at async ImportHealer.healFile (importHealer.ts:153:27)
```

## Root Cause

The `healFile` function had two places where it directly called `fs.readFile` without checking if the path was a directory:
1. Line 79: Reading the importer file
2. Line 153: Reading the target file (where error occurred)

## Solution Implemented

Created a **root-level fix** by adding a `safeReadFile` helper function that:
- ✅ Always checks if path is a directory before reading
- ✅ Automatically tries `index.ts` or `index.tsx` for directories
- ✅ Returns `null` if file cannot be read (with proper error handling)
- ✅ Replaces ALL `fs.readFile` calls in the class

## Changes Made

### 1. Added `safeReadFile` Helper Function ✅

**Location:** `agent-runner/lib/nightFactory/invariants/importHealer.ts`

**Function:**
```typescript
private async safeReadFile(filePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(filePath);
    
    // If it's a directory, try index.ts or index.tsx
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.ts");
      if (await exists(indexPath)) {
        return await fs.readFile(indexPath, "utf-8");
      }
      const indexTsxPath = path.join(filePath, "index.tsx");
      if (await exists(indexTsxPath)) {
        return await fs.readFile(indexTsxPath, "utf-8");
      }
      console.warn(`⚠️ [ImportHealer] Cannot read directory (no index file): ${filePath}`);
      return null;
    }
    
    // It's a file, read it
    return await fs.readFile(filePath, "utf-8");
  } catch (error: any) {
    // File doesn't exist or other error
    if (error.code === "ENOENT") {
      console.warn(`⚠️ [ImportHealer] File not found: ${filePath}`);
    } else {
      console.warn(`⚠️ [ImportHealer] Error reading file ${filePath}: ${error.message}`);
    }
    return null;
  }
}
```

### 2. Replaced Line 79 (Importer File Read) ✅

**Before:**
```typescript
const content = await fs.readFile(importerAbs, "utf8");
```

**After:**
```typescript
const content = await this.safeReadFile(importerAbs);
if (!content) {
  console.warn(`⚠️ [ImportHealer] Cannot read importer file: ${importerAbs}`);
  return { fixed: 0, notes };
}
```

### 3. Replaced Line 153 (Target File Read) ✅

**Before:**
```typescript
const targetRaw = await fs.readFile(targetAbs, "utf8");
```

**After:**
```typescript
const targetRaw = await this.safeReadFile(targetAbs);
if (!targetRaw) {
  notes.push(`Cannot read target file ${relPosix} (may be a directory without index)`);
  continue;
}
```

## Files Modified

1. ✅ `agent-runner/lib/nightFactory/invariants/importHealer.ts`
   - Added `safeReadFile` helper function
   - Replaced 2 `fs.readFile` calls with `safeReadFile`
   - Added null checks after safe reads

## Benefits

1. **Root-Level Fix** - All file reads are now safe
2. **Automatic Directory Handling** - Tries `index.ts`/`index.tsx` automatically
3. **Better Error Messages** - Clear warnings when files can't be read
4. **No More EISDIR Errors** - Directory checks prevent crashes
5. **Future-Proof** - Any new `fs.readFile` calls can use `safeReadFile`

## Expected Results

- ✅ No more EISDIR errors when reading directories
- ✅ Automatic fallback to `index.ts`/`index.tsx` for directories
- ✅ Graceful handling of missing files
- ✅ Clear warning messages for debugging

## Status

✅ **FIXED** - All file read operations in ImportHealer are now safe and handle directories correctly.
