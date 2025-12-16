# ✅ Import & Stub Fixes Complete

## Problems Fixed

### 1. Directory Imports Without index.ts ✅
**Problem:** Imports like `@/lib/auth` and `@/lib/extractors` pointed to directories without `index.ts` files.

**Solution:** Added auto-barrel functionality that:
- Detects when an import resolves to a directory
- Automatically creates `index.ts` barrel files
- Exports all `.ts`/`.tsx` files in the directory

**Files Modified:**
- ✅ `agent-runner/lib/nightFactory/invariants/importHealer.ts` - Added `ensureBarrelFile()` function
- ✅ `scripts/auto-barrel.ts` - Created standalone script for post-coder barrel generation

### 2. Stub Generator Overwriting Files ✅
**Problem:** Stub generator replaced entire files, causing existing exports to disappear.

**Solution:** Made stub generator **additive**:
- Reads existing file content
- Parses existing exports using TypeScript AST
- Only adds missing exports (union operation)
- Never overwrites existing exports

**Files Modified:**
- ✅ `agent-runner/lib/nightFactory/invariants/libNoJsx.ts` - Made `buildLibStubWithExports` additive
- ✅ `agent-runner/lib/nightFactory/invariants/importHealer.ts` - Passes existing content to stub generator

### 3. Supabase Client Implementations ✅
**Problem:** Inconsistent Supabase exports (`createClient`, `supabaseClient`, `createBrowserClient`).

**Solution:** Created canonical Supabase SSR implementations matching official patterns.

**Files Created:**
- ✅ `templates/fortress/supabase-client.ts` - Browser client (canonical SSR pattern)
- ✅ `templates/fortress/supabase-server.ts` - Server client (canonical SSR pattern)
- ✅ `templates/fortress/auth-session.ts` - Session helper
- ✅ `templates/fortress/ai-extractor.ts` - AI extractor stub

**Files Updated:**
- ✅ `agent-runner/lib/nightFactory/invariants/goldenContracts.ts` - Added Supabase contracts

### 4. Missing Exports ✅
**Problem:** `getUserSession` and `extractWithAI` were missing.

**Solution:** Created golden templates with these exports.

## Implementation Details

### Auto-Barrel Functionality

**Location:** `agent-runner/lib/nightFactory/invariants/importHealer.ts`

**Function:**
```typescript
private async ensureBarrelFile(dirPath: string): Promise<string | null> {
  // Checks if directory has index.ts
  // If not, creates one with exports for all .ts/.tsx files
  // Returns path to index.ts or null
}
```

**Integration:** Called automatically when `resolveLocalModule` returns a directory path.

### Additive Stub Generator

**Location:** `agent-runner/lib/nightFactory/invariants/libNoJsx.ts`

**Changes:**
- `buildLibStubWithExports` now accepts `existingContent` parameter
- Parses existing exports using TypeScript AST
- Only adds missing exports
- Preserves all existing exports

**Before:**
```typescript
const stub = buildLibStubWithExports(rel, needed);
await atomicWriteFile(targetAbs, stub); // Overwrites entire file
```

**After:**
```typescript
const stub = buildLibStubWithExports(rel, needed, targetRaw); // Passes existing content
await atomicWriteFile(targetAbs, stub); // Adds to existing file
```

### Supabase Implementations

**Browser Client** (`templates/fortress/supabase-client.ts`):
- Uses `@supabase/ssr` `createBrowserClient`
- Exports: `createClient()`, `createBrowserClient()`, `supabaseClient`

**Server Client** (`templates/fortress/supabase-server.ts`):
- Uses `@supabase/ssr` `createServerClient`
- Proper cookie handling with `getAll()`/`setAll()`
- Exports: `createClient()`, `createServerComponentClient()`

## Files Created/Modified

### New Files
1. ✅ `templates/fortress/supabase-client.ts`
2. ✅ `templates/fortress/supabase-server.ts`
3. ✅ `templates/fortress/auth-session.ts`
4. ✅ `templates/fortress/ai-extractor.ts`
5. ✅ `scripts/auto-barrel.ts`

### Modified Files
1. ✅ `agent-runner/lib/nightFactory/invariants/libNoJsx.ts` - Additive stub generation
2. ✅ `agent-runner/lib/nightFactory/invariants/importHealer.ts` - Auto-barrel + additive stubs
3. ✅ `agent-runner/lib/nightFactory/invariants/goldenContracts.ts` - Added Supabase contracts

## Expected Results

- ✅ No more "Cannot read directory" errors
- ✅ Auto-created `index.ts` files for directory imports
- ✅ Existing exports preserved when adding stubs
- ✅ Consistent Supabase client implementations
- ✅ All required exports available (`getUserSession`, `extractWithAI`, etc.)

## Status

✅ **ALL FIXES COMPLETE** - Import graph should now resolve correctly with:
- Auto-barrel files for directories
- Additive stub generation
- Canonical Supabase implementations
- All required exports available
