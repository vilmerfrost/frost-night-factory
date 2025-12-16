# ✅ EISDIR Fix - ExportRegistry & ImportHealer

## Problem

The EISDIR error was occurring in a new location:
- `exportRegistry.ts:36` - trying to READ `src/lib/extractors` (a directory)
- `importHealer.ts:98` - healing imports that reference directories

**Error:** `EISDIR: illegal operation on a directory, read`

## Root Cause

When the import healer tries to register a file path that resolves to a directory (e.g., `src/lib/extractors`), the `registerFile` function attempts to read it as a file, causing EISDIR.

## Solution Implemented

### 1. Fixed `exportRegistry.ts` ✅

**File:** `agent-runner/lib/nightFactory/invariants/exportRegistry.ts`

**Changes:**
- Added directory check in `registerFile` function before reading file
- If path is a directory, try to register `index.ts` instead
- Added proper error handling

**Code:**
```typescript
async registerFile(absFilePath: string): Promise<void> {
  if (!(await exists(absFilePath))) return;
  
  // Check if path is a directory (EISDIR prevention)
  try {
    const stat = await fs.stat(absFilePath);
    if (stat.isDirectory()) {
      console.warn(`⚠️ [ExportRegistry] Skipping directory: ${absFilePath}`);
      // Try to register index.ts if it exists
      const indexPath = path.join(absFilePath, "index.ts");
      if (await exists(indexPath)) {
        await this.registerFile(indexPath);
      }
      return;
    }
  } catch (error: any) {
    // Error handling...
  }
  
  const content = await fs.readFile(absFilePath, "utf8");
  // ... rest of function
}
```

### 2. Fixed `importHealer.ts` ✅

**File:** `agent-runner/lib/nightFactory/invariants/importHealer.ts`

**Changes:**
- Added directory check in `safeRegisterAndGet` function
- If path is a directory, try `index.ts` or `index.tsx` instead
- Return null if no index file found

**Code:**
```typescript
private async safeRegisterAndGet(targetAbs: string) {
  // Check if it's a directory first (EISDIR prevention)
  try {
    const stat = await fs.stat(targetAbs);
    if (stat.isDirectory()) {
      // Try index.ts instead
      const indexPath = path.join(targetAbs, "index.ts");
      if (await exists(indexPath)) {
        await this.registry.registerFile(indexPath);
        return this.registry.get(indexPath);
      }
      // Try index.tsx
      const indexTsxPath = path.join(targetAbs, "index.tsx");
      if (await exists(indexTsxPath)) {
        await this.registry.registerFile(indexTsxPath);
        return this.registry.get(indexTsxPath);
      }
      // No index file found, return empty exports
      return null;
    }
  } catch (error: any) {
    // Error handling...
  }
  
  await this.registry.registerFile(targetAbs);
  return this.registry.get(targetAbs);
}
```

### 3. Enhanced `resolveLocalModule` ✅

**File:** `agent-runner/lib/nightFactory/invariants/exportRegistry.ts`

**Changes:**
- Added directory check when resolving module paths
- If candidate is a directory, try index files automatically
- Prevents returning directory paths that would cause EISDIR later

## Files Modified

1. ✅ `agent-runner/lib/nightFactory/invariants/exportRegistry.ts`
   - Added directory check in `registerFile`
   - Enhanced `resolveLocalModule` to handle directories

2. ✅ `agent-runner/lib/nightFactory/invariants/importHealer.ts`
   - Added directory check in `safeRegisterAndGet`
   - Handles index.ts/index.tsx fallback

## Expected Results

- ✅ No more EISDIR errors when reading directories
- ✅ Automatic fallback to `index.ts`/`index.tsx` when path is a directory
- ✅ Proper error handling and warnings
- ✅ Import healing works correctly with both flat files and directory structures

## Testing

The fixes handle these scenarios:
1. **Directory with index.ts** → Registers index.ts automatically
2. **Directory with index.tsx** → Registers index.tsx automatically
3. **Directory without index** → Returns null/empty exports (no crash)
4. **Flat file** → Works as before

## Status

✅ **FIXED** - EISDIR errors prevented in ExportRegistry and ImportHealer.
