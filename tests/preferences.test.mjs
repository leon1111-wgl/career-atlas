import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePreferences,
  preferenceAssessment,
  rankPreferredRoles,
} from "../web/preferences.js";

const now = Date.parse("2026-10-16T00:00:00Z");
const industries = [
  { id: "software", cnWageIndustry: "信息服务" },
  { id: "health", cnWageIndustry: "卫生" },
];
const makeRole = (id, industryId = "software", tradeoff = "", access = 3) => ({
  id,
  title: id,
  industryId,
  soc: id,
  majors: ["cs"],
  summary: "开展业务",
  daily: [],
  rubric: {
    moat: { value: 3 },
    ai: { value: 3 },
    access: { value: access, reason: "实践训练要求" },
  },
  jobReality: {
    companyTypes: [{ type: "团队", work: "执行任务", tradeoff }],
    interviewChecks: [],
  },
});
const data = {
  sources: {
    "nbs-wages": {
      value: {
        year: 2025,
        sectors: {
          信息服务: { private: { wage: 150000, growth: 3 } },
          卫生: { private: { wage: 80000, growth: 3 } },
          合计: { private: { wage: 75000 } },
        },
      },
    },
    bls: {
      value: {
        wageYear: 2025,
        period: "2025–2035",
        occupations: {
          "00-0000": { medianWage: 50000 },
          a: { type: "Line item", medianWage: 70000, growth: 10 },
          b: { type: "Line item", medianWage: 140000, growth: 10 },
        },
      },
    },
  },
};
const catalog = (roles) => ({ industries, roles });
const assessment = (role, prefs, region = "CN", observations = data) =>
  preferenceAssessment(
    role,
    industries.find((i) => i.id === role.industryId),
    region,
    observations,
    prefs,
    now,
  );

test("preferences default to no ranking and normalize ordered selections without mutation", () => {
  assert.deepEqual(normalizePreferences(), { major: "", priorities: [] });
  const prefs = {
    major: " cs ",
    priorities: ["balance", "pay", "balance", "invalid", "stability", "access"],
    priority: "access",
  };
  assert.deepEqual(normalizePreferences(prefs), {
    major: "cs",
    priorities: ["balance", "pay", "stability"],
  });
  assert.equal(prefs.priorities.length, 6);
  assert.deepEqual(normalizePreferences(null), { major: "", priorities: [] });
});
test("legacy preferences migrate without claiming moat or AI predicts stability", () => {
  assert.deepEqual(normalizePreferences({ priority: "access" }).priorities, [
    "access",
  ]);
  for (const priority of ["balanced", "moat", "ai", "invalid"])
    assert.deepEqual(normalizePreferences({ priority }).priorities, []);
  assert.deepEqual(
    normalizePreferences({ priority: "access", priorities: [] }).priorities,
    [],
  );
});
test("salary priority uses the selected country and declares its population", () => {
  const a = makeRole("a"),
    b = makeRole("b", "health");
  assert.deepEqual(
    rankPreferredRoles(
      catalog([a, b]),
      "CN",
      data,
      { priorities: ["pay"] },
      now,
    ).map((x) => x.role.id),
    ["a", "b"],
  );
  assert.deepEqual(
    rankPreferredRoles(
      catalog([a, b]),
      "US",
      data,
      { priorities: ["pay"] },
      now,
    ).map((x) => x.role.id),
    ["b", "a"],
  );
  assert.match(
    assessment(a, { priorities: ["pay"] }).criteria[0].reason,
    /行业|门类/,
  );
  assert.match(
    assessment(a, { priorities: ["pay"] }, "US").criteria[0].reason,
    /中位数/,
  );
});
test("missing or stale pay sorts last and never uses the other country", () => {
  const unknown = makeRole("unknown"),
    known = makeRole("a");
  const out = rankPreferredRoles(
    catalog([unknown, known]),
    "US",
    data,
    { priorities: ["pay"] },
    now,
  );
  assert.equal(out[0].role.id, "a");
  assert.equal(out[1].assessment.criteria[0].missing, true);
  const stale = structuredClone(data);
  stale.sources["nbs-wages"].value.year = 2020;
  assert.equal(
    assessment(known, { priorities: ["pay"] }, "CN", stale).criteria[0].value,
    null,
  );
});
test("same broad wage data remains tied without hidden index or access tiebreaker", () => {
  const a = makeRole("a", "software", "", 1),
    b = makeRole("b", "software", "", 5);
  const ranked = rankPreferredRoles(
    catalog([a, b]),
    "CN",
    data,
    { priorities: ["pay"] },
    now,
  );
  assert.deepEqual(
    ranked.map((x) => x.role.id),
    ["a", "b"],
  );
  assert.equal(ranked[0].rank, ranked[1].rank);
});
test("unmeasured priorities cannot override observed pay, regardless of priority order", () => {
  const highPay = makeRole("a", "software", "夜班、出差与项目高峰", 2),
    lowerPay = makeRole("b", "health", "白班且工作稳定", 5);
  const c = catalog([lowerPay, highPay]);
  for (const priorities of [
    ["pay", "balance"],
    ["balance", "pay"],
    ["access", "stability", "pay"],
  ]) {
    const out = rankPreferredRoles(c, "CN", data, { priorities }, now);
    assert.equal(out[0].role.id, "a");
    assert.deepEqual(out[0].assessment.activePriorities, ["pay"]);
  }
});
test("workload keywords remain unmeasured and do not manufacture working hours or scores", () => {
  const unknown = makeRole("a"),
    night = makeRole("b", "health", "夜班较多，需核对排班");
  const empty = assessment(unknown, { priorities: ["balance"] }).criteria[0];
  assert.equal(empty.value, null);
  assert.equal(empty.missing, true);
  const found = assessment(night, { priorities: ["balance"] }).criteria[0];
  assert.equal(found.value, null);
  assert.equal(found.missing, true);
  assert.match(found.reason, /工时/);
  assert.equal(
    rankPreferredRoles(
      catalog([unknown, night]),
      "CN",
      data,
      { priorities: ["balance"] },
      now,
    )[0].role.id,
    "a",
  );
});
test("employment text cannot substitute for measured stability evidence", () => {
  const generic = makeRole("a", "software", "积累项目经验，输出项目报告");
  assert.equal(
    assessment(generic, { priorities: ["stability"] }).criteria[0].missing,
    true,
  );
  const variable = makeRole(
    "b",
    "health",
    "收入受提成影响，短期合同需核对续约",
  );
  const criterion = assessment(variable, { priorities: ["stability"] })
    .criteria[0];
  assert.equal(criterion.missing, true);
  assert.equal(criterion.value, null);
  assert.match(criterion.reason, /样本|数据/);
});
test("explicit negation does not become a positive workload risk or inferred low risk", () => {
  const role = makeRole("a", "software", "无需夜班，不用出差，不涉及轮班");
  assert.equal(
    assessment(role, { priorities: ["balance"] }).criteria[0].missing,
    true,
  );
});
test("major association is the first layer and cannot be mistaken for qualification", () => {
  const highPay = makeRole("a"),
    matching = makeRole("b", "health");
  matching.majors = ["nursing"];
  const ranked = rankPreferredRoles(
    catalog([highPay, matching]),
    "CN",
    data,
    { major: "nursing", priorities: ["pay"] },
    now,
  );
  assert.equal(ranked[0].role.id, "b");
  assert.equal(ranked[0].assessment.majorMatch, true);
  assert.equal(ranked[1].assessment.majorMatch, false);
  assert.equal(assessment(highPay, {}).majorMatch, null);
});
test("editorial access grades do not become admission or hiring difficulty evidence", () => {
  const easy = makeRole("a", "software", "", 5),
    hard = makeRole("b", "software", "", 2);
  const c = assessment(easy, { priorities: ["access"] }).criteria[0];
  assert.equal(c.value, null);
  assert.equal(c.missing, true);
  assert.match(c.reason, /录用|申请|竞争/);
  assert.equal(
    rankPreferredRoles(
      catalog([hard, easy]),
      "CN",
      data,
      { priorities: ["access"] },
      now,
    )[0].role.id,
    "b",
  );
  easy.rubric.access.value = 4.5;
  assert.equal(
    assessment(easy, { priorities: ["access"] }).criteria[0].missing,
    true,
  );
});
test("985, 211 and overseas labels add no advantage and unmeasured preferences preserve catalog order", () => {
  const roles = [
    makeRole("b", "health", "夜班，短期合同", 1),
    makeRole("a", "software", "稳定白班", 5),
  ];
  for (const school of ["985", "211", "海外名校"]) {
    const prefs = {
      school,
      education: school,
      universityTier: school,
      priorities: ["balance", "stability", "access"],
    };
    const out = rankPreferredRoles(catalog(roles), "CN", data, prefs, now);
    assert.deepEqual(
      out.map((x) => x.role.id),
      ["b", "a"],
    );
    assert.equal(out[0].rank, out[1].rank);
    assert.deepEqual(out[0].assessment.activePriorities, []);
  }
});
test("ranking preserves source objects and rejects an unsupported region", () => {
  const c = catalog([makeRole("a"), makeRole("b")]),
    before = JSON.stringify(c);
  assert.deepEqual(
    rankPreferredRoles(c, "CN", data, {}, now).map((x) => x.role.id),
    ["a", "b"],
  );
  assert.equal(JSON.stringify(c), before);
  assert.throws(() => rankPreferredRoles(c, "XX", data, {}, now), RangeError);
});
