import { CreateMLCEngine } from './vendor/webllm.js';
let engine = null;
let busy = false;
const send = (id, type, value) => self.postMessage({ id, type, value });
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  if (busy) { self.postMessage({ id, type: 'error', error: '模型正忙。' }); return; }
  busy = true;
  try {
    if (type === 'load') {
      if (!engine) {
        const response = await fetch(new URL('./model-config.json', import.meta.url));
        if (!response.ok) throw new Error('无法读取模型配置。');
        const config = await response.json();
        const model = new URL(config.model, import.meta.url);
        const lib = new URL(config.model_lib, import.meta.url);
        if (!((model.protocol === 'https:' && model.hostname === 'huggingface.co') || model.origin === self.location.origin) || lib.origin !== self.location.origin) throw new Error('模型来源配置无效。');
        engine = await CreateMLCEngine(config.model_id, {
          initProgressCallback: (progress) => send(id, 'progress', progress),
          appConfig: { model_list: [{ model: model.href, model_id: config.model_id, model_lib: lib.href, overrides: { context_window_size: 4096 } }] },
        });
      }
      send(id, 'done', true);
    } else if (type === 'generate') {
      if (!engine) throw new Error('模型尚未加载。');
      const messages = data.messages;
      if (!Array.isArray(messages) || messages.length > 20 || messages.some(m => !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string') || messages.reduce((n,m) => n + m.content.length, 0) > 12000) throw new Error('输入过长，请缩短问题或参考材料。');
      const stream = await engine.chat.completions.create({ messages, stream: true, temperature: 0.0, max_tokens: 256, ...(data.schema ? {response_format:{type:'json_object', schema:JSON.stringify(data.schema)}} : {}), extra_body: { enable_thinking: false } });
      let result = '';
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';
        if (token) { result += token; send(id, 'token', token); }
      }
      send(id, 'done', result);
    } else throw new Error('未知模型操作。');
  } catch (error) {
    self.postMessage({ id, type: 'error', error: `本地模型暂不可用：${String(error?.message || error).slice(0, 350)}` });
  } finally { busy = false; }
};
