/** Evidence-limited exploration index. These weights are declared judgments, not trained predictions. */
export const DIMENSIONS = [
  ["growth", "就业增长", 25],
  ["pay", "当地薪酬", 20],
  ["payGrowth", "工资增长", 15],
  ["profit", "盈利质量", 10],
  ["moat", "职业壁垒", 10],
  ["ai", "AI 互补", 10],
  ["access", "入门可行", 10],
];
export const clamp = (x, min = 0, max = 100) => Math.max(min, Math.min(max, x));
const valid = (x) => typeof x === "number" && Number.isFinite(x);
const scale = (x, a, b) => (valid(x) ? clamp(((x - a) / (b - a)) * 100) : null);
const editorial = new Set(["moat", "ai", "access"]);
const annualCurrent = (year, now) =>
  Number.isInteger(Number(year)) &&
  Number(year) <= new Date(now).getUTCFullYear() &&
  Number(year) >= new Date(now).getUTCFullYear() - 2;
export function roleObservation(role, industry, region, data) {
  if (!["CN", "US"].includes(region))
    throw new RangeError("region must be CN or US");
  const sources = data?.sources || {};
  if (region === "US") {
    const s = sources.bls;
    const raw = s?.value?.occupations?.[role.soc];
    return {
      kind: "美国职业统计代理",
      source: s,
      record: raw?.type === "Line item" ? raw : null,
      baseline: s?.value?.occupations?.["00-0000"]?.medianWage,
      period: s?.value?.period,
      wageYear: s?.value?.wageYear,
      group: role.soc ? `US:${role.soc}` : null,
    };
  }
  const s = sources["nbs-wages"];
  const sector = s?.value?.sectors?.[industry?.cnWageIndustry];
  return {
    kind: "中国私营单位行业均薪代理",
    source: s,
    record: sector?.private ?? null,
    nonprivate: sector?.nonprivate ?? null,
    baseline: s?.value?.sectors?.["合计"]?.private?.wage,
    period: String(s?.value?.year ?? "暂无"),
    wageYear: s?.value?.year,
    group: industry?.cnWageIndustry ? `CN:${industry.cnWageIndustry}` : null,
  };
}
export function scoreRole(role, industry, region, data, now = Date.now()) {
  const obs = roleObservation(role, industry, region, data),
    r = obs.record;
  const values = { growth: null, pay: null, payGrowth: null, profit: null };
  const issues = [];
  const usableYear = annualCurrent(obs.wageYear, now);
  if (r && !usableYear)
    issues.push("统计年份缺失、超前或距今超过两年，暂不用于指数");
  if (region === "US" && r) {
    const years = String(obs.period || "").match(/^(20\d{2})[–—-](20\d{2})$/);
    if (years && +years[2] - +years[1] === 10 && annualCurrent(+years[1], now))
      values.growth = scale(r.growth, -10, 20);
    else issues.push("就业预测期不能确认，暂不用于指数");
    if (
      usableYear &&
      !r.wageCensored &&
      valid(r.medianWage) &&
      r.medianWage > 0 &&
      valid(obs.baseline) &&
      obs.baseline > 0
    )
      values.pay = scale(r.medianWage / obs.baseline, 0.5, 3);
  }
  if (region === "CN" && r && usableYear) {
    if (valid(r.wage) && r.wage > 0 && valid(obs.baseline) && obs.baseline > 0)
      values.pay = scale(r.wage / obs.baseline, 0.5, 3);
    values.payGrowth = scale(r.growth, -5, 15);
  }
  // Editorial text is useful for reading, but it is not a measured feature.
  // Entry difficulty, AI complementarity and moat await validated outcome samples.
  for (const key of editorial) values[key] = null;
  const dimensions = DIMENSIONS.map(([key, name, weight]) => ({
    key,
    name,
    weight,
    value: values[key],
    kind: editorial.has(key) ? "研究判断" : "统计指标",
    reason: role.rubric?.[key]?.reason || "",
  }));
  const known = dimensions.filter((d) => d.value !== null);
  const coverage = known.reduce((a, d) => a + d.weight, 0);
  const stats = known.filter((d) => d.kind === "统计指标");
  const observedCoverage = stats.reduce((a, d) => a + d.weight, 0);
  const weighted = known.reduce((a, d) => a + (d.value * d.weight) / 100, 0);
  const eligible = stats.length >= 2 && observedCoverage >= 35;
  // Missing observations stay null. Only the index's missing weight is held at a disclosed neutral 50.
  const score = eligible ? Math.round(weighted + (100 - coverage) * 0.5) : null;
  return {
    score,
    centeredScore: weighted + (100 - coverage) * 0.5,
    rawScore: eligible ? Math.round((weighted / coverage) * 100) : null,
    coverage,
    observedCoverage,
    statisticalCount: stats.length,
    judgmentCount: known.length - stats.length,
    lower: Math.round(weighted),
    upper: Math.round(weighted + 100 - coverage),
    dimensions,
    observation: obs,
    issues,
    evidenceGroup: obs.group,
    evidenceLabel:
      region === "CN"
        ? stats.length
          ? `行业统计 ${stats.length} 项 · 岗位数据待补`
          : "岗位统计待补"
        : stats.length
          ? `职业统计 ${stats.length} 项`
          : "职业统计待补",
  };
}
export function industryScore(
  industry,
  catalog,
  region,
  data,
  now = Date.now(),
) {
  const roles = catalog.roles.filter((r) => r.industryId === industry.id);
  const scores = roles.map((r) => ({
    ...scoreRole(r, industry, region, data, now),
    unmappedKey: r.title || r.id,
  }));
  const ready = scores.filter((s) => s.score !== null);
  // Include missing groups as well: a single mapped occupation cannot stand in for a whole industry.
  const groups = new Map();
  for (const s of scores) {
    const key = s.evidenceGroup || `${region}:unmapped:${s.unmappedKey}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const signature = s.dimensions.map((d) => d.value).join("|");
    groups.get(key).set(signature, s);
  }
  const mean = (arr, key) =>
    arr.length ? arr.reduce((a, s) => a + s[key], 0) / arr.length : 0;
  const grouped = [...groups.values()].map((g) => {
    const a = [...g.values()];
    return Object.fromEntries(
      [
        "centeredScore",
        "coverage",
        "observedCoverage",
        "statisticalCount",
        "lower",
        "upper",
      ].map((k) => [k, mean(a, k)]),
    );
  });
  const coverage = mean(grouped, "coverage");
  const observedCoverage = mean(grouped, "observedCoverage");
  const eligible =
    grouped.length > 0 &&
    observedCoverage >= 35 &&
    mean(grouped, "statisticalCount") >= 2;
  return {
    score: eligible ? Math.round(mean(grouped, "centeredScore")) : null,
    coverage: Math.round(coverage),
    observedCoverage: Math.round(observedCoverage),
    roleCount: roles.length,
    scoredRoles: ready.length,
    evidenceGroups: grouped.filter((g) => g.observedCoverage > 0).length,
    totalGroups: groups.size,
    lower: eligible ? Math.round(mean(grouped, "lower")) : null,
    upper: eligible ? Math.round(mean(grouped, "upper")) : null,
  };
}
export function freshness(source, now = Date.now()) {
  if (!source?.value) return { label: "暂无数据", tone: "warn" };
  const time = Date.parse(source.lastSuccess),
    days = (now - time) / 86400000;
  if (!Number.isFinite(time) || days < -1)
    return { label: "获取时间待核实", tone: "warn" };
  if (
    ["cached", "error", "stale", "unavailable"].includes(source.status) ||
    days > 8
  )
    return {
      label: source.status === "cached" ? "沿用快照" : "待刷新",
      tone: "warn",
    };
  return { label: "采集正常", tone: "ok" };
}
