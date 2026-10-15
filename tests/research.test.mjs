import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  majorEvidence,
  roleOutcomes,
  knowledgeDocuments,
  relevantPolicies,
  selectGraduateGroups,
  resolveMajor,
} from "../web/research.js";
import { advise } from "../web/advisor.js";
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const catalog = read("../content/catalog.json"),
  data = read("../web/data/observations.json");
test("doctorate researchers and multiple degree requests do not become contradictory filters", () => {
  const outcomes = read("../content/graduate-cn-additions.json");
  const doctoral = selectGraduateGroups(
    outcomes,
    "华东师大博士研究生毕业去向",
    "CN",
  );
  assert(doctoral.length > 0);
  assert(doctoral.every((g) => g.educationLevel === "doctorate"));
  const multiple = selectGraduateGroups(
    outcomes,
    "华东师大硕士和本科毕业去向",
    "CN",
  );
  assert.deepEqual(
    new Set(multiple.map((g) => g.educationLevel)),
    new Set(["master", "bachelor"]),
  );
  const graduate = selectGraduateGroups(
    outcomes,
    "华东师大研究生毕业去向",
    "CN",
  );
  assert.deepEqual(
    new Set(graduate.map((g) => g.educationLevel)),
    new Set(["master", "doctorate"]),
  );
});
test("official requirements feed answers without implying school or admission advantage", () => {
  const recruitment = read("../content/recruitment-evidence.json");
  const answer = advise(
    "双非去建设银行招聘条件是什么？",
    catalog,
    data,
    "CN",
    null,
    { recruitment },
  );
  assert(answer.evidence.some((x) => x.kind === "recruitment-fact"));
  const text = JSON.stringify(answer.sections);
  assert.match(text, /硕士研究生及以上/);
  assert.match(text, /国家认可的毕业证与学位证/);
  assert.match(text, /外语设六级/);
  assert.match(text, /已过本公告报名截止/);
  assert.match(text, /不能估计录用难度或学校优势/);
  assert(!answer.evidence.some((x) => x.region === "US"));
});
test("unreported graduate cells remain missing in model context", () => {
  const outcomes = read("../content/graduate-cn-additions.json");
  const docs = knowledgeDocuments({ outcomes }, catalog, "CN");
  assert(docs.some((d) => d.text.includes("原文未给出数值")));
  assert(!docs.some((d) => /null%|undefined%/.test(d.text)));
  const groups = selectGraduateGroups(outcomes, "华东师大本科毕业去向", "CN");
  assert(groups.length > 0);
  assert(
    groups.every(
      (g) =>
        g.school.domain === "ecnu.edu.cn" && g.educationLevel === "bachelor",
    ),
  );
});
const group = {
  id: "cs-us",
  title: "计算机",
  region: "US",
  majorIds: ["cs"],
  period: "2023",
  source: {
    title: "官方职业分布",
    url: "https://www.bls.gov/ooh/field-of-degree/computer-and-information/computer-and-information.htm",
  },
  population: "已就业的计算机学位持有人",
  rows: [{ occupation: "软件开发", share: 24, soc: "15-1252" }],
  limitations: ["不是应届毕业去向"],
};
const policy = {
  id: "ai",
  region: "CN",
  title: "人工智能政策",
  publishedAt: "2026-01-01",
  verifiedAt: "2026-10-15",
  status: "行动计划",
  url: "https://www.gov.cn/policy",
  summary: "人工智能应用任务",
  industryIds: ["ai"],
  opportunities: ["先形成验收项目"],
  constraints: ["预算与招聘还需核实"],
};
const knowledge = {
  research: { majors: [], industries: [] },
  outcomes: { groups: [group] },
  policies: { items: [policy] },
};
test("degree destinations retain region and population, never substituted for China", () => {
  assert.equal(majorEvidence(knowledge.outcomes, "cs", "CN").length, 0);
  assert.equal(majorEvidence(knowledge.outcomes, "cs", "US")[0].period, "2023");
  const docs = knowledgeDocuments(knowledge, catalog, "US");
  assert.match(docs[0].text, /已就业的计算机学位持有人/);
  assert.match(docs[0].text, /不是应届毕业去向/);
});
test("occupation evidence is associated only by known SOC in same country", () => {
  assert.equal(
    roleOutcomes(knowledge.outcomes, { soc: "15-1252" }, "US").length,
    1,
  );
  assert.equal(
    roleOutcomes(knowledge.outcomes, { soc: "15-1252" }, "CN").length,
    0,
  );
  assert.equal(roleOutcomes(knowledge.outcomes, { soc: null }, "US").length, 0);
});
test("policy excludes future, unreviewed and wrong-region entries", () => {
  const p = {
    items: [
      policy,
      { ...policy, id: "future", publishedAt: "2099-01-01" },
      { ...policy, id: "pending", status: "待核实" },
      { ...policy, id: "undated", publishedAt: "" },
    ],
  };
  assert.deepEqual(
    relevantPolicies(p, "CN", null, Date.parse("2026-10-16")).map((x) => x.id),
    ["ai"],
  );
  assert.equal(relevantPolicies(p, "US").length, 0);
});
test("graduate question actually consumes structured records and cites source", () => {
  const a = advise(
    "计算机专业毕业去向有哪些？",
    catalog,
    data,
    "US",
    null,
    knowledge,
  );
  assert(a.evidence.some((d) => d.id === "outcome:cs-us"));
  assert(JSON.stringify(a.sections).includes("24%"));
  const cn = advise(
    "计算机专业毕业去向有哪些？",
    catalog,
    data,
    "CN",
    null,
    knowledge,
  );
  assert(!JSON.stringify(cn).includes("24%"));
  assert(JSON.stringify(cn).includes("没有已接入"));
});
test("policy answer contains source date, mechanism and conditions rather than inventing score bonus", () => {
  const a = advise(
    "人工智能有什么国家政策支持？",
    catalog,
    data,
    "CN",
    null,
    knowledge,
  );
  assert(a.evidence.some((d) => d.id === "policy:ai"));
  assert(JSON.stringify(a.sections).includes("2026-01-01"));
  assert(JSON.stringify(a.sections).includes("预算与招聘还需核实"));
  assert(!JSON.stringify(a.sections).includes("加分"));
});

test("two-character major names are retained and never fall back to unrelated reports", () => {
  for (const [name, id] of [
    ["化学", "chem"],
    ["法学", "law"],
    ["数学", "math"],
    ["哲学", "philosophy"],
  ]) {
    const k = {
      ...knowledge,
      outcomes: {
        groups: [group, { ...group, id, majorIds: [id], title: name }],
      },
    };
    const a = advise(
      `${name}专业毕业去向有哪些？`,
      catalog,
      data,
      "US",
      null,
      k,
    );
    assert(a.evidence.some((d) => d.id === `outcome:${id}`));
    assert(!a.evidence.some((d) => d.id === "outcome:cs-us"));
  }
});

test("school aliases select the actual institution and respect major/sample boundaries", () => {
  const a = {
    ...group,
    id: "sbs",
    region: "CN",
    source: { url: "https://xxgk.sbs.edu.cn/report" },
    majorIds: ["business"],
  };
  const b = {
    ...group,
    id: "xidian",
    region: "CN",
    source: { url: "https://job.xidian.edu.cn/report" },
    majorIds: [],
    groupType: "industry",
    educationLevel: "bachelor",
  };
  const o = { groups: [a, b] };
  assert.deepEqual(
    selectGraduateGroups(o, "西电本科就业报告主要行业有哪些", "CN").map(
      (x) => x.id,
    ),
    ["xidian"],
  );
  assert.equal(
    selectGraduateGroups(o, "西电计算机毕业去向", "CN", "cs").length,
    0,
  );
  assert.equal(selectGraduateGroups(o, "未知大学毕业去向", "CN").length, 0);
});

test("major resolution covers every catalog name and does not treat generic statistics as a statistics degree", () => {
  for (const m of catalog.majors)
    assert.equal(resolveMajor(catalog, m.name)?.id, m.id);
  assert.equal(resolveMajor(catalog, "最新毕业去向统计"), null);
  assert.equal(resolveMajor(catalog, "哲学")?.id, "philosophy");
});

test("school reports do not silently substitute bachelors for a requested masters cohort", () => {
  const g = {
    ...group,
    region: "CN",
    majorIds: [],
    educationLevel: "bachelor",
    source: { url: "https://job.xidian.edu.cn/report" },
  };
  assert.equal(
    selectGraduateGroups({ groups: [g] }, "西电硕士毕业去向", "CN").length,
    0,
  );
});
