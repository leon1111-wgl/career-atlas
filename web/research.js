/** Shared knowledge selection: analytical pages and the advisor use the same records. */
export function majorEvidence(outcomes, majorId, region) {
  return (outcomes?.groups || []).filter(
    (g) => g.region === region && g.majorIds.includes(majorId),
  );
}
export function relevantPolicies(
  policies,
  region,
  industryId,
  now = Date.now(),
) {
  return (policies?.items || [])
    .filter(
      (p) =>
        p.region === region &&
        (!industryId || p.industryIds.includes(industryId)) &&
        p.status !== "待核实" &&
        Number.isFinite(Date.parse(p.publishedAt)) &&
        Date.parse(p.publishedAt) <= now &&
        p.verifiedAt,
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
const flatten = (x) =>
  Array.isArray(x)
    ? x.map(flatten).join("；")
    : x && typeof x === "object"
      ? Object.values(x).map(flatten).join("；")
      : String(x ?? "");
export function knowledgeDocuments(knowledge, catalog, region) {
  const { research, outcomes, policies, recruitment } = knowledge || {};
  const docs = [];
  for (const m of research?.majors || []) {
    const base = catalog.majors.find((x) => x.id === m.id);
    docs.push({
      id: `guide:${m.id}`,
      title: `${base?.name || m.id} 深入职业路径`,
      region,
      kind: "major-guide",
      url: `#major=${m.id}`,
      text: `专业研究建议：${m.summary}\n基础能力：${flatten(m.foundations)}\n方向：${m.routes.map((r) => `${r.title}；进入要求：${r.entry}；发展：${r.progression}；验证：${r.proof}；代价：${r.tradeoff}`).join("\n")}\n学历选择：${flatten(m.degreeDecisions)}\n常见误区：${flatten(m.pitfalls)}。这些为编辑研究，不是毕业生就业率。`,
    });
  }
  for (const i of research?.industries || []) {
    const base = catalog.industries.find((x) => x.id === i.id);
    docs.push({
      id: `research:${i.id}`,
      title: `${base?.name || i.id} 公司经营与趋势`,
      region,
      kind: "industry-research",
      url: `#industry=${i.id}`,
      text: `研究分析：${i.profitPool}。公司核对：${flatten(i.companyChecks)}。领先观察：${flatten(i.leadingSignals)}。需要下调预期的信号：${flatten(i.weakSignals)}。不代表已观测到这些变化。`,
    });
  }
  for (const g of outcomes?.groups || [])
    if (g.region === region) {
      docs.push({
        id: `outcome:${g.id}`,
        title: `${g.title} ${g.metric || "毕业去向资料"}`,
        region,
        kind: "graduate-fact",
        url: g.source.url,
        text: [
          `统计期：${g.period}；指标：${g.metric || "毕业去向分布"}。`,
          `样本范围：${g.population}`,
          ...g.rows.map(
            (r) =>
              `去向数据：${r.occupationZh || r.occupation}${typeof r.share === "number" ? "为" + r.share + "%" : "原文未给出数值"}。`,
          ),
          ...(g.degreeStats
            ? [
                `学历背景：拥有更高学位者${g.degreeStats.advancedDegreeShare}%；从事通常至少要求学士学历职业者${g.degreeStats.bachelorsRequiredOccupationShare}%，不是专业对口率或读研必要性的结论。`,
              ]
            : []),
          ...g.limitations.map((x) => `使用限制：${x}`),
          `来源：${g.source.title}。`,
        ].join("\n"),
      });
    }
  for (const p of relevantPolicies(policies, region)) {
    docs.push({
      id: `policy:${p.id}`,
      title: p.title,
      region,
      kind: "policy-fact",
      url: p.url,
      text: `发布：${p.publishedAt}；文件状态：${p.status}；最近核对：${p.verifiedAt}。\n原文概要：${p.summary}。\n岗位传导（研究判断）：${p.opportunities.join("；")}。\n落地条件：${p.constraints.join("；")}。政策支持不等于企业已增加招聘。`,
    });
  }
  for (const r of recruitment?.records || []) {
    if (
      r.region !== region ||
      !r.verifiedAt ||
      r.evidenceKind !== "job_requirement"
    )
      continue;
    docs.push({
      id: `recruitment:${r.id}`,
      title: `${r.employer} · ${r.title}`,
      region,
      kind: "recruitment-fact",
      url: r.source.url,
      text: [
        `公告条件：${r.degreeRequirement}；专业要求：${r.majorRequirement}`,
        `适用范围：${r.population}；${r.cohort}`,
        `院校条件：${r.schoolRequirement}`,
        ...r.conditions.map((c) => `其他条件：${c}`),
        `海外学历：${r.overseasRequirement}`,
        `时效：发布于${r.source.publishedAt || "日期未披露"}；${r.applicationStatus === "past_stated_deadline" ? "已过本公告报名截止，仅为历史条件样本" : "投递前需重新核对开放状态"}。`,
        `使用限制：${r.limitations.join("；")}`,
      ].join("\n"),
    });
  }
  if (region === "CN")
    docs.push({
      id: "method:recruitment-evidence",
      title: "招聘条件与录用难度的数据边界",
      region,
      kind: "method",
      url: "#sources",
      text: "公开招聘学历与专业要求仅能核对具名岗位的申请条件。当前没有同岗位同批次按985、211、双非一本、双非二本或海外背景分组的有效申请与实际录用人数，不能估计录用难度或学校优势。一本二本需记录招生省份与年份，海外背景需区分学校、国家、学位、专业与学习方式；排名不直接加分。尚无可比实际工时样本，工作强度不参与数值排序。不同学校的毕业去向比例不能替代雇主的申请—录用漏斗。",
    });
  return docs;
}
export function roleOutcomes(outcomes, role, region) {
  if (!role.soc || region !== "US") return [];
  return (outcomes?.groups || [])
    .filter((g) => g.region === region)
    .flatMap((g) =>
      g.rows
        .filter((r) => r.soc === role.soc)
        .map((r) => ({ group: g, row: r })),
    );
}

export function selectGraduateGroups(outcomes, question, region, majorId) {
  let groups = (outcomes?.groups || []).filter((g) => g.region === region);
  const schools = [
    ...(outcomes?.groups || [])
      .filter((g) => g.school?.name && g.school?.domain)
      .map((g) => ({
        names: [g.school.name, ...(g.school.aliases || [])],
        domain: g.school.domain,
      })),
    { pattern: /西安电子科技大学|西电/, domain: "xidian.edu.cn" },
    {
      pattern: /华中科技大学|华科|中欧(?:清洁与可再生)?能源学院/,
      domain: "hust.edu.cn",
    },
    { pattern: /上海商学院/, domain: "sbs.edu.cn" },
  ];
  const school = schools.find((s) =>
    s.pattern
      ? s.pattern.test(question)
      : s.names.some((n) => question.includes(n)),
  );
  if (school)
    groups = groups.filter((g) => {
      try {
        const h = new URL(g.source.url).hostname;
        return h === school.domain || h.endsWith("." + school.domain);
      } catch {
        return false;
      }
    });
  else if (/大学|学院|university|college/i.test(question)) return [];
  if (majorId) groups = groups.filter((g) => g.majorIds.includes(majorId));
  const levels = [];
  if (/博士/.test(question)) levels.push("doctorate");
  if (/硕士/.test(question)) levels.push("master");
  if (/本科/.test(question) && region === "CN") levels.push("bachelor");
  if (!levels.length && /研究生/.test(question))
    levels.push("master", "doctorate");
  if (levels.length)
    groups = groups.filter((g) => levels.includes(g.educationLevel));
  if (/行业/.test(question))
    groups = groups.filter(
      (g) =>
        g.groupType === "industry" || g.dataKind === "industry_distribution",
    );
  if (school || majorId || levels.length > 1) return groups;
  // Broad report questions show different sources, never three majors from the first school.
  const unique = new Map();
  for (const g of groups
    .slice()
    .sort((a, b) =>
      (b.source.publishedAt || b.source.modifiedAt || "").localeCompare(
        a.source.publishedAt || a.source.modifiedAt || "",
      ),
    ))
    if (!unique.has(g.source.url)) unique.set(g.source.url, g);
  return [...unique.values()].slice(0, 3);
}

export function resolveMajor(catalog, question) {
  const found = (catalog?.majors || [])
    .flatMap((m) =>
      [m.name, ...m.name.split("与"), ...(m.directions || [])].flatMap(
        (term) => {
          const stem = term.replace(/类$/, "");
          return [
            stem,
            ...(stem.length > 2 ? [stem.replace(/学$/, "")] : []),
          ].map((term) => ({ major: m, term }));
        },
      ),
    )
    .filter(
      (x) =>
        x.term.length >= 2 &&
        question.includes(x.term) &&
        !(x.term === "统计" && !/统计学|统计专业|学统计/.test(question)),
    );
  return found.sort((a, b) => b.term.length - a.term.length)[0]?.major || null;
}
