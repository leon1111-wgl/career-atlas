import test from "node:test";
import assert from "node:assert/strict";
import { evidenceTask, selectEvidence } from "../web/grounded.js";
const docs = [
  {
    id: "r1",
    title: "工程师",
    text: "日常：编写程序并验证结果。\n技能：测试、SQL。\n资格：没有统一强制认证。",
    region: "CN",
  },
  {
    id: "r2",
    title: "研究员",
    text: "日常：设计实验并复现基线。\n技能：统计与数学。",
    region: "CN",
  },
];
test("model can select only literal supplied evidence", () => {
  const t = evidenceTask("如何比较", docs);
  const r = selectEvidence(JSON.stringify({ selected: [0, 1] }), t.choices);
  assert.equal(r[0].text, t.choices[0].text);
  assert.ok(docs.some((d) => d.text.includes(r[0].text)));
});
test("reject unsupported generated assertions instead of displaying them", () => {
  const t = evidenceTask("如何比较", docs);
  assert.throws(() =>
    selectEvidence('{"selected":[99],"answer":"必须持证"}', t.choices),
  );
});
test("context bound and region remain in controlled evidence", () => {
  const t = evidenceTask(
    "x".repeat(900),
    Array.from({ length: 3 }, () => ({
      ...docs[0],
      text: "日常：" + "学习数据，".repeat(1000),
    })),
  );
  assert.ok(t.messages[1].content.length < 2300);
  assert.ok(t.messages[1].content.includes("CN"));
});
test("Qwen thinking envelope is discarded before validating selected IDs", () => {
  const t = evidenceTask("比较", docs);
  const result = selectEvidence(
    '<think>irrelevant untrusted reasoning</think>\n{"selected":[0]}',
    t.choices,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 0);
});

test("graduate and policy questions give the local model actual numbers and scope", () => {
  const graduate = {
    title: "某校专业",
    region: "CN",
    text: "统计期：2025届。\n样本范围：某校67名硕士。\n去向数据：协议合同就业91.04%。\n使用限制：不是全国专业或个人录取率。",
  };
  const t = evidenceTask("毕业去向有哪些", [graduate]);
  assert(t.choices.some((c) => c.text.includes("91.04%")));
  assert(t.choices.some((c) => c.text.includes("67名硕士")));
  const policy = {
    title: "政策",
    region: "CN",
    text: "发布：2026-01-01；拟议措施。\n原文概要：待落实。\n落地条件：预算未确认。",
  };
  assert(
    evidenceTask("国家政策支持哪些方向", [policy]).choices.some((c) =>
      c.text.includes("预算未确认"),
    ),
  );
});
