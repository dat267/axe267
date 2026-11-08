import { after, before, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-axe",
    firestore: {
      rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8"),
    },
  });
});
beforeEach(async () => environment.clearFirestore());
after(async () => environment?.cleanup());

test("users cannot create API keys addressed to another user's email", async () => {
  const database = environment
    .authenticatedContext("alice", { email: "alice@example.com", email_verified: true })
    .firestore();
  await assertFails(
    setDoc(doc(database, "api_keys", "spoofed"), {
      userId: "alice",
      userEmail: "bob@example.com",
      keyHash: "a".repeat(64),
      name: "spoofed",
    }),
  );
});

test("users cannot take ownership of another user's reading progress", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "user_progress", "bob_book"), { uid: "bob", cfi: "original" });
  });
  const database = environment.authenticatedContext("alice").firestore();
  await assertFails(setDoc(doc(database, "user_progress", "bob_book"), { uid: "alice", cfi: "stolen" }));
});

test("users can create API keys for their own verified email", async () => {
  const database = environment
    .authenticatedContext("alice", { email: "alice@example.com", email_verified: true })
    .firestore();
  await assertSucceeds(
    setDoc(doc(database, "api_keys", "own"), {
      userId: "alice",
      userEmail: "alice@example.com",
      keyHash: "a".repeat(64),
      name: "own",
    }),
  );
});

test("unverified users cannot read notifications addressed to their email", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "notifications", "n1"), {
      userEmail: "victim@example.com",
      title: "secret",
    });
  });
  const database = environment
    .authenticatedContext("attacker", { email: "victim@example.com", email_verified: false })
    .firestore();
  await assertFails(getDoc(doc(database, "notifications", "n1")));
});

test("unverified users cannot create API keys for their email", async () => {
  const database = environment
    .authenticatedContext("attacker", { email: "victim@example.com", email_verified: false })
    .firestore();
  await assertFails(
    setDoc(doc(database, "api_keys", "unverified"), {
      userId: "attacker",
      userEmail: "victim@example.com",
      keyHash: "a".repeat(64),
      name: "unverified",
    }),
  );
});

test("owners can update an API key email to their verified token email", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "api_keys", "owned"), {
      userId: "alice",
      userEmail: "old@example.com",
      keyHash: "a".repeat(64),
      name: "owned",
    });
  });
  const database = environment
    .authenticatedContext("alice", { email: "new@example.com", email_verified: true })
    .firestore();
  await assertSucceeds(updateDoc(doc(database, "api_keys", "owned"), { userEmail: "new@example.com" }));
});

test("owners cannot change other API key fields", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "api_keys", "owned"), {
      userId: "alice",
      userEmail: "alice@example.com",
      keyHash: "a".repeat(64),
      name: "owned",
    });
  });
  const database = environment
    .authenticatedContext("alice", { email: "alice@example.com", email_verified: true })
    .firestore();
  await assertFails(updateDoc(doc(database, "api_keys", "owned"), { keyHash: "b".repeat(64) }));
});

test("users can check for reading progress before their first save", async () => {
  const database = environment.authenticatedContext("alice").firestore();
  const snapshot = await assertSucceeds(getDoc(doc(database, "user_progress", "alice_new_book")));
  if (snapshot.exists()) throw new Error("Expected no saved progress");
});

test("a matching document prefix does not grant access to another owner's progress", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "user_progress", "alice_book"), { uid: "bob", cfi: "private" });
  });
  const database = environment.authenticatedContext("alice").firestore();
  await assertFails(getDoc(doc(database, "user_progress", "alice_book")));
});

test("users can update their own reading progress", async () => {
  const database = environment.authenticatedContext("alice").firestore();
  const progress = doc(database, "user_progress", "alice_book");
  await assertSucceeds(setDoc(progress, { uid: "alice", cfi: "start" }));
  await assertSucceeds(setDoc(progress, { uid: "alice", cfi: "next" }));
});

test("owners can migrate legacy reading progress without a uid", async () => {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "user_progress", "alice_book"), { cfi: "legacy" });
  });
  const database = environment.authenticatedContext("alice").firestore();
  await assertSucceeds(setDoc(doc(database, "user_progress", "alice_book"), { uid: "alice", cfi: "next" }));
});
