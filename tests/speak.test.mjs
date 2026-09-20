import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/speak.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { speak, stopSpeaking } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("speech cancels stale requests and keeps only one player active", async (t) => {
  const requests = [];
  const players = [];
  const revoked = [];
  t.mock.method(
    globalThis,
    "fetch",
    (_url, options) => new Promise((resolve) => requests.push({ resolve, signal: options.signal })),
  );
  t.mock.method(URL, "createObjectURL", () => `blob:${players.length}`);
  t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
  globalThis.window = {};
  globalThis.Audio = class {
    constructor(url) {
      this.src = url;
      this.playing = false;
      players.push(this);
    }
    async play() {
      this.playing = true;
    }
    pause() {
      this.playing = false;
    }
    removeAttribute() {
      this.src = "";
    }
  };
  t.after(() => {
    stopSpeaking();
    for (const [key, descriptor] of [
      ["window", originalWindow],
      ["Audio", originalAudio],
    ]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const response = { ok: true, blob: async () => new Blob(["audio"]) };

  const first = speak("First", "en");
  const second = speak("Second", "en");
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(response);
  await second;
  requests[0].resolve(response); // Simulate a response that ignores cancellation.
  await first;
  assert.equal(players.length, 1);
  assert.equal(players[0].playing, true);

  const third = speak("Third", "en");
  assert.equal(players[0].playing, false);
  stopSpeaking(); // Stop while loading, as when starting a recording or unmounting.
  requests[2].resolve(response);
  await third;
  assert.equal(players.length, 1);

  let resolveBlob;
  const fourth = speak("Fourth", "en");
  requests[3].resolve({
    ok: true,
    blob: () =>
      new Promise((resolve) => {
        resolveBlob = resolve;
      }),
  });
  await Promise.resolve();
  stopSpeaking();
  resolveBlob(new Blob(["audio"]));
  await fourth;
  assert.equal(players.length, 1);

  const fifth = speak("Fifth", "en");
  requests[4].resolve(response);
  await fifth;
  players[1].onended();
  assert.equal(players[1].playing, false);
  assert.deepEqual(revoked, ["blob:0", "blob:1"]);
});
