import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const dryRun = process.argv.includes("--dry-run");
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(rootDir, "serviceAccountKey.json");

try {
  await import("firebase-admin");
} catch {
  console.error(
    "Missing dependency: firebase-admin. Run via `npx -y -p firebase-admin node scripts/backfill-job-workflow.mjs`."
  );
  process.exit(1);
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Service account file not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
const appMod = await import("firebase-admin/app");
const firestoreMod = await import("firebase-admin/firestore");

if (!appMod.getApps().length) {
  appMod.initializeApp({
    credential: appMod.cert(serviceAccount),
  });
}

const db = firestoreMod.getFirestore();

const validStatuses = new Set(["open", "archived"]);
const validPipeline = new Set(["new", "reviewed", "shortlisted", "interviewing", "offer", "hired", "rejected"]);

let docsScanned = 0;
let docsUpdated = 0;

const snapshot = await db.collection("jobs").get();
let batch = db.batch();
let batchOps = 0;

for (const docSnap of snapshot.docs) {
  docsScanned += 1;
  const data = docSnap.data() || {};
  const nextStatus = validStatuses.has(data.status) ? data.status : "open";
  const nextPipeline = validPipeline.has(data.pipeline_state) ? data.pipeline_state : "new";

  const shouldUpdate = data.status !== nextStatus || data.pipeline_state !== nextPipeline;
  if (!shouldUpdate) continue;

  docsUpdated += 1;
  if (!dryRun) {
    batch.update(docSnap.ref, {
      status: nextStatus,
      pipeline_state: nextPipeline,
      updated_at: firestoreMod.FieldValue.serverTimestamp(),
    });
    batchOps += 1;
    if (batchOps === 450) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  }
}

if (!dryRun && batchOps > 0) {
  await batch.commit();
}

console.log(
  `[backfill:job_workflow] completed. scanned=${docsScanned}, updated=${docsUpdated}, dryRun=${dryRun}`
);

