import fs from "node:fs";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { Timestamp, doc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "techhire-rules-test";
const RULES_PATH = new URL("../firestore.rules", import.meta.url);

let testEnv;

function nowTs() {
  return Timestamp.fromDate(new Date("2026-01-01T00:00:00.000Z"));
}

function userDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

test("user can create own candidate profile", async () => {
  const db = userDb("candidate_1");
  await assertSucceeds(
    setDoc(doc(db, "user_profiles", "candidate_1"), {
      email: "candidate@test.com",
      role: "candidate",
      company_name: null,
      created_at: nowTs(),
    })
  );
});

test("user cannot create someone else's profile", async () => {
  const db = userDb("candidate_1");
  await assertFails(
    setDoc(doc(db, "user_profiles", "candidate_2"), {
      email: "candidate@test.com",
      role: "candidate",
      company_name: null,
      created_at: nowTs(),
    })
  );
});

test("company can create own job", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "user_profiles", "company_1"), {
      email: "company@test.com",
      role: "company",
      company_name: "TechHire Inc",
      created_at: nowTs(),
    });
  });

  const db = userDb("company_1");
  await assertSucceeds(
    setDoc(doc(db, "jobs", "job_1"), {
      title: "Backend Engineer",
      company_name: "TechHire Inc",
      description: "Build backend services",
      tags: ["Node.js", "PostgreSQL"],
      location: "Remote",
      type: "Full-time",
      apply_url: "https://example.com/apply",
      salary_range: { min: 100000, max: 150000, currency: "USD" },
      postedBy: "company_1",
      created_at: nowTs(),
      updated_at: nowTs(),
    })
  );
});

test("candidate cannot create job", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "user_profiles", "candidate_1"), {
      email: "candidate@test.com",
      role: "candidate",
      company_name: null,
      created_at: nowTs(),
    });
  });

  const db = userDb("candidate_1");
  await assertFails(
    setDoc(doc(db, "jobs", "job_2"), {
      title: "Frontend Engineer",
      company_name: "TechHire Inc",
      description: "Build frontend UI",
      tags: ["React", "TypeScript"],
      location: "Hybrid",
      type: "Full-time",
      apply_url: "https://example.com/apply",
      salary_range: { min: 90000, max: 130000, currency: "USD" },
      postedBy: "candidate_1",
      created_at: nowTs(),
      updated_at: nowTs(),
    })
  );
});

test("company cannot mutate immutable job fields (created_at)", async () => {
  const createdAt = nowTs();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "user_profiles", "company_1"), {
      email: "company@test.com",
      role: "company",
      company_name: "TechHire Inc",
      created_at: createdAt,
    });
    await setDoc(doc(adminDb, "jobs", "job_immutable"), {
      title: "Platform Engineer",
      company_name: "TechHire Inc",
      description: "Platform work",
      tags: ["Go", "Kubernetes"],
      location: "Remote",
      type: "Full-time",
      apply_url: "https://example.com/apply",
      salary_range: { min: 120000, max: 170000, currency: "USD" },
      postedBy: "company_1",
      created_at: createdAt,
      updated_at: createdAt,
    });
  });

  const db = userDb("company_1");
  await assertFails(
    updateDoc(doc(db, "jobs", "job_immutable"), {
      created_at: Timestamp.fromDate(new Date("2026-02-01T00:00:00.000Z")),
      updated_at: Timestamp.fromDate(new Date("2026-02-01T00:00:00.000Z")),
    })
  );
});

test("company profile update must preserve created_at", async () => {
  const createdAt = nowTs();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "user_profiles", "company_2"), {
      email: "company2@test.com",
      role: "company",
      company_name: "TechHire Labs",
      created_at: createdAt,
    });
    await setDoc(doc(adminDb, "company_profiles", "company_2"), {
      userId: "company_2",
      company_name: "TechHire Labs",
      website: "",
      about: "",
      size: "",
      location: "",
      created_at: createdAt,
      updated_at: createdAt,
    });
  });

  const db = userDb("company_2");
  await assertSucceeds(
    setDoc(doc(db, "company_profiles", "company_2"), {
      userId: "company_2",
      company_name: "TechHire Labs",
      website: "https://techhire.com",
      about: "Updated about",
      size: "51-200",
      location: "Remote",
      created_at: createdAt,
      updated_at: Timestamp.fromDate(new Date("2026-03-01T00:00:00.000Z")),
    })
  );

  await assertFails(
    setDoc(doc(db, "company_profiles", "company_2"), {
      userId: "company_2",
      company_name: "TechHire Labs",
      website: "https://techhire.com",
      about: "Updated about",
      size: "51-200",
      location: "Remote",
      created_at: Timestamp.fromDate(new Date("2026-04-01T00:00:00.000Z")),
      updated_at: Timestamp.fromDate(new Date("2026-04-01T00:00:00.000Z")),
    })
  );
});

test("favorites can only be created by owner", async () => {
  const ownDb = userDb("candidate_1");
  await assertSucceeds(
    setDoc(doc(ownDb, "favorites", "candidate_1_job_1"), {
      userId: "candidate_1",
      jobId: "job_1",
      savedAt: nowTs(),
    })
  );

  const otherDb = userDb("candidate_2");
  await assertFails(
    setDoc(doc(otherDb, "favorites", "candidate_1_job_2"), {
      userId: "candidate_1",
      jobId: "job_2",
      savedAt: nowTs(),
    })
  );
});

test("candidate can create own application", async () => {
  const db = userDb("candidate_1");
  await assertSucceeds(
    setDoc(doc(db, "applications", "candidate_1_job_1"), {
      candidate_id: "candidate_1",
      candidate_name: "Candidate One",
      candidate_email: "candidate@test.com",
      company_id: "company_1",
      job_id: "job_1",
      job_title: "Backend Engineer",
      company_name: "TechHire Inc",
      apply_url: "https://example.com/apply",
      location: "Remote",
      type: "Full-time",
      status: "submitted",
      candidate_email_opt_in: true,
      company_email_opt_in: true,
      recruiter_notes: "",
      interview_at: null,
      withdrawn_by_candidate: false,
      created_at: nowTs(),
      updated_at: nowTs(),
    })
  );
});

test("candidate can withdraw own application but cannot edit recruiter fields", async () => {
  const createdAt = nowTs();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "applications", "candidate_1_job_2"), {
      candidate_id: "candidate_1",
      candidate_name: "Candidate One",
      candidate_email: "candidate@test.com",
      company_id: "company_1",
      job_id: "job_2",
      job_title: "Platform Engineer",
      company_name: "TechHire Inc",
      apply_url: "https://example.com/apply",
      location: "Remote",
      type: "Full-time",
      status: "submitted",
      candidate_email_opt_in: true,
      company_email_opt_in: true,
      recruiter_notes: "internal",
      interview_at: null,
      withdrawn_by_candidate: false,
      created_at: createdAt,
      updated_at: createdAt,
    });
  });

  const candidateDb = userDb("candidate_1");
  await assertSucceeds(
    updateDoc(doc(candidateDb, "applications", "candidate_1_job_2"), {
      status: "withdrawn",
      withdrawn_by_candidate: true,
      updated_at: Timestamp.fromDate(new Date("2026-02-01T00:00:00.000Z")),
    })
  );

  await assertFails(
    updateDoc(doc(candidateDb, "applications", "candidate_1_job_2"), {
      recruiter_notes: "tamper",
      updated_at: Timestamp.fromDate(new Date("2026-02-01T01:00:00.000Z")),
    })
  );
});

test("company can update status and recruiter fields on owned application", async () => {
  const createdAt = nowTs();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "applications", "candidate_2_job_1"), {
      candidate_id: "candidate_2",
      candidate_name: "Candidate Two",
      candidate_email: "candidate2@test.com",
      company_id: "company_1",
      job_id: "job_1",
      job_title: "Backend Engineer",
      company_name: "TechHire Inc",
      apply_url: "https://example.com/apply",
      location: "London",
      type: "Hybrid",
      status: "reviewed",
      candidate_email_opt_in: true,
      company_email_opt_in: true,
      recruiter_notes: "",
      interview_at: null,
      withdrawn_by_candidate: false,
      created_at: createdAt,
      updated_at: createdAt,
    });
  });

  const companyDb = userDb("company_1");
  await assertSucceeds(
    updateDoc(doc(companyDb, "applications", "candidate_2_job_1"), {
      status: "interviewing",
      recruiter_notes: "Strong profile",
      interview_at: Timestamp.fromDate(new Date("2026-03-02T10:00:00.000Z")),
      updated_at: Timestamp.fromDate(new Date("2026-03-01T00:00:00.000Z")),
    })
  );
});

test("notification reads can only be managed by owner", async () => {
  const ownDb = userDb("candidate_1");
  await assertSucceeds(
    setDoc(doc(ownDb, "notification_reads", "candidate_1_app_1"), {
      user_id: "candidate_1",
      notification_id: "app_1",
      created_at: nowTs(),
      read_at: nowTs(),
    })
  );

  const otherDb = userDb("candidate_2");
  await assertFails(
    setDoc(doc(otherDb, "notification_reads", "candidate_1_app_2"), {
      user_id: "candidate_1",
      notification_id: "app_2",
      created_at: nowTs(),
      read_at: nowTs(),
    })
  );
});

test("sanity: test environment initialized", async () => {
  assert.ok(testEnv);
});
