import test from 'node:test';import assert from 'node:assert/strict';
import { evidenceTask, selectEvidence } from '../web/grounded.js';
const docs=[{id:'r1',title:'工程师',text:'日常：编写程序并验证结果。\n技能：测试、SQL。\n资格：没有统一强制认证。',region:'CN'},{id:'r2',title:'研究员',text:'日常：设计实验并复现基线。\n技能：统计与数学。',region:'CN'}];
test('model can select only literal supplied evidence',()=>{const t=evidenceTask('如何比较',docs);const r=selectEvidence(JSON.stringify({selected:[0,1]}),t.choices);assert.equal(r[0].text,t.choices[0].text);assert.ok(docs.some(d=>d.text.includes(r[0].text)));});
test('reject unsupported generated assertions instead of displaying them',()=>{const t=evidenceTask('如何比较',docs);assert.throws(()=>selectEvidence('{"selected":[99],"answer":"必须持证"}',t.choices));});
test('context bound and region remain in controlled evidence',()=>{const t=evidenceTask('x'.repeat(900),Array.from({length:3},()=>({...docs[0],text:'日常：'+('学习数据，'.repeat(1000))})));assert.ok(t.messages[1].content.length<2300);assert.ok(t.messages[1].content.includes('CN'));});
test('Qwen thinking envelope is discarded before validating selected IDs',()=>{const t=evidenceTask('比较',docs);const result=selectEvidence('<think>irrelevant untrusted reasoning</think>\n{"selected":[0]}',t.choices);assert.equal(result.length,1);assert.equal(result[0].id,0);});
