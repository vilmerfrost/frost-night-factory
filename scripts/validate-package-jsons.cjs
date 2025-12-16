const fs = require("fs");
const path = require("path");

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walk(p);
    } else if (entry.isFile() && entry.name === "package.json") {
      yield p;
    }
  }
}

let ok = true;
for (const p of walk(process.cwd())) {
  try {
    let s = fs.readFileSync(p, "utf8");
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1); // strip BOM
    JSON.parse(s);
  } catch (e) {
    ok = false;
    console.error(`❌ Invalid JSON: ${p}\n   ${e.message}\n`);
  }
}

if (!ok) process.exit(1);
console.log("✅ All package.json files are valid JSON");
