import assert from "node:assert/strict";
import path from "node:path";
import { getWorkspaceRoot, assertInsideWorkspace } from "./lib/workspace/config";

async function run() {
  const root = getWorkspaceRoot();
  console.log(`Workspace root: ${root}`);
  
  // Test 1: Valid path inside workspace
  assertInsideWorkspace(path.join(root, "pipeline-123"));
  console.log("✅ Valid path inside workspace passed");
  
  // Test 2: Path escaping workspace should throw
  try {
    assertInsideWorkspace("C:\\Windows\\System32");
    assert.fail("Should have thrown for path outside workspace");
  } catch (err: any) {
    assert.ok(err.message.includes("SECURITY"), "Error should mention SECURITY");
    assert.ok(err.message.includes("escapes workspace root"), "Error should mention escape");
    console.log("✅ Security check for escaping path passed");
  }
  
  // Test 3: Relative path going up should throw
  try {
    const upPath = path.join(root, "..", "..", "sensitive-file.txt");
    assertInsideWorkspace(upPath);
    assert.fail("Should have thrown for relative path going up");
  } catch (err: any) {
    assert.ok(err.message.includes("SECURITY"), "Error should mention SECURITY");
    console.log("✅ Security check for relative path going up passed");
  }
  
  console.log("✅ test-workspace-root-consistency passed");
}

run().catch((e) => {
  console.error("❌ test-workspace-root-consistency failed:", e);
  process.exit(1);
});

