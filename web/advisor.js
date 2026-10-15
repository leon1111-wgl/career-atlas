import {
  majorEvidence,
  relevantPolicies,
  selectGraduateGroups,
  resolveMajor,
} from "./research.js?v=20261016-data";
import { classifyIntent, intentLabels } from "./intent.js?v=20261016-data";
import { buildDocuments, retrieve } from "./retrieval.js?v=20261016-data";

/** A trained router chooses a reading order. All answer content remains attributed catalog data. */
export function advise(question, catalog, data, region, model, knowledge = {}) {
  const classification = classifyIntent(question, model);
  const docs = buildDocuments(catalog, data, region, knowledge);
  let evidence = retrieve(question, docs, 5);
  const roles = evidence
    .filter((d) => d.kind === "role")
    .slice(0, 2)
    .map((d) => catalog.roles.find((r) => d.id === `role:${r.id}`))
    .filter(Boolean);
  const sections = [];
  const include = (id) => {
    const doc = docs.find((d) => d.id === id);
    if (doc && !evidence.some((d) => d.id === id)) evidence.push(doc);
    return doc;
  };
  const section = (title, items, id) => {
    if (items?.length)
      sections.push({ title, items: items.filter(Boolean), source: id });
  };
  // Exact comparison and compensation requests cannot be hidden by a single-label misroute.
  const salary = /工资|薪酬|薪资|年薪|月薪|收入|待遇/.test(question);
  const comparing = /区别|比较|对比|差别|取舍/.test(question);
  const publicQuestion = /考公|公务员|事业单位|公共部门|联邦岗位/.test(
    question,
  );
  const macro = /GDP|cpi|失业率|工业增加值|消费品零售|经济数据|宏观/i.test(
    question,
  );
  const namedMajor = resolveMajor(catalog, question);
  const namedIndustry = catalog.industries
    .filter((i) =>
      [i.name, ...i.name.split(/[与、]/)].some(
        (t) => t.length >= 2 && question.includes(t),
      ),
    )
    .sort((a, b) => b.name.length - a.name.length)[0];
  const policyQuestion = /政策|国家支持|国家扶持|政府支持|补贴|行动计划/.test(
    question,
  );
  const destinationQuestion =
    /毕业.*(去向|就业|去哪)|就业报告|去向数据|职业分布/.test(question) ||
    (/(?:大学|学院|西电|华科)/.test(question) &&
      /就业|行业|升学|毕业/.test(question));
  let intent = classification.intent;
  if (intent === "general" && /公司|雇主|企业类型/.test(question))
    intent = "company";
  if (/指数|指标覆盖|统计依据|评分|分数|怎么打分|推荐算法/.test(question)) {
    const doc = include("method:scope");
    section("推荐依据与分数", [doc.text], doc.id);
    intent = "general";
  } else if (policyQuestion) {
    intent = "prospects";
    const industryId =
      namedIndustry?.id ||
      (/\bAI\b|人工智能|智能体/i.test(question) ? "ai" : undefined);
    let items = relevantPolicies(knowledge.policies, region, industryId);
    if (namedMajor) {
      const industries = new Set(
        namedMajor.roleIds.map(
          (id) => catalog.roles.find((r) => r.id === id)?.industryId,
        ),
      );
      items = items.filter((p) =>
        p.industryIds.some((id) => industries.has(id)),
      );
    }
    for (const p of items.slice(0, 3)) {
      include(`policy:${p.id}`);
      section(
        `${p.title} · ${p.publishedAt}`,
        [
          p.summary,
          ...p.opportunities.map((x) => `岗位影响分析：${x}`),
          ...p.constraints.map((x) => `落地条件：${x}`),
        ],
        `policy:${p.id}`,
      );
    }
    if (!sections.length)
      section(
        "政策资料",
        ["当前地区尚未纳入与此问题匹配的已核对政策；请补充行业名称。"],
        null,
      );
  } else if (
    /985|211|双非|一本|二本|海归|留学生|海外院校|招聘条件|准入|录用难度/.test(
      question,
    ) &&
    region === "CN"
  ) {
    intent = "entry";
    const method = include("method:recruitment-evidence");
    if (method) section(method.title, [method.text], method.id);
    const records = (knowledge.recruitment?.records || []).filter(
      (r) =>
        r.region === region &&
        (question.includes(r.employer) ||
          (/建行|建设银行/.test(question) &&
            r.employerGroup === "中国建设银行集团")),
    );
    for (const r of records.slice(0, 3)) {
      const d = include(`recruitment:${r.id}`);
      if (d) section(d.title, [d.text], d.id);
    }
  } else if (destinationQuestion) {
    intent = "prospects";
    const groups = selectGraduateGroups(
      knowledge.outcomes,
      question,
      region,
      namedMajor?.id,
    );
    for (const g of groups) {
      const d = include(`outcome:${g.id}`);
      if (d) section(d.title, [d.text], d.id);
    }
    if (!groups.length)
      section(
        "毕业去向资料",
        [
          namedMajor
            ? `${namedMajor.name}目前没有已接入的${region === "CN" ? "中国大陆" : "美国"}同口径去向统计，不从其他国家或专业推算。`
            : "尚未纳入与这所学校或所问范围匹配的去向统计。请核对学校、学历或专业范围。",
        ],
        null,
      );
    if (namedMajor) {
      const guide = knowledge.research?.majors?.find(
        (m) => m.id === namedMajor.id,
      );
      if (guide) {
        include(`guide:${guide.id}`);
        section(
          "可进一步核对的职业路径",
          guide.routes.map((r) => `${r.title}：${r.entry}`),
          `guide:${guide.id}`,
        );
      }
    }
  } else if (publicQuestion) {
    intent = "public";
    evidence = docs.filter((d) => d.kind === "public-path");
    for (const path of catalog.publicPaths.filter((p) => p.region === region))
      section(path.title, [path.summary, ...path.checks], `public:${path.id}`);
  } else if (macro) {
    evidence = retrieve(
      question,
      docs.filter((d) => d.kind === "macro-fact"),
      5,
    );
    for (const doc of evidence) section(doc.title, [doc.text], doc.id);
    intent = "prospects";
  } else if (salary && roles.length) {
    intent = "salary";
    for (const role of roles) {
      const id = `fact:${region === "CN" ? role.industryId : role.id}`;
      const fact = include(id);
      if (fact && !sections.some((s) => s.source === id))
        section(fact.title, [fact.text], id);
    }
  } else if (
    classification.intent === "fit" ||
    (namedMajor && /读研|硕士|博士|学历|毕业|专业|出路|方向/.test(question)) ||
    /专业.*(行业|方向|做什么|岗位)/.test(question)
  ) {
    intent = "fit";
    const major = namedMajor ? include(`major:${namedMajor.id}`) : null;
    if (major) section(major.title, [major.text], major.id);
    const guide =
      namedMajor &&
      knowledge.research?.majors?.find((m) => m.id === namedMajor.id);
    if (guide) {
      include(`guide:${guide.id}`);
      section(
        "职业方向与发展",
        guide.routes.map(
          (r) =>
            `${r.title}：${r.entry}；发展重点：${r.progression}；取舍：${r.tradeoff}`,
        ),
        `guide:${guide.id}`,
      );
      section("学历与投入怎么取舍", guide.degreeDecisions, `guide:${guide.id}`);
      for (const g of majorEvidence(knowledge.outcomes, guide.id, region)) {
        const d = include(`outcome:${g.id}`);
        if (d) section(d.title, [d.text], d.id);
      }
    }
    const fitRoles = namedMajor
      ? namedMajor.roleIds
          .slice(0, 2)
          .map((id) => catalog.roles.find((r) => r.id === id))
          .filter(Boolean)
      : roles;
    for (const role of fitRoles) {
      include(`role:${role.id}`);
      section(
        role.title,
        [
          role.regions?.[region]?.entry || role.entry,
          `资格核对：${role.regions?.[region]?.credential || role.education}`,
          role.portfolio,
        ],
        `role:${role.id}`,
      );
    }
  } else if (roles.length) {
    if (comparing && roles.length >= 2) intent = "compare";
    for (const role of roles.slice(0, intent === "compare" ? 2 : 1)) {
      const reality = role.jobReality;
      const local = role.regions?.[region];
      const id = `role:${role.id}`;
      if (intent === "company") {
        const analysis = include(`research:${role.industryId}`);
        if (analysis && !sections.some((s) => s.source === analysis.id))
          section(analysis.title, [analysis.text], analysis.id);
        section(
          `${role.title} · 不同公司里的工作`,
          reality?.companyTypes?.map(
            (t) => `${t.type}：${t.work} ${t.tradeoff}`,
          ),
          id,
        );
      } else if (intent === "prospects") {
        const industry = catalog.industries.find(
          (i) => i.id === role.industryId,
        );
        include(`industry:${industry.id}`);
        section(
          `${industry.name} · 需求与风险`,
          [...industry.drivers, ...industry.risks],
          `industry:${industry.id}`,
        );
        const analysis = include(`research:${industry.id}`);
        if (analysis) section(analysis.title, [analysis.text], analysis.id);
        for (const p of relevantPolicies(
          knowledge.policies,
          region,
          industry.id,
        ).slice(0, 2)) {
          const d = include(`policy:${p.id}`);
          if (d) section(d.title, [d.text], d.id);
        }
        section(
          `${role.title} · AI 影响`,
          [
            `可被工具覆盖：${role.ai.automated.join("；")}`,
            `需要判断与验证：${role.ai.complement.join("；")}`,
          ],
          id,
        );
      } else {
        section(
          role.title,
          [
            `主要交付：${(reality?.deliverables || role.daily).join("；")}`,
            ...(intent === "work"
              ? role.daily
              : [
                  `入门准备：${local?.entry || role.entry}`,
                  `资格核对：${local?.credential || role.education}`,
                  `试做项目：${role.portfolio}`,
                ]),
          ],
          id,
        );
      }
      if (intent === "company" || intent === "entry")
        section("面试前可以核对", reality?.interviewChecks, id);
    }
  }
  if (!sections.length)
    for (const doc of evidence.slice(0, 2))
      section(doc.title, [doc.text], doc.id);
  evidence = evidence.filter((d) => sections.some((s) => s.source === d.id));
  if (destinationQuestion)
    evidence.sort(
      (a, b) =>
        Number(b.kind === "graduate-fact") - Number(a.kind === "graduate-fact"),
    );
  if (policyQuestion)
    evidence.sort(
      (a, b) =>
        Number(b.kind === "policy-fact") - Number(a.kind === "policy-fact"),
    );
  return {
    intent,
    label: intentLabels[intent],
    classification,
    sections,
    evidence,
    note: sections.length
      ? "资料按问题整理；岗位实践建议为编辑研究，具体招聘条件请向用人单位核对。"
      : "暂未找到相关资料。请补充行业、专业或岗位名称。",
  };
}
