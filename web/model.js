/** Explicit-click, browser-only model client. No model is loaded on import. */
export class ModelClient {
  static async available() {
    if (!globalThis.isSecureContext || !globalThis.navigator?.gpu) return false;
    try { return Boolean(await navigator.gpu.requestAdapter()); } catch { return false; }
  }
  constructor() { this.worker = null; this.pending = null; this.sequence = 0; this.loaded = false; }
  request(type, payload = {}, onEvent, timeout = 180000) {
    if (this.pending) return Promise.reject(new Error('模型正忙，请等待或停止当前操作。'));
    if (!this.worker) {
      this.worker = new Worker(new URL('./model-worker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const p = this.pending;
        if (!p || p.id !== data.id) return;
        if (data.type === 'progress' || data.type === 'token') {
          try { p.onEvent?.(data.value); } catch { /* UI callbacks cannot break cleanup. */ }
        } else {
          clearTimeout(p.timer); this.pending = null;
          if (data.type === 'error') p.reject(new Error(data.error));
          else p.resolve(data.value);
        }
      };
      this.worker.onerror = () => this.teardown(new Error('本地模型运行失败，请重试或使用检索结果。'));
      this.worker.onmessageerror = () => this.teardown(new Error('本地模型通信失败。'));
    }
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => this.teardown(new Error('本地模型超时，已释放运行资源。')), timeout);
      this.pending = { id, resolve, reject, timer, onEvent };
      this.worker.postMessage({ id, type, ...payload });
    });
  }
  async load(onProgress) {
    if (this.loaded) return;
    const sequence = this.sequence;
    if (!await ModelClient.available()) throw new Error('当前浏览器或设备不支持 WebGPU，请使用页面检索功能。');
    if (sequence !== this.sequence) throw new Error('已停止本地模型。');
    await this.request('load', {}, onProgress, 900000); this.loaded = true;
  }
  async generate(messages, onToken, schema) {
    if (!this.loaded) throw new Error('请先加载本地模型。');
    if (!Array.isArray(messages) || !messages.length) throw new Error('请输入问题。');
    return this.request('generate', { messages, schema }, onToken);
  }
  interrupt() {
    // Termination also stops an in-flight download and guarantees GPU cleanup.
    this.teardown(new Error('已停止本地模型。'));
  }
  teardown(error) {
    this.sequence++;
    this.worker?.terminate(); this.worker = null; this.loaded = false;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(error); this.pending = null; }
  }
  async unload() { this.teardown(new Error('本地模型已卸载。')); }
}
