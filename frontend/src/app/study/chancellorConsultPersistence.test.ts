import assert from "node:assert/strict";
import test from "node:test";

import {
  chancellorConsultStorageKey,
  loadChancellorConsultMessages,
  saveChancellorConsultMessages,
} from "./chancellorConsultPersistence.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    value(key: string) {
      return values.get(key);
    },
  };
}

test("consult storage keys isolate authenticated accounts", () => {
  assert.equal(chancellorConsultStorageKey("user/a"), "chaotang:consult:v1:user%2Fa");
  assert.notEqual(chancellorConsultStorageKey("user/a"), chancellorConsultStorageKey("user/b"));
});

test("consult storage restores only complete strict message pairs", () => {
  const key = chancellorConsultStorageKey("user-1");
  const valid = memoryStorage({
    [key]: JSON.stringify({
      version: 1,
      messages: [
        { role: "user", content: "问" },
        { role: "assistant", content: "答" },
      ],
    }),
  });
  assert.deepEqual(loadChancellorConsultMessages("user-1", valid), [
    { role: "user", content: "问" },
    { role: "assistant", content: "答" },
  ]);

  for (const messages of [
    [{ role: "assistant", content: "答" }],
    [{ role: "user", content: "问" }],
    [{ role: "user", content: "" }, { role: "assistant", content: "答" }],
  ]) {
    const invalid = memoryStorage({
      [key]: JSON.stringify({ version: 1, messages }),
    });
    assert.deepEqual(loadChancellorConsultMessages("user-1", invalid), []);
  }
});

test("consult storage keeps only the latest twenty messages", () => {
  const storage = memoryStorage();
  const messages = Array.from({ length: 12 }, (_, index) => [
    { role: "user" as const, content: `问${index}` },
    { role: "assistant" as const, content: `答${index}` },
  ]).flat();

  saveChancellorConsultMessages("user-1", messages, storage);

  const saved = JSON.parse(storage.value(chancellorConsultStorageKey("user-1")) ?? "{}");
  assert.equal(saved.messages.length, 20);
  assert.equal(saved.messages[0].content, "问2");
  assert.equal(saved.messages[19].content, "答11");
});

test("consult storage failures safely fall back without throwing", () => {
  const unavailable = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  };
  assert.deepEqual(loadChancellorConsultMessages("user-1", unavailable), []);
  assert.doesNotThrow(() => saveChancellorConsultMessages("user-1", [], unavailable));
});
