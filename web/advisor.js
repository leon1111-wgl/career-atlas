import { classifyIntent, intentLabels } from "./intent.js";
import { buildDocuments, retrieve } from "./retrieval.js";

/** A trained router chooses a reading order. All answer content remains attributed catalog data. */
export function advise(question, catalog, data, region, model) {
  const classification = classifyIntent(question, model);
  const docs = buildDocuments(catalog, data, region);
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
  let intent = classification.intent;
  if (intent === "general" && /公司|雇主|企业类型/.test(question))
    intent = "company";
  if (publicQuestion) {
    intent = "public";
    evidence = docs.filter((d) => d.kind === "public-path");
    for (const path of catalog.publicPaths.filter((p) => p.region === region))
      section(path.title, [path.summary, ...path.checks], `public:${path.id}`);
  } else if (macro && region === "CN") {
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
    /专业.*(行业|方向|做什么|岗位)/.test(question)
  ) {
    intent = "fit";
    const namedMajor = catalog.majors.find((m) =>
      [m.name, ...m.name.split("与"), ...(m.directions || [])].some((term) => {
        let plain = term.replace(/类$/, "");
        if (plain.length > 2) plain = plain.replace(/学$/, "");
        return plain.length >= 2 && question.includes(plain);
      }),
    );
    const major = namedMajor ? include(`major:${namedMajor.id}`) : null;
    if (major) section(major.title, [major.text], major.id);
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
