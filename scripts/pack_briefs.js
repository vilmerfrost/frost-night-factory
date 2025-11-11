import fs from "fs/promises";
import path from "path";

const src = "podcast/briefs";
const outDir = "podcast/export";
await fs.mkdir(outDir, { recursive: true });

const files = (await fs.readdir(src)).filter(f=>f.endsWith(".md")).sort();
let combined = "";

for (const f of files){
  const md = await fs.readFile(path.join(src,f),"utf8");
  const txtName = f.replace(/\.md$/,".txt");
  await fs.writeFile(path.join(outDir, txtName), md, "utf8");
  combined += `\n\n===== ${f} =====\n\n${md}\n`;
}

await fs.writeFile(path.join(outDir,"briefs_all.txt"), combined.trim(), "utf8");
console.log(`Exported ${files.length} briefs → podcast/export/*.txt (+ briefs_all.txt)`);
