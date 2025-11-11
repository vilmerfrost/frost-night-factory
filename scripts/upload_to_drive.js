/**
 * Google Drive Upload Script (Night Factory v2.1)
 * Uploads podcast briefs to Google Drive with robust error handling
 * Requires: GDRIVE_SA_JSON, GDRIVE_FOLDER_ID env vars
 */
import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

const SA_JSON = process.env.GDRIVE_SA_JSON;
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

if (!SA_JSON || !FOLDER_ID) {
  throw new Error("Missing GDRIVE_SA_JSON or GDRIVE_FOLDER_ID env vars");
}

let creds;
try {
  creds = JSON.parse(SA_JSON);
} catch (err) {
  throw new Error(`Invalid GDRIVE_SA_JSON format: ${err.message}`);
}

// Use GoogleAuth for proper scope handling
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive"
  ],
});

const drive = google.drive({ version: "v3", auth });

/**
 * Sleep with jitter for exponential backoff
 */
function sleep(ms) {
  const jitter = Math.random() * 0.3 * ms; // 30% jitter
  return new Promise(resolve => setTimeout(resolve, ms + jitter));
}

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff(fn, context = "operation") {
  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err?.response?.status || err?.code;
      const reason = err?.response?.data?.error?.errors?.[0]?.reason;
      const message = err?.response?.data?.error?.message || err?.message;

      // Special handling for 403 accessNotConfigured
      if (status === 403 && (reason === "accessNotConfigured" || message?.includes("has not been used"))) {
        throw new Error(
          `❌ Google Drive API not enabled or not propagated yet.\n` +
          `   Action required:\n` +
          `   1. Enable Google Drive API in Google Cloud Console for project: ${creds.project_id || 'your-project'}\n` +
          `   2. Share folder ${FOLDER_ID} with service account: ${creds.client_email}\n` +
          `   3. Wait ~5 minutes for propagation, then retry.\n` +
          `   Original error: ${message}`
        );
      }

      // Retry on 429 (rate limit) or 5xx (server error)
      if (status === 429 || (status >= 500 && status < 600)) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`⚠️  ${context} failed (attempt ${attempt}/${MAX_RETRIES}): ${status} ${reason || message}`);
        if (attempt < MAX_RETRIES) {
          console.log(`   Retrying in ${Math.round(delay)}ms...`);
          await sleep(delay);
          continue;
        }
      }

      // Don't retry other errors
      throw err;
    }
  }
  throw lastError;
}

/**
 * Find file by name in the target folder
 */
async function findFileInFolder(name) {
  return retryWithBackoff(async () => {
    const q = [`'${FOLDER_ID}' in parents`, `name='${name.replace(/'/g, "\\'")}'`, "trashed=false"].join(" and ");
    const res = await drive.files.list({ q, fields: "files(id,name,webViewLink,size)" });
    return res.data.files?.[0] || null;
  }, `Find file ${name}`);
}

/**
 * Upsert file to Drive (create or update)
 */
async function upsertFile(localPath, remoteName) {
  const body = await fs.readFile(localPath, "utf8");
  const stats = await fs.stat(localPath);
  const existing = await findFileInFolder(remoteName);

  let result;
  if (existing) {
    result = await retryWithBackoff(async () => {
      const res = await drive.files.update({
        fileId: existing.id,
        media: { mimeType: "text/plain", body },
        fields: "id,name,webViewLink,size"
      });
      return res.data;
    }, `Update ${remoteName}`);
    console.log(`🔁 Updated: ${remoteName} (${stats.size} bytes)`);
  } else {
    result = await retryWithBackoff(async () => {
      const res = await drive.files.create({
        requestBody: { name: remoteName, parents: [FOLDER_ID] },
        media: { mimeType: "text/plain", body },
        fields: "id,name,webViewLink,size"
      });
      return res.data;
    }, `Create ${remoteName}`);
    console.log(`⬆️  Uploaded: ${remoteName} (${stats.size} bytes)`);
  }

  return {
    name: remoteName,
    id: result.id,
    size: stats.size,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    action: existing ? "updated" : "created",
    timestamp: new Date().toISOString()
  };
}

/**
 * Main execution
 */
(async () => {
  console.log("🚀 Starting Google Drive upload...");
  console.log(`   Service Account: ${creds.client_email}`);
  console.log(`   Target Folder ID: ${FOLDER_ID}`);

  const dir = "podcast/export";
  let files = [];
  try {
    files = await fs.readdir(dir);
  } catch (err) {
    console.log(`⚠️  Directory ${dir} not found, skipping upload.`);
    return;
  }

  const txts = files.filter(f => f.endsWith(".txt")).sort();
  if (txts.length === 0) {
    console.log(`ℹ️  No TXT files in ${dir}, skipping upload.`);
    return;
  }

  console.log(`📤 Uploading ${txts.length} file(s)...`);
  const uploadResults = [];

  for (const f of txts) {
    try {
      const result = await upsertFile(path.join(dir, f), f);
      uploadResults.push(result);
    } catch (err) {
      console.error(`❌ Failed to upload ${f}: ${err.message}`);
      throw err; // Fail fast on upload error
    }
  }

  // Write metadata to reports
  await fs.mkdir("reports", { recursive: true });
  await fs.writeFile(
    "reports/drive_uploads.json",
    JSON.stringify(uploadResults, null, 2)
  );

  console.log(`\n✅ Drive sync complete: ${txts.length} file(s) uploaded`);
  console.log(`   Metadata saved to: reports/drive_uploads.json`);

  // Summary
  const totalSize = uploadResults.reduce((sum, r) => sum + r.size, 0);
  const created = uploadResults.filter(r => r.action === "created").length;
  const updated = uploadResults.filter(r => r.action === "updated").length;
  console.log(`   📊 Summary: ${created} created, ${updated} updated, ${totalSize} bytes total`);
})().catch(e => {
  console.error(`\n❌ Drive upload failed:\n${e.message}`);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
