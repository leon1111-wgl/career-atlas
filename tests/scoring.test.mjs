import test from "node:test";
import assert from "node:assert/strict";
import { scoreRole, industryScore, freshness } from "../web/scoring.js";
const now = Date.parse("2026-10-16T00:00:00Z");
const role = {
  id: "a",
  industryId: "manufacturing",
  soc: "15-1252",
  majors: ["cs"],
  rubric: { moat: { value: 4 }, ai: { value: 3 }, access: { value: 2 } },
};
const industry = { id: "manufacturing", cnWageIndustry: "制造业" };
const data = {
  sources: {
    bls: {
      value: {
        period: "2025–2035",
        wageYear: 2025,
        occupations: {
          "15-1252": {
            type: "Line item",
            growth: 20,
            employment: 1000,
            openings: 100,
            medianWage: 100000,
          },
          "00-0000": { medianWage: 50000 },
        },
      },
    },
    "nbs-wages": {
      value: {
        year: 2025,
        sectors: {
          制造业: { private: { wage: 100000, growth: 5 } },
          合计: { private: { wage: 50000 } },
        },
      },
    },
  },
};
const score = (r = role, region = "CN", d = data) =>
  scoreRole(r, industry, region, d, now);
test("Chinese evidence explicitly counts broad industry statistics separately from judgments", () => {
  const s = score();
  assert.equal(s.statisticalCount, 2);
  assert.equal(s.judgmentCount, 0);
  assert.equal(s.observedCoverage, 35);
  assert.match(s.evidenceLabel, /岗位数据待补/);
  assert.equal(s.dimensions.find((x) => x.key === "growth").value, null);
});
test("editorial judgments alone never produce a recommendation", () => {
  assert.equal(score(role, "CN", { sources: {} }).score, null);
});
test("neutral shrink avoids renormalizing a sparse high score to 100", () => {
  const s = score();
  assert.ok(Math.abs(s.score - 50) <= Math.abs(s.rawScore - 50));
  assert.ok(s.lower <= s.score && s.upper >= s.score);
  assert.equal(s.upper - s.lower, 100 - s.coverage);
});
test("unverified editorial grades never change the statistical index", () => {
  const original = score();
  for (const value of [1, 3, 5, NaN, Infinity, 3.5, "4"]) {
    const r = structuredClone(role);
    for (const key of ["moat", "ai", "access"])
      r.rubric[key] = { value, reason: "编辑判断" };
    const actual = score(r);
    assert.equal(actual.score, original.score);
    assert.equal(actual.dimensions.find((x) => x.key === "access").value, null);
  }
});
test("replacement openings do not inflate the opportunity score", () => {
  const d = structuredClone(data);
  d.sources.bls.value.occupations[role.soc].openings = 100000;
  assert.equal(score(role, "US", d).score, score(role, "US").score);
});
test("US requires a detailed SOC and does not borrow China data", () => {
  assert.equal(score({ ...role, soc: null }, "US").score, null);
  const d = structuredClone(data);
  d.sources.bls.value.occupations[role.soc].type = "Summary";
  assert.equal(score(role, "US", d).score, null);
});
test("stale, future and undated annual wage inputs are excluded", () => {
  for (const year of [2020, 2027, null]) {
    const d = structuredClone(data);
    d.sources["nbs-wages"].value.year = year;
    assert.equal(score(role, "CN", d).score, null);
  }
});
test("nonfinite or nonpositive wages and censored wages do not enter pay dimension", () => {
  for (const n of [NaN, Infinity, -1, 0, "100"]) {
    const d = structuredClone(data);
    d.sources["nbs-wages"].value.sectors["制造业"].private.wage = n;
    assert.equal(
      score(role, "CN", d).dimensions.find((x) => x.key === "pay").value,
      null,
    );
  }
  const d = structuredClone(data);
  d.sources.bls.value.occupations[role.soc].wageCensored = true;
  assert.equal(
    score(role, "US", d).dimensions.find((x) => x.key === "pay").value,
    null,
  );
});
test("identical role copies do not change industry score or statistical group count", () => {
  const b = { ...structuredClone(role), id: "b", soc: "15-1253" };
  b.rubric.moat.value = 1;
  const d = structuredClone(data);
  d.sources.bls.value.occupations[b.soc] = {
    ...d.sources.bls.value.occupations[role.soc],
    growth: 0,
  };
  const a = industryScore(industry, { roles: [role, b] }, "US", d, now);
  const c = industryScore(
    industry,
    { roles: [role, b, { ...role, id: "copy" }] },
    "US",
    d,
    now,
  );
  assert.equal(a.score, c.score);
  assert.equal(a.coverage, c.coverage);
  assert.equal(a.observedCoverage, c.observedCoverage);
  assert.equal(a.lower, c.lower);
  assert.equal(a.upper, c.upper);
  assert.equal(c.evidenceGroups, 2);
});
test("freshness rejects malformed timestamps and failure statuses", () => {
  for (const source of [
    { value: {}, lastSuccess: "garbage" },
    { value: {}, lastSuccess: "2026-10-15", status: "error" },
  ])
    assert.equal(freshness(source, now).tone, "warn");
});
test("regional boundaries are explicit", () =>
  assert.throws(() => score(role, "XX"), RangeError));
test("an industry with one measured occupation and three unmeasured mappings remains unscored", () => {
  const roles = [
    role,
    ...["x", "y", "z"].map((id) => ({ ...role, id, soc: id })),
  ];
  const s = industryScore(industry, { roles }, "US", data, now);
  assert.equal(s.score, null);
  assert.equal(s.evidenceGroups, 1);
  assert.equal(s.totalGroups, 4);
  assert.equal(s.lower, null);
});
