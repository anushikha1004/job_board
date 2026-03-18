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
    "Missing dependency: firebase-admin. Run `npm i -D firebase-admin` or `npx -y -p firebase-admin node scripts/backfill-legacy-fields.mjs`."
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
const deleteField = firestoreMod.FieldValue.delete();
const collections = ["jobs", "company_profiles", "user_profiles"];

const legacyToCanonical = [
  ["createdAt", "created_at"],
  ["updatedAt", "updated_at"],
  ["salaryRange", "salary_range"],
  ["companyName", "company_name"],
];

let docsScanned = 0;
let docsUpdated = 0;

for (const collectionName of collections) {
  const snapshot = await db.collection(collectionName).get();
  let batch = db.batch();
  let batchOps = 0;

  for (const docSnap of snapshot.docs) {
    docsScanned += 1;
    const data = docSnap.data();
    const updates = {};

    for (const [legacyKey, canonicalKey] of legacyToCanonical) {
      if (legacyKey in data && !(canonicalKey in data)) {
        updates[canonicalKey] = data[legacyKey];
      }
      if (legacyKey in data) {
        updates[legacyKey] = deleteField;
      }
    }

    if (Object.keys(updates).length === 0) continue;

    docsUpdated += 1;
    if (!dryRun) {
      batch.update(docSnap.ref, updates);
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
}

console.log(
  `[backfill] completed. scanned=${docsScanned}, updated=${docsUpdated}, dryRun=${dryRun}`
);
