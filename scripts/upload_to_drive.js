import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

const SA_JSON = process.env.GDRIVE_SA_JSON;
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;
if (!SA_JSON || !FOLDER_ID) throw new Error("Missing GDRIVE_SA_JSON or GDRIVE_FOLDER_ID");

const creds = JSON.parse(SA_JSON);
const jwt = new google.auth.JWT(
  creds.client_email,
  null,
  creds.private_key,
  ["https://www.googleapis.com/auth/drive.file"]
);
const drive = google.drive({ version: "v3", auth: jwt });

async function findFileInFolder(name) {
  const q = [`'${FOLDER_ID}' in parents`, `name='${name.replace(/'/g, "\\'")}'`, "trashed=false"].join(" and ");
  const res = await drive.files.list({ q, fields: "files(id,name)" });
  return res.data.files?.[0] || null;
}

async function upsertFile(localPath, remoteName) {
  const body = await fs.readFile(localPath, "utf8");
  const existing = await findFileInFolder(remoteName);
  if (existing) {
    await drive.files.update({ fileId: existing.id, media: { mimeType: "text/plain", body } });
    console.log(`🔁 Updated: ${remoteName}`);
  } else {
    await drive.files.create({
      requestBody: { name: remoteName, parents: [FOLDER_ID] },
      media: { mimeType: "text/plain", body },
      fields: "id"
    });
    console.log(`⬆️  Uploaded: ${remoteName}`);
  }
}

(async () => {
  const dir = "podcast/export";
  let files = [];
  try { files = await fs.readdir(dir); } catch {}
  const txts = files.filter(f => f.endsWith(".txt")).sort();
  if (txts.length === 0) { console.log("No TXT in podcast/export, skipping."); return; }
  for (const f of txts) await upsertFile(path.join(dir, f), f);
  console.log(`✅ Drive sync complete: ${txts.length} file(s)`);
})().catch(e => { console.error(e); process.exit(1); });
