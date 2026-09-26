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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

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

  // The second utterance cancels the first request before it resolves.
  const first = speak("First", "en");
  const second = speak("Second", "en");
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(response);
  await tick(); // the queued sentence starts playing
  assert.equal(players.length, 1);
  assert.equal(players[0].playing, true);
  players[0].onended(); // playback finishes, then the utterance resolves
  await second;
  requests[0].resolve(response); // A response that ignores cancellation.
  await first;
  assert.equal(players.length, 1);
  assert.equal(players[0].playing, false);

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
  await tick();
  stopSpeaking();
  resolveBlob(new Blob(["audio"]));
  await fourth;
  assert.equal(players.length, 1);

  const fifth = speak("Fifth", "en");
  requests[4].resolve(response);
  await tick();
  assert.equal(players[1].playing, true);
  players[1].onended();
  await fifth;
  assert.equal(players[1].playing, false);
  const sixth = speak("Sixth", "zh");
  requests[5].resolve(response);
  await tick();
  assert.equal(players[2].playing, true);
  players[2].onerror(); // A failed chunk hands the rest to the device voice.
  await sixth;
  assert.equal(players[2].playing, false);

  const playbackChanges = [];
  const seventh = speak("First sentence. Second sentence.", "en", (playing) =>
    playbackChanges.push(playing),
  );
  requests[6].resolve(response);
  await tick();
  assert.deepEqual(playbackChanges, [true]);
  players[3].onended();
  await tick();
  assert.deepEqual(playbackChanges, [true]);
  requests[7].resolve(response);
  await tick();
  assert.deepEqual(playbackChanges, [true]);
  players[4].onended();
  await seventh;
  assert.deepEqual(playbackChanges, [true, false]);

  assert.deepEqual(revoked, ["blob:0", "blob:1", "blob:2", "blob:3", "blob:4"]);
});
