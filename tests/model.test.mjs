import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ModelClient } from '../web/model.js';

test('unsupported environment does not create a worker or download weights', async () => {
  assert.equal(await ModelClient.available(), false);
  const client = new ModelClient();
  await assert.rejects(client.load(), /WebGPU/);
  assert.equal(client.worker, null);
});
test('worker streams deltas and cancellation rejects outstanding operation', async () => {
  const previous = globalThis.Worker;
  class FakeWorker {
    postMessage(data) { this.message = data; }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FakeWorker;
  try {
    const client = new ModelClient(); client.loaded = true;
    const tokens = [];
    const pending = client.generate([{role:'user', content:'你好'}], x => tokens.push(x));
    await assert.rejects(client.generate([{role:'user', content:'重复'}]), /正忙/);
    const worker = client.worker;
    worker.onmessage({data:{id:worker.message.id,type:'token',value:'你好'}});
    worker.onmessage({data:{id:worker.message.id,type:'done',value:'你好'}});
    assert.equal(await pending, '你好'); assert.deepEqual(tokens, ['你好']);
    const cancelled = client.generate([{role:'user',content:'继续'}]);
    client.interrupt(); await assert.rejects(cancelled, /停止/);
    assert.equal(worker.terminated, true); assert.equal(client.loaded, false);
    await client.unload();
  } finally { globalThis.Worker = previous; }
});
test('config pins model revision and local WASM matches Git blob', () => {
  const cfg = JSON.parse(readFileSync(new URL('../web/model-config.json', import.meta.url)));
  assert.match(cfg.revision, /^[a-f0-9]{40}$/);
  assert.ok(cfg.model.endsWith('/resolve/main/') || cfg.model.includes(`/resolve/${cfg.revision}/`));
  assert.ok(cfg.weight_bytes < 1_000_000_000);
  const wasm = readFileSync(new URL('../web/vendor/qwen3-0.6b-webgpu.wasm', import.meta.url));
  assert.equal(wasm.subarray(0,4).toString('hex'), '0061736d');
  assert.equal(createHash('sha1').update(`blob ${wasm.length}\0`).update(wasm).digest('hex'), cfg.wasm_git_blob);
});
