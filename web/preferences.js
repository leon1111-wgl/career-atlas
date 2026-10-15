import { scoreRole } from "./scoring.js?v=20261016-data";

/**
 * Preference ordering is lexicographic, never an employment-success score.
 * Only pay currently has comparable numerical observations. Workload, stability,
 * and entry difficulty remain unknown: prose, editorial grades, school tiers and
 * overseas study do not supply measurements. Unknown criteria do not break ties.
 * An optional major is a catalog association, not evidence of hiring eligibility.
 * Same wage categories stay tied; no exploration index breaks those ties.
 */
const labels = Object.freeze({
  pay: "薪酬背景",
  balance: "工时与繁忙程度",
  stability: "就业稳定性",
  access: "进入难度",
});
const missingReasons = Object.freeze({
  balance:
    "尚无按岗位和地区统计的可比实际工时、加班及业务负荷样本；不从轮班、夜班等文字推算强度。",
  stability:
    "尚无同口径离职、裁撤、合同续约或收入波动样本；不从单位性质或岗位文字推断稳定程度。",
  access:
    "尚无同口径申请人数、录用人数、考试竞争或入职背景样本；现有研究量规不作为准入难度。",
});

/** Explicit priorities override the old single priority, including an empty array.
 * Legacy access retains its requested topic (currently unmeasured); moat, ai and
 * balanced do not silently become unrelated new preferences. Default: no priority.
 */
export function normalizePreferences(prefs = {}) {
  const input = prefs && typeof prefs === "object" ? prefs : {};
  const major = typeof input.major === "string" ? input.major.trim() : "";
  const requested = Array.isArray(input.priorities)
    ? input.priorities
    : Object.hasOwn(labels, input.priority)
      ? [input.priority]
      : [];
  const priorities = [
    ...new Set(
      requested.filter(
        (id) => typeof id === "string" && Object.hasOwn(labels, id),
      ),
    ),
  ].slice(0, 3);
  return { major, priorities };
}

function payCriterion(role, industry, region, data, now) {
  const result = scoreRole(role, industry, region, data, now);
  const value = result.dimensions.find((d) => d.key === "pay")?.value ?? null;
  const obs = result.observation;
  if (value === null) {
    return {
      id: "pay",
      label: labels.pay,
      value: null,
      kind: "统计背景",
      missing: true,
      display: "薪酬依据不足",
      reason: `没有可用于排序的${region === "CN" ? "中国大陆同口径行业工资" : "美国详细职业中位数"}。${result.issues.join("；")} 不用另一地区数据或研究判断填补。`,
    };
  }
  const wage = region === "CN" ? obs.record.wage : obs.record.medianWage;
  const amount = wage.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  const reason =
    region === "CN"
      ? `${obs.wageYear}年“${industry.cnWageIndustry}”城镇私营单位行业年平均工资，与同口径全国基准比较；共用门类的岗位并列，不是具体岗位或应届起薪。`
      : `${obs.wageYear}年美国SOC ${role.soc}职业年薪中位数，与美国同口径全国基准比较；是广义职业背景，不是个人或应届报价。`;
  return {
    id: "pay",
    label: labels.pay,
    value,
    kind: "统计背景",
    missing: false,
    display: `${amount} ${region === "CN" ? "元/年 · 行业均薪" : "美元/年 · 职业中位数"}`,
    reason,
  };
}

/** Returns only interpretable criteria, not a combined numeric fit score.
 * activePriorities lists criteria with numerical evidence for this role, rather
 * than promising that the criterion distinguishes every pair of roles.
 */
export function preferenceAssessment(
  role,
  industry,
  region,
  data,
  prefs = {},
  now = Date.now(),
) {
  if (!["CN", "US"].includes(region))
    throw new RangeError("region must be CN or US");
  const preferences = normalizePreferences(prefs);
  const majorMatch = preferences.major
    ? (role.majors || []).includes(preferences.major)
    : null;
  const criteria = preferences.priorities.map((id) =>
    id === "pay"
      ? payCriterion(role, industry, region, data, now)
      : {
          id,
          label: labels[id],
          value: null,
          kind: "未测量",
          missing: true,
          display: "暂无可比数据",
          reason: missingReasons[id],
        },
  );
  return {
    roleId: role.id,
    majorMatch,
    criteria,
    activePriorities: criteria.filter((c) => !c.missing).map((c) => c.id),
    inactivePriorities: criteria.filter((c) => c.missing).map((c) => c.id),
    majorReason: preferences.major
      ? "仅按目录记录的专业背景关联优先展示，不代表满足招聘或执业资格。"
      : "未限定专业背景。",
    preferences,
  };
}

/** Returns [{role, industry, assessment, rank}]. Shared ranks indicate ties.
 * Missing pay follows observed pay, indicating insufficient evidence, not a
 * lower measured wage. Fully unmeasured criteria preserve catalog order.
 */
export function rankPreferredRoles(
  catalog,
  region,
  data,
  prefs = {},
  now = Date.now(),
) {
  if (!["CN", "US"].includes(region))
    throw new RangeError("region must be CN or US");
  const preferences = normalizePreferences(prefs);
  const industries = new Map((catalog.industries || []).map((i) => [i.id, i]));
  const entries = (catalog.roles || []).map((role, index) => {
    const industry = industries.get(role.industryId);
    return {
      role,
      industry,
      assessment: preferenceAssessment(
        role,
        industry,
        region,
        data,
        preferences,
        now,
      ),
      index,
    };
  });
  const compare = (a, b) => {
    if (
      preferences.major &&
      a.assessment.majorMatch !== b.assessment.majorMatch
    )
      return a.assessment.majorMatch ? -1 : 1;
    for (let i = 0; i < preferences.priorities.length; i++) {
      const left = a.assessment.criteria[i],
        right = b.assessment.criteria[i];
      if (left.missing !== right.missing) return left.missing ? 1 : -1;
      if (!left.missing && left.value !== right.value)
        return right.value - left.value;
    }
    return 0;
  };
  entries.sort((a, b) => compare(a, b) || a.index - b.index);
  let rank = 1;
  return entries.map((entry, index) => {
    if (index && compare(entries[index - 1], entry) !== 0) rank = index + 1;
    const { role, industry, assessment } = entry;
    return { role, industry, assessment, rank };
  });
}
