import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advise } from '../web/advisor.js';
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const catalog = read('../content/catalog.json'), data = read('../web/data/observations.json'), model = read('../web/intent-model.json');
const ask = (q, region='CN', m=model) => advise(q,catalog,data,region,m);
test('comparison preserves both requested jobs and their qualifications without a model',()=>{
 const a=ask('AI 应用工程师和算法研究有什么区别？','CN',null);
 assert.equal(a.intent,'compare');
 assert.deepEqual(a.evidence.map(d=>d.id).sort(),['role:agent','role:mlresearch']);
 assert(a.sections.every(s=>s.items.some(t=>t.includes('资格核对'))));
});
test('company answer explains three different work environments',()=>{
 const a=ask('智能体应用工程师在不同公司里工作有什么特点');
 assert.equal(a.intent,'company');
 assert(a.sections[0].items.some(t=>t.includes('模型平台企业')));
 assert(a.sections[0].items.some(t=>t.includes('行业软件企业')));
});
test('salary retains country, source, year, scope and missing values',()=>{
 for(const region of ['CN','US']) {
  const a=ask('后端开发工程师工资是多少',region);
  assert.equal(a.intent,'salary');
  assert(a.evidence.every(d=>d.region===region && d.kind==='official-fact'));
  assert(a.sections[0].items.join('').includes('不是'));
  assert(!JSON.stringify(a).includes(region==='CN'?'美元':'人民币/年'));
 }
});
test('public routes respect country and unknown questions do not invent answers',()=>{
 assert(ask('考公和事业单位招聘有什么区别').evidence.every(d=>d.id.startsWith('public:cn-')));
 assert(ask('公共部门有哪些招聘路径','US').evidence.every(d=>d.id.startsWith('public:us-')));
 assert.equal(ask('火星煎饼独角兽宇宙咒语').sections.length,0);
});
test('latest CPI answer preserves its observation period and publication date',()=>{
 const a=ask('2026年最新CPI数据是多少');
 assert(a.evidence.some(d=>d.id==='macro:cpi'));
 const cpi=data.sources['cn-current'].value.indicators.find(i=>i.id==='cpi');
 assert(JSON.stringify(a.sections).includes(cpi.publishedAt));
 assert(JSON.stringify(a.sections).includes(cpi.period));
 assert(!ask('美国CPI数据是多少','US').evidence.some(d=>d.id.startsWith('macro:')));
});
test('major prompts identify the named background and keep local qualifications',()=>{
 for(const [name,id] of [['机械','mech'],['计算机','cs']]) {
  const a=ask(`${name}专业可以去哪些行业？`);
  assert(a.evidence.some(d=>d.id===`major:${id}`));
  assert(!a.evidence.some(d=>d.id==='major:agriculture'));
  const roleIds=catalog.majors.find(m=>m.id===id).roleIds;
  assert(a.evidence.filter(d=>d.kind==='role').every(d=>roleIds.includes(d.id.slice(5))));
  assert(a.sections.filter(s=>s.source.startsWith('role:')).every(s=>s.items.some(x=>x.includes('资格核对'))));
 }
});
