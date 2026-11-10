import { classifyIntent, intentLabels } from "./intent.js?v=20261110";
import { advise } from "./advisor.js?v=20261110";
import { majorEvidence } from "./research.js?v=20261110";

/**
 * 路线助手 (career route assistant), tier 1.
 *
 * A rule planner with no language model reads the question, resolves catalog entities, and writes a
 * plan of tool calls. Each tool is a pure function over the published catalog and statistics. Every
 * number in an answer is built from a typed fact that carries its source, statistical period and date;
 * free text never introduces a number of its own. What the data cannot answer is listed as a gap.
 */

export const GOAL_LABELS = Object.freeze({
  transfer: "转方向要补什么",
  destinations: "专业去向",
  stats: "官方统计",
  adjacent: "相邻岗位",
  industry: "行业里的岗位",
  compare: "岗位比较",
  entry: "入门与资格",
  public: "公共部门入口",
  legacy: "资料检索",
  gap: "数据回答不了",
  none: "需要补充信息",
});

const REGION_NAME = { CN: "中国大陆", US: "美国" };
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const day = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
const fmt = (n) => (finite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "");
const signed = (n) => (n > 0 ? `+${fmt(n)}` : fmt(n));

/* ---------- Vocabulary ---------- */

// Directions people name that are not catalog titles. Each maps to the closest catalog roles and says so.
const ROLE_ALIASES = [
  [/数据分析|商业分析|\bbi\b|做数据|搞数据/i, ["datascience", "statistician", "marketing"], "数据分析"],
  [/程序员|码农|写代码|软件开发|搞开发|做开发/, ["backend", "frontend"], "软件开发"],
  [/后端|服务端|后台开发|java/i, ["backend"], "后端"],
  [/前端|web\s*开发/i, ["frontend"], "前端"],
  [/软件测试|测试开发|测试工程|做测试|\bqa\b/i, ["qa"], "测试"],
  [/产品经理|做产品|\bpm\b/i, ["product"], "产品经理"],
  [/算法工程|算法岗|做算法|搞算法|深度学习|大模型/, ["mlengineer", "mlresearch"], "算法"],
  [/算法研究|机器学习研究|研究科学家/, ["mlresearch"], "算法研究"],
  [/智能体|\bagent\b|ai\s*应用|人工智能应用/i, ["agent"], "AI 应用"],
  [/运维|\bsre\b|站点可靠/i, ["sre"], "运维"],
  [/网络安全|信息安全|安全工程|渗透/, ["security"], "网络安全"],
  [/数据工程|数据平台|数仓/, ["dataengineer"], "数据工程"],
  [/电商运营|店铺运营/, ["ecommerce"], "电商运营"],
  [/新媒体|内容运营|自媒体/, ["content"], "内容运营"],
  [/人力资源|\bhr\b|人事|招聘专员/i, ["hr"], "人力资源"],
  [/法务/, ["lawyer"], "法务"],
  [/老师|教师/, ["teacher"], "教师"],
  [/医生|大夫/, ["physician"], "医生"],
  [/考公|公务员/, ["civilservice"], "公务员"],
  [/\bui\b|\bux\b|交互设计|用户体验/i, ["ux"], "交互设计"],
  [/平面设计|美工/, ["graphic"], "平面设计"],
  [/风控/, ["risk"], "风控"],
  [/投行|券商|证券分析/, [], "证券"],
  [/焊工/, ["welder"], "焊工"],
  [/护工|养老护理/, ["caregiver"], "养老护理"],
  [/护士/, ["nurse"], "护士"],
  [/飞行员|机长/, ["pilot"], "飞行员"],
  [/牙医/, ["dentist"], "牙医"],
  [/康复师/, ["rehab"], "康复师"],
  [/精算师/, ["actuary"], "精算师"],
  [/审计师/, ["auditor"], "审计师"],
  [/记者/, ["journalist"], "记者"],
  [/健身教练|私教/, ["fitness"], "健身教练"],
  [/建筑师/, ["architect"], "建筑师"],
  [/造价/, ["cost"], "造价"],
  [/社工/, ["socialwork"], "社工"],
  [/药剂师/, ["pharmacist"], "药剂师"],
  [/software (developer|engineer)s?/, ["backend", "frontend"], "software developer"],
  [/registered nurses?|\bnurses?\b/, ["nurse"], "registered nurse"],
  [/data scientists?/, ["datascience"], "data scientist"],
  [/accountants?\b/, ["accountant"], "accountant"],
  [/lawyers?\b|attorneys?\b/, ["lawyer"], "lawyer"],
  [/teachers?\b/, ["teacher"], "teacher"],
  [/electricians?\b/, ["electrician"], "electrician"],
  [/pharmacists?\b/, ["pharmacist"], "pharmacist"],
  [/civil engineers?/, ["civileng"], "civil engineer"],
  [/mechanical engineers?/, ["mechanical"], "mechanical engineer"],
  [/physical therapists?|physiotherapists?/, [], "physical therapist"],
];
// Halves of industry names that are too generic to name an industry on their own.
const GENERIC_INDUSTRY_TERMS = new Set(["数据", "设施", "内容", "品牌", "技术服务", "社会服务", "生活服务", "技能职业", "学习科技", "城市空间", "文娱"]);
const TITLE_SUFFIX = /(工程师|专业人员|技术人员|技能人员|技术员|专员|人员|分析员|分析师)$/;

const INDUSTRY_ALIASES = [
  [/新能源|光伏|风电|电网/, "power"],
  [/互联网|it行业|软件行业/i, "software"],
  [/人工智能|\bai\s*行业|大数据/i, "ai"],
  [/半导体|芯片|集成电路/, "chips"],
  [/汽车|整车|新能源车/, "mobility"],
  [/银行|证券|保险|金融/, "finance"],
  [/医院|医疗/, "health"],
  [/医药|制药|生物医药/, "pharma"],
  [/电商|零售/, "commerce"],
  [/物流|航空|快递/, "logistics"],
  [/教育|培训/, "education"],
  [/游戏|动画|设计行业/, "creative"],
  [/建筑|土木|基建/, "construction"],
  [/房地产|物业/, "property"],
  [/通信|5g/i, "telecom"],
  [/化工|材料/, "materials"],
  [/矿业|石油|油气/, "mining"],
  [/农业|林业|食品/, "agri"],
  [/酒店|餐饮|旅游/, "hospitality"],
  [/传媒|出版|新闻/, "media"],
  [/咨询|律所|会计师事务所/, "professional"],
];

// Employers the catalog never measures. A pay question about one is a gap, not a lookup.
const EMPLOYERS =
  /腾讯|阿里|字节|抖音|华为|百度|京东|美团|拼多多|网易|小米|比亚迪|宁德时代|国家电网|南方电网|中石油|中石化|工商银行|工行|建设银行|建行|招商银行|招行|中国银行|农业银行|中信|四大|德勤|普华永道|安永|毕马威|大厂|谷歌|google|微软|microsoft|苹果|apple|亚马逊|amazon|meta|特斯拉|tesla|英伟达|nvidia|中芯|大疆|蔚来|理想汽车|小鹏|这家公司|那家公司/i;

const PAY = /工资|薪资|薪酬|薪水|收入|待遇|年薪|月薪|挣多少|赚多少|多少钱|给多少|开多少|salary|salaries|\bearn|\bpay\b|wages?\b|income/i;

/* What the published data cannot support. Each gap names why and what does exist. */
export const GAP_RULES = [
  {
    id: "starting_salary",
    test: (q) => /起薪|应届.{0,8}(工资|薪|收入|待遇)|刚毕业.{0,8}(工资|薪|收入|挣|拿)|毕业.{0,3}(工资|薪|收入|挣)|毕业.{0,4}(第一年|头一年|一年后).{0,6}(工资|收入|挣|薪)|实习.{0,3}(工资|薪)|到手/.test(q),
    title: "应届起薪",
    why: "本站没有收录应届生起薪或到手工资。中国的数字是统计门类内全体城镇单位就业人员的年平均工资（行业均值）；美国是 BLS 职业年薪中位数（全体在职者）。两者都不是起薪。",
    instead: "起薪请以学校就业质量年度报告或用人单位公告原文为准；本站不从行业均值推算起薪。",
  },
  {
    id: "admission_odds",
    test: (q) => /录用(率|概率|几率|机会)|录取(率|概率|分)|分数线|上岸(率|概率|几率|机会)|概率有多大|能考上|考得上|考上的?(概率|几率)|能上.{0,8}吗|分能上|高考.{0,12}(能|可以)上|(能|可以)不能进|能进.{0,8}吗|进得去吗|进得了|好不好进|难不难进|好进吗|难进吗|(进|去).{0,8}难不难|几成|概率多大|多大(把握|机会|概率)|有没有希望|稳进/.test(q),
    title: "录用、录取或上岸概率",
    why: "本站没有招生分数线，也没有同岗位、同批次的申请人数与实际录用人数，无法估计任何人的录取、录用或上岸概率。",
    instead: "可以核对岗位的入门要求、资格条件和公告原文；公共部门看当年职位表。",
  },
  {
    id: "school_background",
    test: (q) => /985|211|双非|双一流|一本|二本|学校背景|学历歧视|名校|海归|留学生/.test(q),
    title: "院校背景的影响",
    why: "没有按院校层次分组的同岗位申请与录用样本，无法说明学校背景带来多大优势或劣势。",
    instead: "具名招聘公告里的学历与专业条件可以逐条核对；不同学校的毕业去向比例不能互相替代。",
  },
  {
    id: "working_hours",
    test: (q) => /加班|工时|996|累不累|辛苦吗|作息|几点下班|双休|周末休/.test(q),
    title: "工时与强度",
    why: "本站没有带样本说明的实际工时或加班统计，不用岗位描述推算工作强度。",
    instead: "面试时可以问值班、交付节奏和旺季安排；岗位页列出了面试核对问题。",
  },
  {
    id: "employer_pay",
    test: (q) => EMPLOYERS.test(q) && PAY.test(q),
    title: "具体雇主的薪酬",
    why: "本站不收集任何具体公司的薪酬数据，机构示例也不代表正在招聘。",
    instead: "可以看该岗位所属统计门类的行业均值（不是这家公司的数字），并以雇主公告或 offer 为准。",
  },
  {
    id: "prediction",
    test: (q) => /(三|五|十|3|5|10|几)年后|会是多少|会不会(上升|下降|涨|跌|变)|下半年|明年|后年|预计会|next year|in \d+ years|\bwill\b.{0,30}(earn|be|make)|未来.{0,6}(会不会|还会|能不能|怎么样|前景)|会不会被.{0,8}(取代|替代|淘汰)|会被.{0,6}(取代|替代|淘汰)吗|会不会消失|还有前途|没前途|夕阳|铁饭碗|稳定吗|饱和/.test(q),
    title: "未来走势与个人前景",
    why: "本站不预测某个岗位或某个人的未来。可用的只有已发布的统计；美国 BLS 十年就业预测是官方预测口径，中国没有同口径的职业预测。",
    instead: "可以看岗位页的 AI 分工说明（编辑研究，不是测算）和行业的需求与风险。",
  },
  {
    id: "personal_fit",
    test: (q) => /适合我|我适合|我适不适合|适不适合我|性格|mbti|内向|外向|天赋|我能做什么/i.test(q),
    title: "是否适合你",
    why: "本站不评估个人性格、能力或适合程度，也不做测评。",
    instead: "可以从专业的三条路线和岗位的试做项目里挑一个，用一次小项目或见习来验证兴趣。",
  },
  {
    id: "ranking",
    test: (q) => /(最|哪个|哪些).{0,4}(赚钱|好就业|吃香|热门|值钱|有前途|好找工作)|排名|排行|性价比最高/.test(q),
    title: "专业或岗位排名",
    why: "本站不按收入或就业把专业、岗位排名；中国行业均值与美国职业中位数口径不同，也不能混排。",
    instead: "可以分别查看某个行业的统计门类工资，或某个美国职业的中位数，并保留各自口径。",
  },
  {
    id: "city",
    test: (q) => /(北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|苏州|重庆|天津|一线城市|二线城市|老家|本地).{0,10}(工资|薪|收入|待遇|月薪|挣)/.test(q) || (/san francisco|new york|seattle|boston|chicago|los angeles|bay area/.test(q) && PAY.test(q)),
    title: "分城市的收入",
    why: "本站的工资统计都是全国口径：中国按统计门类，美国按职业（全美），没有分城市或分地区的数字。",
    instead: "可以看全国口径的数字及其年份；地方数据请查当地统计机构的发布。",
  },
  {
    id: "match_rate",
    test: (q) => /对口率|专业对口的比例|多少人.{0,6}对口/.test(q),
    title: "专业对口率",
    why: "已收录的毕业去向表报告的是落实率、就业率或职业分布，没有专业对口率。",
    instead: "可以看该专业已收录的去向表，并注意每张表的学校、届别和分母。",
  },
  {
    id: "further_study",
    test: (q) => /保研率|保研(的)?(比例|概率)|考研(成功率|上岸率|录取率|通过率)|读研(成功率|概率)/.test(q),
    title: "保研率与考研成功率",
    why: "已收录的高校报告只给出升学率（含国内外读研等），没有保研率、考研报考人数或录取率。",
    instead: "可以看该专业已收录表格里的升学率，并核对学校、届别与分母。",
  },
  {
    id: "time_to_job",
    test: (q) => /within \d+ months?|几个月内.{0,6}(找到|就业)|多久.{0,4}(能)?找到工作|毕业\s*\d+\s*个月/.test(q),
    title: "毕业后多久就业",
    why: "美国的表是在职学位持有者的职业分布，中国的表是学校公布的落实率等；都没有“毕业若干个月内就业”的比例。",
    instead: "可以看该专业已收录的去向表，并注意每张表的统计时点和人群。",
  },
];

/* ---------- Entity resolution ---------- */

const MAJOR_CONTEXT_BEFORE = /(学|读|念|主修|学的是|专业是|本科是|我是|读的|学的|念的|读的是|学了|读了)$/;
const MAJOR_CONTEXT_AFTER = /^(专业|类|系|学院|出身|毕业|的学生|本科|硕士|研究生|方向的?学生)/;
const TRANSFER = /转行|转型|转岗|转方向|转到|转去|转做|转成|跨专业|跨行|改行|换行|换到|跳到|想转|想去做|想去当|想做|想当|改做|转/;
// A role named as the visitor's current job ("现在做电商运营") is a starting point, not a target.
const CURRENT_JOB = /(现在做|现在是|目前是|目前做|在做|干了|做了|当了|从事|我是)[^，。,]{0,4}$/;
// Everyday names of majors that are not catalog names.
const MAJOR_ALIASES = [
  [/英语|日语|德语|法语|俄语|西班牙语|汉语言|外语|翻译专业|小语种/, "language"],
  [/软件工程|网络工程|信息安全|计算机/, "cs"],
  [/财务管理|税收学|会计/, "accounting"],
  [/工商管理|市场营销|电子商务专业/, "business"],
  [/视觉传达|环境设计|产品设计|美术/, "art"],
  [/社工|社会工作/, "sociology"],
  [/行政管理/, "publicadmin"],
  [/临床医学/, "medicine"],
  [/通信工程|微电子/, "electronics"],
  [/学前教育|小学教育|师范/, "education"],
  [/computer|software engineering/, "cs"],
  [/biology|life sciences?/, "bio"],
  [/business/, "business"],
  [/nursing/, "nursing"],
  [/accounting/, "accounting"],
  [/finance\b/, "finance"],
  [/economics/, "economics"],
  [/psychology/, "psychology"],
  [/mechanical engineering/, "mech"],
  [/electrical engineering/, "electrical"],
  [/civil engineering/, "civil"],
  [/chemistry/, "chem"],
  [/physics/, "physics"],
  [/mathematics|statistics/, "math"],
  [/journalism|communications/, "journalism"],
  [/architecture/, "architecture"],
  [/pharmacy/, "pharmacy"],
  [/public health/, "publichealth"],
];
// Name halves too vague to name a major without "学…/…专业" around them.
const MAJOR_VAGUE = new Set(["设计", "技能", "语言", "工商", "文学", "表演", "营养", "统计", "审计", "职业技术"]);
// Words that name a job someone holds; when one is not a catalog role the assistant says so.
const ROLE_NOUN = /[一-鿿A-Za-z]{1,8}?(工程师|设计师|分析师|规划师|架构师|策划|经理|专员|技术员|顾问|研究员|主播|博主|司机|网红|运营官)/g;

function majorTerms(catalog) {
  const out = [];
  for (const m of catalog.majors || []) {
    const named = new Set([m.name, ...m.name.split(/与|和/)]);
    for (const t of [...named]) {
      const stem = t.replace(/类$/, "");
      named.add(stem);
      if (stem.length > 2) named.add(stem.replace(/学$/, ""));
    }
    for (const t of named) if (t.length >= 2) out.push({ kind: "major", id: m.id, term: t, needsContext: MAJOR_VAGUE.has(t) });
    for (const t of m.directions || []) if (t.length >= 2 && !named.has(t)) out.push({ kind: "major", id: m.id, term: t, needsContext: true });
  }
  return out;
}
function roleTerms(catalog) {
  const out = [];
  for (const r of catalog.roles || []) {
    out.push({ kind: "role", id: r.id, term: r.title, exact: true });
    const stem = r.title.replace(TITLE_SUFFIX, "");
    if (stem !== r.title && stem.length >= 2) out.push({ kind: "role", id: r.id, term: stem });
    const stem2 = r.title.replace(/(师|员)$/, "");
    if (stem2 !== r.title && stem2.length >= 2 && stem2 !== stem) out.push({ kind: "role", id: r.id, term: stem2 });
  }
  return out;
}
function industryTerms(catalog) {
  const out = [];
  for (const i of catalog.industries || [])
    for (const t of new Set([i.name, ...i.name.split(/[与、]/)])) if (t.length >= 2 && !GENERIC_INDUSTRY_TERMS.has(t)) out.push({ kind: "industry", id: i.id, term: t });
  return out;
}
function literalSpans(q, entries) {
  const found = [];
  for (const e of entries) for (let at = q.indexOf(e.term); at >= 0; at = q.indexOf(e.term, at + 1)) found.push({ ...e, at, end: at + e.term.length });
  return found;
}
function patternSpans(lower, list, make) {
  const found = [];
  for (const entry of list) {
    const re = new RegExp(entry[0].source, entry[0].flags.includes("g") ? entry[0].flags : entry[0].flags + "g");
    for (const m of lower.matchAll(re)) found.push({ ...make(entry), at: m.index, end: m.index + m[0].length, term: m[0] });
  }
  return found;
}
const RANK = { role: 3, major: 2, industry: 1 };

/** Every candidate span competes; the longest wins, so "网络安全" beats "网络", "电力与新能源" beats "新能源". */
export function resolveEntities(question, catalog, extra = {}) {
  const q = String(question || "").slice(0, 500);
  const lower = q.toLowerCase();
  const candidates = [
    ...literalSpans(q, majorTerms(catalog)),
    ...patternSpans(lower, MAJOR_ALIASES, ([, id]) => ({ kind: "major", id, needsContext: false })),
    ...literalSpans(q, roleTerms(catalog)),
    ...patternSpans(lower, ROLE_ALIASES, ([, ids, label]) => ({ kind: "role", ids, approx: label })),
    ...literalSpans(q, industryTerms(catalog)),
    ...patternSpans(lower, INDUSTRY_ALIASES, ([, id]) => ({ kind: "industry", id, alias: true })),
  ];
  const context = (c) => MAJOR_CONTEXT_BEFORE.test(q.slice(Math.max(0, c.at - 4), c.at)) || MAJOR_CONTEXT_AFTER.test(q.slice(c.end, c.end + 5));
  for (const c of candidates) c.majorContext = c.kind === "major" && context(c);
  // A vague or direction-only major word counts only when phrased as a major ("学金融", "银行方向的学生").
  // "金融业", "教育行业": a major word followed by an industry word names the industry.
  const industryAfter = (c) => /^(业|行业|领域|公司|企业|单位)/.test(q.slice(c.end, c.end + 2));
  const usable = candidates.filter((c) => c.kind !== "major" || c.majorContext || (!c.needsContext && !industryAfter(c)));
  const score = (c) => (c.end - c.at) * 10 + (c.kind === "major" && c.majorContext ? 5 : 0) + RANK[c.kind] + (c.exact ? 1 : 0);
  usable.sort((a, b) => score(b) - score(a) || a.at - b.at);
  const kept = [];
  for (const c of usable) {
    const clash = kept.find((k) => c.at < k.end && k.at < c.end);
    if (!clash) kept.push(c);
    else if (clash.at === c.at && clash.end === c.end && clash.kind === c.kind && clash.kind !== "role") continue;
  }
  kept.sort((a, b) => a.at - b.at);
  const majors = [];
  const roles = [];
  const industries = [];
  for (const c of kept) {
    if (c.kind === "major" && !majors.some((x) => x.id === c.id)) majors.push({ id: c.id, at: c.at, term: c.term });
    if (c.kind === "industry" && !industries.some((x) => x.id === c.id)) industries.push({ id: c.id, at: c.at, term: c.term });
    if (c.kind === "role") {
      const ids = c.ids || [c.id];
      if (!ids.length) roles.push({ id: null, at: c.at, term: c.term, approx: c.approx });
      for (const id of ids) if (!roles.some((x) => x.id === id)) roles.push({ id, at: c.at, term: c.term, exact: !!c.exact, approx: c.approx || null });
    }
  }
  // Job nouns the catalog does not cover ("区块链工程师").
  const unknownRoles = [];
  for (const m of q.matchAll(ROLE_NOUN)) {
    const at = m.index;
    const end = at + m[0].length;
    if (!kept.some((k) => k.kind === "role" && k.at < end && at < k.end)) unknownRoles.push(m[0]);
  }
  let region = extra.region === "US" ? "US" : "CN";
  let regionFrom = "页面图层";
  if (/美国|\bus\b|u\.s\.|美利坚/i.test(q)) [region, regionFrom] = ["US", "问题中写明"];
  else if (/中国|国内|大陆/.test(q)) [region, regionFrom] = ["CN", "问题中写明"];
  const refersToPage = /这个专业|本专业|该专业|这专业|这门专业/.test(q);
  let contextMajor = null;
  if (refersToPage && extra.contextMajor && catalog.majors.some((x) => x.id === extra.contextMajor)) contextMajor = extra.contextMajor;
  return { majors, roles, industries, unknownRoles, region, regionFrom, contextMajor, refersToPage };
}

/* ---------- Tools (pure, data only) ---------- */

function makeContext(base) {
  const { catalog } = base;
  const role = (id) => catalog.roles.find((r) => r.id === id);
  const major = (id) => catalog.majors.find((m) => m.id === id);
  const industry = (id) => catalog.industries.find((i) => i.id === id);
  return { ...base, role, major, industry };
}

const CATALOG_SOURCE = (ctx) => ({
  key: "catalog",
  title: "向野职业目录（原创研究，非统计）",
  url: "#/data",
  date: ctx.catalog.reviewedAt || null,
  dateLabel: "目录复核",
  kind: "目录研究",
});
const RESEARCH_SOURCE = (ctx) => ({
  key: "research",
  title: "向野专业与行业研究（编辑研究，非统计）",
  url: "#/majors",
  date: ctx.research?.updatedAt || null,
  dateLabel: "研究更新",
  kind: "目录研究",
});
function statSource(s, fallbackTitle) {
  return {
    key: s?.url || fallbackTitle,
    title: s?.title || fallbackTitle,
    url: s?.url || "#/data",
    date: day(s?.lastSuccess) || day(s?.verifiedAt),
    dateLabel: s?.status === "cached" ? "沿用核验快照" : "最近成功采集",
    status: s?.status || "missing",
    kind: "官方统计",
  };
}

export const TOOLS = {
  major_routes(ctx, { majorId }) {
    const m = ctx.major(majorId);
    if (!m) return { ok: false, summary: "专业未找到" };
    const groups = new Map();
    for (const id of m.roleIds) {
      const r = ctx.role(id);
      if (!r) continue;
      if (!groups.has(r.industryId)) groups.set(r.industryId, []);
      groups.get(r.industryId).push(r);
    }
    const byIndustry = [...groups].map(([iid, roles]) => ({ industry: ctx.industry(iid), roles }));
    return {
      ok: true,
      summary: `${m.name}：目录关联 ${m.roleIds.length} 个岗位，分布在 ${byIndustry.length} 个行业`,
      major: m,
      byIndustry,
      source: CATALOG_SOURCE(ctx),
    };
  },
  major_guide(ctx, { majorId }) {
    const g = ctx.research?.majors?.find((x) => x.id === majorId);
    if (!g) return { ok: false, summary: "没有该专业的深入研究" };
    return { ok: true, summary: `${g.routes.length} 条职业路线，${g.foundations.length} 项课程基础`, guide: g, source: RESEARCH_SOURCE(ctx) };
  },
  graduate_outcomes(ctx, { majorId, region, school = null }) {
    let groups = majorEvidence(ctx.outcomes, majorId, region);
    if (school) groups = groups.filter((g) => schoolNames(g).some((n) => n === school));
    const sorted = groups
      .slice()
      .sort((a, b) => (b.sampleSize || 0) - (a.sampleSize || 0) || String(b.source?.publishedAt || "").localeCompare(String(a.source?.publishedAt || "")));
    return {
      ok: true,
      summary: (groups.length ? `${groups.length} 组${REGION_NAME[region]}官方去向表` : `没有${REGION_NAME[region]}的该专业去向表`) + (school ? `（只看${school}）` : ""),
      school,
      groups: sorted,
    };
  },
  wage_stat(ctx, { industryId, roleId, sectorName, region }) {
    if (region === "US") {
      const r = roleId ? ctx.role(roleId) : null;
      const s = ctx.data?.sources?.bls;
      const v = s?.value;
      const occ = r?.soc && v?.occupations?.[r.soc];
      if (!r) return { ok: false, summary: "美国职业统计需要具体岗位", missing: "美国统计按职业（SOC）发布，需要一个具体岗位。" };
      if (!occ || occ.type !== "Line item")
        return { ok: false, summary: `${r.title}没有详细 SOC 职业对应`, missing: `${r.title}在目录里没有对应的美国详细职业（SOC），不给数值，也不借用其他职业。` };
      const src = statSource(s, "BLS 职业就业预测");
      const facts = [];
      if (finite(occ.medianWage))
        facts.push({ label: `${v.wageYear} 年职业年薪中位数`, value: occ.medianWage, unit: "美元/年", prefix: occ.wageCensored ? "至少 " : "", period: `${v.wageYear} 年`, source: src });
      if (finite(occ.growth)) facts.push({ label: `${v.period} 就业变化预测`, value: occ.growth, unit: "%", period: v.period, source: src });
      if (finite(occ.openings)) facts.push({ label: "预测期年均岗位开放量（含替补需求）", value: occ.openings, unit: "个/年", period: v.period, source: src });
      return {
        ok: facts.length > 0,
        summary: `BLS SOC ${r.soc}（${occ.name}）：${facts.length} 个数值`,
        title: `${r.title} · 美国 SOC ${r.soc} ${occ.name}`,
        facts,
        caveats: [
          `SOC ${r.soc}（${occ.name}）是美国的广义职业，作为“${r.title}”的代理，不是中国数据，也不是该细分岗位的报价。`,
          "中位数覆盖全体在职者，不是应届工资；开放量包含退休与转岗形成的替补需求，不是当前空缺。",
        ],
        source: src,
      };
    }
    const ind = sectorName
      ? { id: null, name: `统计门类“${sectorName}”`, cnWageIndustry: sectorName }
      : ctx.industry(industryId || ctx.role(roleId)?.industryId);
    if (!ind) return { ok: false, summary: "中国工资统计需要一个行业或岗位", missing: "中国工资按统计门类发布，需要能对应到一个行业。" };
    const s = ctx.data?.sources?.["nbs-wages"];
    const v = s?.value;
    const sector = v?.sectors?.[ind.cnWageIndustry];
    if (!sector) return { ok: false, summary: `统计门类“${ind.cnWageIndustry}”没有工资数值`, missing: `统计门类“${ind.cnWageIndustry}”没有可用的工资数值，不估算。` };
    const src = statSource(s, "国家统计局：城镇单位行业工资");
    const facts = [];
    for (const [key, name] of [
      ["nonprivate", "城镇非私营单位"],
      ["private", "城镇私营单位"],
    ]) {
      const x = sector[key];
      if (finite(x?.wage)) facts.push({ label: `${x.year || v.year} 年${name}就业人员年平均工资`, value: x.wage, unit: "元/年", period: `${x.year || v.year} 年`, change: finite(x.growth) ? x.growth : null, source: src });
    }
    const missing = ["nonprivate", "private"].filter((k) => !finite(sector[k]?.wage)).map((k) => (k === "private" ? "私营单位" : "非私营单位"));
    const shared = ctx.catalog.industries.filter((i) => i.cnWageIndustry === ind.cnWageIndustry && i.id !== ind.id).map((i) => i.name);
    return {
      ok: facts.length > 0,
      summary: `国家统计局门类“${ind.cnWageIndustry}”：${facts.length} 个数值`,
      title: sectorName ? `统计门类“${sectorName}”工资` : `${ind.name} · 统计门类“${ind.cnWageIndustry}”工资`,
      facts,
      caveats: [
        "这是整个统计门类单位就业人员的年平均工资（行业均值），不是某个岗位、某家公司或应届生的工资。",
        ...(roleId ? [`“${ctx.role(roleId).title}”只用所属门类的均值作背景，岗位本身没有中国工资统计。`] : []),
        ...(shared.length ? [sectorName ? `目录里属于这个门类的行业：${shared.join("、")}，它们共用这个数。` : `同一统计门类也覆盖：${shared.join("、")}，它们共用这个数。`] : []),
        ...(missing.length ? [`${missing.join("、")}数据缺失，未补值。`] : []),
        "中国行业均值不能与美国职业中位数直接比较或换算。",
      ],
      source: src,
    };
  },
  macro_lookup(ctx, { ids, region }) {
    const facts = [];
    if (region === "CN") {
      const s = ctx.data?.sources?.["cn-current"];
      for (const item of s?.value?.indicators || [])
        if (!ids.length || ids.includes(item.id))
          facts.push({
            label: `${item.label}（${item.changeLabel}）`,
            value: item.value,
            unit: item.unit,
            period: item.period,
            source: { key: item.url, title: `国家统计局：${item.label}`, url: item.url, date: day(item.publishedAt), dateLabel: "发布", status: s.status, kind: "官方统计" },
          });
    } else {
      for (const [key, id, label, unit] of [
        ["fred-UNRATE", "unemployment", "美国失业率（季调，月度）", "%"],
        ["fred-PAYEMS", "payrolls", "美国非农就业人数（季调，月度）", "千人"],
      ]) {
        if (ids.length && !ids.includes(id)) continue;
        const s = ctx.data?.sources?.[key];
        const point = s?.value?.at?.(-1);
        if (point && finite(point.value))
          facts.push({ label, value: point.value, unit, period: point.date.slice(0, 7), source: statSource(s, label) });
      }
      // Annual World Bank series fill in what the monthly US feeds do not carry; the period says it is annual.
      for (const [key, id, label] of [
        ["wb-inflation", "cpi", "美国居民消费价格涨幅（世界银行，年度）"],
        ["wb-gdpGrowth", "gdp", "美国实际 GDP 增长（世界银行，年度）"],
      ]) {
        if (!ids.includes(id)) continue;
        const s = ctx.data?.sources?.[key];
        const point = s?.value?.US?.at?.(-1);
        if (point && finite(point.value))
          facts.push({ label, value: Math.round(point.value * 100) / 100, unit: "%", period: `${point.year} 年（年度）`, source: statSource(s, label) });
      }
    }
    return { ok: facts.length > 0, summary: `${facts.length} 个最新指标`, facts };
  },
  role_profile(ctx, { roleId, region }) {
    const r = ctx.role(roleId);
    if (!r) return { ok: false, summary: "岗位未找到" };
    return { ok: true, summary: `${r.title}：${r.skills.length} 项技能，入门与资格（${REGION_NAME[region]}）`, role: r, local: r.regions?.[region] || {}, source: CATALOG_SOURCE(ctx) };
  },
  skill_gap(ctx, { fromMajor, fromRoles, toRole }) {
    const target = ctx.role(toRole);
    if (!target) return { ok: false, summary: "目标岗位未找到" };
    const guide = fromMajor ? ctx.research?.majors?.find((x) => x.id === fromMajor) : null;
    const sourceRoles = (fromRoles?.length ? fromRoles : ctx.major(fromMajor)?.roleIds || []).map(ctx.role).filter(Boolean);
    const background = [
      ...(guide?.foundations || []).map((t) => ({ text: t, from: "专业课程基础" })),
      ...sourceRoles.flatMap((r) => r.skills.map((t) => ({ text: t, from: r.title }))),
    ];
    const rows = target.skills.map((skill) => {
      const hit = background.find((b) => overlaps(skill, b.text));
      return { skill, have: hit || null };
    });
    return {
      ok: true,
      summary: `${target.title} ${rows.length} 项技能：${rows.filter((r) => r.have).length} 项在原背景里有相近内容`,
      target,
      rows,
      sourceRoles,
      source: CATALOG_SOURCE(ctx),
    };
  },
  adjacent_trail(ctx, { roleId, toRole }) {
    const r = ctx.role(roleId);
    if (!r) return { ok: false, summary: "岗位未找到" };
    if (toRole) {
      const path = shortestTrail(ctx, [roleId], toRole);
      return { ok: true, summary: path ? `目录相邻路线 ${path.length - 1} 步` : "目录里没有相邻路线", path, from: r, to: ctx.role(toRole) };
    }
    const out = (r.transition || []).map(ctx.role).filter(Boolean);
    const inbound = ctx.catalog.roles.filter((x) => (x.transition || []).includes(r.id) && !out.some((o) => o.id === x.id));
    const rows = [...out.map((x) => ({ role: x, dir: "out" })), ...inbound.map((x) => ({ role: x, dir: "in" }))].map((row) => ({
      ...row,
      sameIndustry: row.role.industryId === r.industryId,
      sharedMajors: row.role.majors.filter((m) => r.majors.includes(m)).map((m) => ctx.major(m)?.name).filter(Boolean),
      sharedSkills: row.role.skills.filter((s) => r.skills.some((t) => overlaps(s, t))),
    }));
    return { ok: true, summary: `${out.length} 个标注的相邻岗位，另有 ${inbound.length} 个岗位把它列为相邻`, role: r, rows, source: CATALOG_SOURCE(ctx) };
  },
  multi_trail(ctx, { fromRoles, toRole }) {
    const path = shortestTrail(ctx, fromRoles, toRole);
    return { ok: true, summary: path ? `目录相邻路线 ${path.length - 1} 步` : "目录里没有相邻路线", path: path?.map(ctx.role) || null, to: ctx.role(toRole) };
  },
  industry_map(ctx, { industryId, region }) {
    const ind = ctx.industry(industryId);
    if (!ind) return { ok: false, summary: "行业未找到" };
    const roles = ctx.catalog.roles.filter((r) => r.industryId === ind.id);
    return { ok: true, summary: `${ind.name}：${roles.length} 个岗位，${ind.chain.length} 段产业链`, industry: ind, roles, region, source: CATALOG_SOURCE(ctx) };
  },
  public_paths(ctx, { region }) {
    const paths = (ctx.catalog.publicPaths || []).filter((p) => p.region === region);
    return { ok: paths.length > 0, summary: `${paths.length} 条${REGION_NAME[region]}公共部门入口`, paths };
  },
  catalog_answer(ctx, { question, region, roleIds = [] }) {
    const r = advise(question, ctx.catalog, ctx.data, region, ctx.intentModel, {
      research: ctx.research,
      outcomes: ctx.outcomes,
      policies: ctx.policies,
      recruitment: ctx.recruitment,
    });
    // Off-target is worse than not found: drop role sections the question did not name.
    let dropped = 0;
    if (roleIds.length) {
      const keep = (s) => !/^role:/.test(s.source || "") || roleIds.includes(s.source.slice(5));
      dropped = r.sections.filter((s) => !keep(s)).length;
      r.sections = r.sections.filter(keep);
      r.evidence = r.evidence.filter((d) => r.sections.some((s) => s.source === d.id));
    }
    return {
      ok: r.sections.length > 0,
      summary: (r.sections.length ? `${r.sections.length} 段资料，${r.evidence.length} 条依据` : "没有找到足够相关的资料") + (dropped ? `；丢弃 ${dropped} 段与所问岗位无关的检索结果` : ""),
      result: r,
    };
  },
};

// Universities whose official reports are in the outcome tables, matched by the report's host.
const SCHOOLS = [
  { name: "上海商学院", pattern: /上海商学院/, host: "sbs.edu.cn" },
  { name: "华中科技大学", pattern: /华中科技大学|华科|中欧(清洁与可再生)?能源学院/, host: "hust.edu.cn" },
  { name: "西安电子科技大学", pattern: /西安电子科技大学|西电/, host: "xidian.edu.cn" },
  { name: "华东师范大学", pattern: /华东师范大学|华东师大|华师大/, host: "ecnu.edu.cn" },
  { name: "湖北师范大学", pattern: /湖北师范大学|湖北师大/, host: "hbnu.edu.cn" },
];
function schoolNames(g) {
  let host = "";
  try {
    host = new URL(g.source.url).hostname;
  } catch {}
  return SCHOOLS.filter((x) => host === x.host || host.endsWith("." + x.host)).map((x) => x.name);
}
/** A named university: the covered one it matches, or the uncovered name as written. */
export function findSchool(q) {
  const covered = SCHOOLS.find((x) => x.pattern.test(q));
  if (covered) return { name: covered.name, covered: true };
  const m = q.match(/[\u4e00-\u9fff]{2,10}?(大学|学院)/);
  if (!m || /^(大学|学院)$/.test(m[0])) return null;
  const name = m[0].replace(/^(我是|我在|我读|读完|读的|在读|在|从|上了|考上|考进)/, "");
  if (name.length < 4) return null;
  return { name, covered: false };
}

function bigrams(s) {
  const t = String(s).toLowerCase().replace(/[^a-z0-9㐀-鿿]/g, "");
  const out = new Set();
  for (const w of t.match(/[a-z0-9]+/g) || []) out.add(w);
  const han = t.replace(/[a-z0-9]+/g, " ");
  for (const block of han.split(" ")) for (let i = 0; i < block.length - 1; i++) out.add(block.slice(i, i + 2));
  return out;
}
const GENERIC = new Set(["分析", "能力", "基础", "核验", "资料", "表达", "协作", "清晰", "管理", "设计", "沟通", "证据", "数据", "业务", "流程", "项目", "工具", "记录", "解释", "评估"]);
/** Two skill phrases overlap when they share a Latin token or a non-generic Chinese bigram. */
export function overlaps(a, b) {
  const A = bigrams(a);
  for (const x of bigrams(b)) if (A.has(x) && !GENERIC.has(x)) return true;
  return false;
}
function shortestTrail(ctx, fromIds, toId) {
  const start = fromIds.filter((id) => ctx.role(id));
  if (!start.length || !ctx.role(toId)) return null;
  if (start.includes(toId)) return [toId];
  const prev = new Map(start.map((id) => [id, null]));
  let frontier = start;
  for (let depth = 0; depth < 3 && frontier.length; depth++) {
    const next = [];
    for (const id of frontier)
      for (const n of ctx.role(id)?.transition || [])
        if (!prev.has(n)) {
          prev.set(n, id);
          if (n === toId) {
            const path = [n];
            for (let p = id; p; p = prev.get(p)) path.unshift(p);
            return path;
          }
          next.push(n);
        }
    frontier = next;
  }
  return null;
}

/* ---------- Planner ---------- */

const CUES = {
  transfer: /补什么|补哪些|要补|需要补|还缺|差什么|缺什么|差哪些|差多少|差在哪|怎么转|转.{0,8}(要|需要|得)|能转|可以转.{0,6}吗|转得了|转行|转型|跨专业|改行|零基础转/,
  adjacent: /相邻|相近|接近|类似的(岗位|工作)|还能(转|做|去|干)|可以转(什么|哪)|能转(什么|哪)|转什么|跳到哪|换什么|换到哪|平移|横向|其他出路|退路|还有什么方向|还有哪些方向/,
  destinations: /去哪|去向|出路|方向|做什么工作|干什么|干啥|干嘛|能做什么|找什么工作|哪些行业|哪些岗位|什么岗位|什么行业|就业|毕业后|毕业以后|毕业了|以后做|work as|jobs?\b|careers?\b|get a job|majors?\b/i,
  industry: /岗位|职位|工作|做什么|干什么|产业链|上下游|有哪些(人|角色|工种)|招什么人|分工/,
  compare: /区别|比较|对比|哪个好|选哪个|差别|不同|还是/,
  entry: /入门|怎么进|进入|要求|资格|证书|执照|准备|学什么|门槛|零基础|条件|需要什么|考什么|怎么当|怎么成为/,
  stats: /统计|数据|官方/,
  macro: /gdp|cpi|物价|通胀|通货膨胀|inflation|失业率|unemployment rate|工业增加值|社会消费品|零售总额|非农|经济数据|宏观/i,
  publicPath: /考公|公务员(考试|招录|怎么考|要怎么)|事业单位|公共部门|公共岗位|政府(的)?岗位|联邦|州政府|地方政府|市政府|市里的|usajobs|government jobs?/i,
  roleDuty: /干什么的|做什么的|是干嘛的|职责|工作内容|对口|什么专业|哪些专业/,
  legacy: /考公|公务员|事业单位|公共部门|联邦岗位|政策|补贴|行动计划|国家支持|招聘条件|公告|公司类型|不同公司|什么样的公司|雇主类型|985|211|双非|一本|二本|海归|留学生/i,
  work: /每天|日常|平时.{0,4}(做|干)|具体做什么|具体干什么|工作内容/,
};
const MACRO_IDS = [
  [/gdp/i, "gdp"],
  [/cpi|物价|通胀|通货膨胀|inflation/i, "cpi"],
  [/失业率|unemployment/i, "unemployment"],
  [/工业增加值/, "industrial"],
  [/社会消费品|零售总额/, "retail"],
  [/非农/, "payrolls"],
];

export function plan(question, ctx, extra = {}) {
  const q = String(question || "").trim().slice(0, 500);
  const ent = resolveEntities(q, ctx.catalog, extra);
  // Cue words are read with entity names blanked out, so "数据" in 数据科学家 is not a request for statistics.
  let masked = q;
  for (const e of [...ent.majors, ...ent.roles, ...ent.industries]) masked = masked.slice(0, e.at) + "＿".repeat(e.term.length) + masked.slice(e.at + e.term.length);
  // Sector words ("公务员", "政策") are tested on the full question: they name the topic, not an entity.
  const cue = (name) => CUES[name].test(["publicPath", "legacy"].includes(name) ? q : masked);
  const classification = classifyIntent(q, ctx.intentModel);
  const gaps = GAP_RULES.filter((g) => g.test(q.toLowerCase())).map(({ test, ...g }) => g);
  const gapIds = new Set(gaps.map((g) => g.id));
  const region = ent.region;
  const knownRoles = ent.roles.filter((r) => r.id);
  const unknownAlias = ent.roles.find((r) => !r.id);
  const majorId = ent.majors[0]?.id || ent.contextMajor;
  const majorFrom = ent.majors[0] ? `问题中的“${ent.majors[0].term}”` : ent.contextMajor ? "当前页面" : null;
  const school = findSchool(q);
  const sectors = Object.keys(ctx.data?.sources?.["nbs-wages"]?.value?.sectors || {}).filter((name) => name !== "合计" && /业$/.test(name) && q.includes(name));
  const steps = [];
  const notes = [];
  let goal = null;
  // A starting-salary, employer or city pay question never gets a wage number: the gap explains why.
  const pay = PAY.test(q) && !gapIds.has("starting_salary") && !gapIds.has("employer_pay") && !gapIds.has("city");
  const step = (tool, args) => steps.push([tool, args]);
  const approxNote = (r, verb) => r.approx && notes.push(`“${r.term}”不是目录里的岗位名称，按最接近的“${ctx.role(r.id).title}”${verb}。`);
  if (unknownAlias && knownRoles.length) notes.push(`目录里没有“${unknownAlias.term}”这个岗位条目，下面只回答目录里有的岗位。`);

  // Where the visitor stands: a role named as the current job, else (without a major) a role before the transfer verb.
  const verb = masked.search(TRANSFER);
  const current = knownRoles.filter((r) => CURRENT_JOB.test(q.slice(Math.max(0, r.at - 8), r.at)));
  const sourceMajor = ent.majors.find((m) => verb < 0 || m.at < verb)?.id || ent.contextMajor;
  const sourceRoles = current.length ? current : !sourceMajor && verb >= 0 ? knownRoles.filter((r) => r.at < verb) : [];
  const targets = knownRoles.filter((r) => !sourceRoles.includes(r));
  const wantsTransfer = targets.length && (cue("transfer") || (verb >= 0 && (sourceMajor || sourceRoles.length)));

  if (ent.refersToPage && !ent.contextMajor && !ent.majors.length) {
    goal = "none";
    notes.push("问题提到“这个专业”，但当前页面不是专业页。请写出专业名称，或先打开一个专业页再问。");
  } else if (cue("macro")) {
    goal = "stats";
    step("macro_lookup", { ids: MACRO_IDS.filter(([p]) => p.test(q)).map(([, id]) => id), region });
  } else if ((unknownAlias || ent.unknownRoles.length) && !knownRoles.length && !majorId) {
    goal = "none";
    const name = unknownAlias?.term || ent.unknownRoles[0];
    notes.push(`目录里没有“${name}”这个岗位条目，不借用其他岗位作答。可以在“岗位”页按名称查找相近的条目。`);
  } else if (cue("adjacent") && knownRoles.length && !(wantsTransfer && (sourceMajor || sourceRoles.length))) {
    goal = "adjacent";
    step("adjacent_trail", { roleId: knownRoles[0].id });
    approxNote(knownRoles[0], "查找");
  } else if (wantsTransfer) {
    goal = "transfer";
    const tgt = targets.slice(0, 3);
    const fromRoles = sourceRoles.map((r) => r.id);
    const fromMajor = fromRoles.length ? null : sourceMajor;
    if (fromMajor) {
      step("major_routes", { majorId: fromMajor });
      step("major_guide", { majorId: fromMajor });
    }
    for (const t of tgt) step("skill_gap", { fromMajor, fromRoles, toRole: t.id });
    const startRoles = fromRoles.length ? fromRoles : ctx.major(fromMajor)?.roleIds || [];
    if (startRoles.length) step("multi_trail", { fromRoles: startRoles, toRole: tgt[0].id });
    for (const t of tgt) step("role_profile", { roleId: t.id, region });
    if (pay) step("wage_stat", { roleId: tgt[0].id, region });
    const approx = tgt.find((t) => t.approx);
    if (approx) notes.push(`目录里没有名为“${approx.term}”的岗位；按工作内容最接近的条目是：${tgt.filter((t) => t.approx === approx.approx).map((t) => ctx.role(t.id).title).join("、")}。`);
    if (!fromMajor && !fromRoles.length) notes.push("问题里没有写起点专业或岗位，下面只列目标岗位需要的技能；写上专业（例如“我学会计”）可以对照已有基础。");
  }
  const statTargets = knownRoles.length || ((ent.industries.length || sectors.length) && !majorId);
  const usOutlook = region === "US" && /预测|前景|增长|outlook|projection|growth/i.test(masked);
  if (!goal && statTargets && (pay || usOutlook || (cue("stats") && !cue("destinations") && !cue("legacy")))) {
    goal = "stats";
    if (knownRoles.length) for (const r of knownRoles.slice(0, 2)) step("wage_stat", { roleId: r.id, region });
    else if (region === "US") notes.push("美国统计按职业发布；请写出一个具体岗位。");
    else {
      const covered = new Set();
      for (const i of ent.industries.slice(0, 2)) {
        step("wage_stat", { industryId: i.id, region });
        covered.add(ctx.industry(i.id).cnWageIndustry);
      }
      for (const name of sectors.filter((n) => !covered.has(n)).slice(0, 2)) step("wage_stat", { sectorName: name, region });
    }
    if (knownRoles[0]) approxNote(knownRoles[0], "查找");
  }
  if (!goal && majorId && !knownRoles.length && (cue("destinations") || classification.intent === "fit" || ent.refersToPage || pay || gaps.some((g) => ["starting_salary", "match_rate", "further_study", "time_to_job"].includes(g.id)) || school)) {
    goal = "destinations";
    step("major_routes", { majorId });
    step("major_guide", { majorId });
    if (school && !school.covered) notes.push(`已收录的高校报告来自：${SCHOOLS.map((x) => x.name).join("、")}；没有${school.name}的报告，所以不列任何学校的去向数字，以免被当作${school.name}的结果。`);
    else step("graduate_outcomes", { majorId, region, school: school?.covered ? school.name : null });
    if (pay && region === "CN") {
      const m = ctx.major(majorId);
      for (const id of [...new Set(m.roleIds.map((r) => ctx.role(r)?.industryId).filter(Boolean))].slice(0, 3)) step("wage_stat", { industryId: id, region });
    }
  }
  if (!goal && ent.industries.length && !knownRoles.length && !majorId && cue("industry") && !cue("legacy") && !cue("publicPath")) {
    goal = "industry";
    step("industry_map", { industryId: ent.industries[0].id, region });
  }
  if (!goal && knownRoles.length >= 2 && cue("compare")) {
    goal = "compare";
    for (const r of knownRoles.slice(0, 2)) step("role_profile", { roleId: r.id, region });
  }
  const namedRole = knownRoles.find((r) => r.exact);
  if (!goal && cue("publicPath") && !namedRole) {
    goal = "public";
    step("public_paths", { region });
  }
  if (!goal && knownRoles.length && (cue("entry") || (namedRole && cue("roleDuty")) || (classification.intent === "entry" && !gaps.length)) && (!cue("legacy") || namedRole)) {
    goal = "entry";
    for (const r of knownRoles.slice(0, 2)) step("role_profile", { roleId: r.id, region });
    approxNote(knownRoles[0], "回答");
  }
  if (!goal && cue("publicPath")) {
    goal = "public";
    step("public_paths", { region });
  }
  // Questions that are mostly about something the data cannot hold: say so, then show what can be checked.
  if (!goal && gaps.length && !cue("legacy")) {
    goal = "gap";
    const roleHelps = gaps.some((g) => ["working_hours", "admission_odds", "school_background"].includes(g.id)) || (gapIds.has("prediction") && /取代|替代|淘汰|\bai\b|人工智能|自动化|前途|消失/i.test(q));
    if (knownRoles.length && roleHelps) step("role_profile", { roleId: knownRoles[0].id, region });
    else if (majorId) step("major_routes", { majorId });
  }
  if (!goal && majorId && !cue("legacy")) {
    goal = "destinations";
    step("major_routes", { majorId });
    step("major_guide", { majorId });
    step("graduate_outcomes", { majorId, region });
  }
  if (!goal && ent.industries.length && !knownRoles.length && !cue("legacy")) {
    goal = "industry";
    step("industry_map", { industryId: ent.industries[0].id, region });
  }
  if (!goal && (knownRoles.length || cue("legacy"))) {
    goal = "legacy";
    step("catalog_answer", { question: q, region, roleIds: knownRoles.map((r) => r.id) });
  }
  if (!goal) {
    goal = gaps.length ? "gap" : "none";
    if (!notes.length && !gaps.length) notes.push("没有在问题里找到目录中的专业、岗位或行业名称。请补充一个名称，例如“会计”“数据科学家”“电力与新能源”。");
  }
  return {
    question: q,
    goal,
    region,
    regionFrom: ent.regionFrom,
    entities: ent,
    majorId: goal === "transfer" ? sourceMajor : majorId,
    majorFrom,
    classification,
    steps: steps.map(([tool, args]) => ({ tool, args })),
    gaps,
    notes,
  };
}

/* ---------- Executor and answer composer ---------- */

export function routeAnswer(question, base, extra = {}) {
  const ctx = makeContext(base);
  const t0 = now();
  const p = plan(question, ctx, extra);
  const trace = [
    {
      tool: "planner",
      input: p.question,
      output: plannerSummary(p, ctx),
      ms: round(now() - t0),
    },
  ];
  const results = [];
  for (const step of p.steps) {
    const t = now();
    const fn = TOOLS[step.tool];
    const out = fn ? fn(ctx, step.args) : { ok: false, summary: "未知工具" };
    results.push({ ...step, out });
    trace.push({ tool: step.tool, input: argSummary(step.args, ctx), output: out.summary, ms: round(now() - t) });
  }
  const answer = compose(p, results, ctx);
  return { ...answer, plan: p, trace, engine: "rules" };
}
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const round = (ms) => Math.round(ms * 10) / 10;

function plannerSummary(p, ctx) {
  const e = p.entities;
  const parts = [];
  if (p.majorId) parts.push(`专业=${ctx.major(p.majorId)?.name}（${p.majorFrom}）`);
  const roles = e.roles.filter((r) => r.id);
  if (roles.length) parts.push(`岗位=${roles.map((r) => ctx.role(r.id).title + (r.approx ? `（“${r.term}”的近似条目）` : "")).join("、")}`);
  if (e.industries.length) parts.push(`行业=${e.industries.map((i) => ctx.industry(i.id).name).join("、")}`);
  parts.push(`地区=${REGION_NAME[p.region]}（${p.regionFrom}）`);
  parts.push(`意图分类器=${intentLabels[p.classification.intent]}，区分度 ${p.classification.score}`);
  if (p.gaps.length) parts.push(`数据缺口=${p.gaps.map((g) => g.title).join("、")}`);
  parts.push(`规划=${GOAL_LABELS[p.goal]}，${p.steps.length} 步`);
  return parts.join("；");
}
function argSummary(args, ctx) {
  return Object.entries(args)
    .filter(([k, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length) && k !== "question")
    .map(([k, v]) => {
      const name = (id) => ctx.role(id)?.title || ctx.major(id)?.name || ctx.industry(id)?.name || id;
      const val = Array.isArray(v) ? v.map(name).join("、") : k === "region" ? REGION_NAME[v] : name(v);
      return `${k}=${val}`;
    })
    .join("，") || "—";
}

function compose(p, results, ctx) {
  const sources = [];
  const cite = (src) => {
    if (!src) return null;
    let i = sources.findIndex((s) => s.key === src.key);
    if (i < 0) {
      sources.push(src);
      i = sources.length - 1;
    }
    return i + 1;
  };
  const blocks = [];
  const block = (title, kind, items, src) => {
    const list = (items || []).filter(Boolean);
    if (list.length) blocks.push({ title, kind, items: list, ref: cite(src) });
  };
  const factText = (f) => {
    const n = cite(f.source);
    const change = finite(f.change) ? `，比上年 ${signed(f.change)}%` : "";
    const date = f.source.date ? `${f.source.dateLabel} ${f.source.date}` : "日期未记录";
    return `${f.label}：${f.prefix || ""}${fmt(f.value)} ${f.unit}${change}。〔[${n}] ${f.source.title}，统计期 ${f.period}，${date}〕`;
  };
  const by = (tool) => results.filter((r) => r.tool === tool);
  const out = (tool) => by(tool)[0]?.out;
  const region = p.region;

  if (p.notes.length) block("先说明", "note", p.notes, null);

  if (p.goal === "transfer") {
    const routes = out("major_routes");
    const guide = out("major_guide");
    if (routes?.ok)
      block(`起点：${routes.major.name}在目录里通向`, "catalog", routes.byIndustry.map((g) => `${g.industry.name}：${g.roles.map((r) => r.title).join("、")}`), routes.source);
    for (const g of by("skill_gap").map((r) => r.out).filter((x) => x.ok)) {
      const have = g.rows.filter((r) => r.have);
      const need = g.rows.filter((r) => !r.have);
      block(
        `转到${g.target.title}：技能对照`,
        "catalog",
        [
          need.length ? `需要补：${need.map((r) => r.skill).join("、")}` : null,
          have.length ? `原背景里有相近内容：${have.map((r) => `${r.skill}（${r.have.from}：${r.have.text}）`).join("；")}` : null,
          `可以先做的证明：${g.target.portfolio}`,
        ],
        g.source,
      );
    }
    const trail = out("multi_trail");
    if (trail)
      block(
        "目录里的相邻路线",
        "catalog",
        [
          trail.path
            ? `按目录标注的相邻岗位可以这样走：${trail.path.map((r) => r.title).join(" → ")}。相邻关系是编辑研究，不代表转岗成功率。`
            : `目录标注的相邻岗位里，没有从起点岗位通向${trail.to?.title}的路线（三步以内），这是一次跨方向的转换，需要单独补足上面的技能。`,
        ],
        CATALOG_SOURCE(ctx),
      );
    for (const rp of by("role_profile").map((r) => r.out).filter((x) => x.ok))
      block(`${rp.role.title}：入门与资格（${REGION_NAME[region]}）`, "catalog", [`入门：${rp.local.entry || rp.role.entry}`, `资格核对：${rp.local.credential || rp.role.education}`], rp.source);
    if (guide?.ok && guide.guide.transferable?.length && ctx.major(p.majorId)) block(`${ctx.major(p.majorId).name}可迁移的能力（编辑研究）`, "catalog", guide.guide.transferable, guide.source);
  }

  if (p.goal === "destinations") {
    const routes = out("major_routes");
    const guide = out("major_guide");
    const outcomes = out("graduate_outcomes");
    if (routes?.ok)
      block(
        `${routes.major.name}在目录里通向的行业与岗位`,
        "catalog",
        [...routes.byIndustry.map((g) => `${g.industry.name}：${g.roles.map((r) => r.title).join("、")}`), "目录关联表示可以探索的方向，不是毕业去向比例，也不代表录用概率。"],
        routes.source,
      );
    if (guide?.ok) block("三条职业路线（编辑研究）", "catalog", guide.guide.routes.map((r) => `${r.title}：${r.entry}`), guide.source);
    if (outcomes) {
      if (!outcomes.groups.length)
        block(
          `官方去向统计（${REGION_NAME[region]}）`,
          "gap",
          [`本站还没有收录${outcomes.school ? outcomes.school + "的" : ""}${ctx.major(p.majorId).name}在${REGION_NAME[region]}的官方毕业去向表，不从其他专业、学校或国家推算。`],
          null,
        );
      for (const g of outcomes.groups.slice(0, 3)) {
        const src = { key: g.source.url, title: g.source.title, url: g.source.url, date: day(g.source.publishedAt) || day(g.source.modifiedAt), dateLabel: g.source.publishedAt ? "发布" : "页面更新", kind: g.region === "CN" ? "高校报告" : "官方统计" };
        const n = cite(src);
        const rows = g.rows
          .filter((r) => finite(r.share))
          .slice(0, 5)
          .map((r) => `${r.occupationZh || r.occupation} ${fmt(r.share)}%`);
        const unreported = g.rows.filter((r) => !finite(r.share)).map((r) => r.occupationZh || r.occupation);
        block(
          `${g.title}`,
          "outcome",
          [
            `${g.metric}：${rows.join("；")}${unreported.length ? `；原文未给出：${unreported.join("、")}` : ""}。〔[${n}] ${src.title}，统计期 ${g.period}，${src.date ? `${src.dateLabel} ${src.date}` : "日期未记录"}〕`,
            `样本：${g.population}`,
            g.limitations?.[0] ? `使用限制：${g.limitations[0]}` : null,
          ],
          src,
        );
      }
      if (outcomes.groups.length > 3) block("还有更多去向表", "note", [`另有 ${outcomes.groups.length - 3} 组同专业的去向表，可在专业页查看完整列表。`], null);
    }
  }

  for (const w of by("wage_stat").map((r) => r.out)) {
    if (w.ok) block(w.title, "stat", [...w.facts.map(factText), ...w.caveats], w.source);
    else if (w.missing) block("没有可用的统计数值", "gap", [w.missing], null);
  }
  const macro = out("macro_lookup");
  if (macro) {
    if (macro.ok)
      block(
        `最新官方指标（${REGION_NAME[region]}）`,
        "stat",
        [...macro.facts.map(factText), "宏观统计只是就业背景，不能直接推出某个专业或岗位的就业结果。"],
        null,
      );
    else block("没有可用的指标", "gap", [region === "US" ? "美国图层只接入了失业率与非农就业人数的月度数据；其他指标请切换到中国图层或查看数据台账。" : "当前没有可用的中国最新指标快照。"], null);
  }

  if (p.goal === "adjacent") {
    const a = out("adjacent_trail");
    if (a?.ok)
      block(
        `${a.role.title}的相邻岗位`,
        "catalog",
        [
          ...a.rows.map((row) => {
            const why = [row.sameIndustry ? "同一行业" : `在${ctx.industry(row.role.industryId).name}`, row.sharedMajors.length ? `共同的专业背景：${row.sharedMajors.join("、")}` : null, row.sharedSkills.length ? `相近技能：${row.sharedSkills.join("、")}` : null]
              .filter(Boolean)
              .join("；");
            return `${row.role.title}（${row.dir === "out" ? "目录标注为相邻" : "它把本岗位列为相邻"}；${why}）`;
          }),
          "相邻关系是目录的编辑研究，不代表转岗难度或成功率。",
        ],
        a.source,
      );
  }

  if (p.goal === "industry") {
    const m = out("industry_map");
    if (m?.ok) {
      block(
        `${m.industry.name}：产业链上的岗位`,
        "catalog",
        m.industry.chain.map((c) => `${c.stage}（${c.description}）：${c.roles.map((id) => ctx.role(id)?.title).filter(Boolean).join("、") || "目录未列岗位"}`),
        m.source,
      );
      block("目录里这个行业的全部岗位", "catalog", [m.roles.map((r) => r.title).join("、")], m.source);
      block("谁付钱、需求与风险（编辑研究）", "catalog", [m.industry.businessModel, ...m.industry.drivers.map((x) => `需求：${x}`), ...m.industry.risks.map((x) => `风险：${x}`)], m.source);
    }
  }

  if (p.goal === "compare") {
    const [a, b] = by("role_profile").map((r) => r.out).filter((x) => x.ok);
    if (a && b) {
      for (const rp of [a, b])
        block(
          rp.role.title,
          "catalog",
          [
            `日常：${rp.role.daily.join("；")}`,
            `主要交付：${(rp.role.jobReality?.deliverables || []).join("；")}`,
            `入门：${rp.local.entry || rp.role.entry}`,
            `资格核对：${rp.local.credential || rp.role.education}`,
          ],
          rp.source,
        );
      const shared = a.role.skills.filter((s) => b.role.skills.some((t) => overlaps(s, t)));
      block("技能对照", "catalog", [`${a.role.title}：${a.role.skills.join("、")}`, `${b.role.title}：${b.role.skills.join("、")}`, shared.length ? `相近：${shared.join("、")}` : "两者的技能清单没有明显重合。"], a.source);
    }
  }

  if (p.goal === "public") {
    const pp = out("public_paths");
    for (const path of pp?.paths || [])
      block(path.title, "catalog", [path.summary, ...path.steps.map((x) => `步骤：${x}`), ...path.checks.map((x) => `报名前核对：${x}`), "资格和岗位条件以当年、当地官方公告为准；本站不收录招录人数、分数线或通过率。"], {
        key: path.url,
        title: `${path.title}（官方入口）`,
        url: path.url,
        date: ctx.catalog.reviewedAt || null,
        dateLabel: "目录复核",
        kind: "官方入口",
      });
  }

  if (p.goal === "entry")
    for (const rp of by("role_profile").map((r) => r.out).filter((x) => x.ok))
      block(
        `${rp.role.title}：入门准备与资格（${REGION_NAME[region]}）`,
        "catalog",
        [
          `入门：${rp.local.entry || rp.role.entry}`,
          `资格核对：${rp.local.credential || rp.role.education}`,
          `技能：${rp.role.skills.join("、")}`,
          `可以先做的证明：${rp.role.portfolio}`,
          ...(rp.role.jobReality?.entryRoutes || []).map((x) => `进入路径：${x}`),
          `日常：${rp.role.daily.join("；")}`,
          `目录里关联的专业：${rp.role.majors.map((m) => ctx.major(m)?.name).filter(Boolean).join("、")}`,
        ],
        rp.source,
      );

  if (p.goal === "gap") {
    const rp = out("role_profile");
    const routes = out("major_routes");
    const ids = new Set(p.gaps.map((g) => g.id));
    if (rp?.ok) {
      const r = rp.role;
      const items = [];
      if (ids.has("prediction"))
        items.push(`可被工具覆盖的任务：${r.ai.automated.join("；")}`, `仍需人判断与验证的部分：${r.ai.complement.join("；")}`, "这是本站对任务的编辑拆解，不是对岗位数量或个人前景的测算。");
      if (ids.has("working_hours")) items.push(...(r.jobReality?.companyTypes || []).map((t) => `${t.type}：${t.tradeoff}（编辑研究，不是工时统计）`));
      if (ids.has("admission_odds") || ids.has("school_background") || ids.has("starting_salary") || !items.length)
        items.push(`入门：${rp.local.entry || r.entry}`, `资格核对：${rp.local.credential || r.education}`);
      block(`${r.title}：现有资料能核对的部分（${REGION_NAME[region]}）`, "catalog", items, rp.source);
    }
    if (routes?.ok) block(`${routes.major.name}在目录里通向的行业与岗位`, "catalog", routes.byIndustry.map((g) => `${g.industry.name}：${g.roles.map((x) => x.title).join("、")}`), routes.source);
  }

  let legacy = null;
  if (p.goal === "legacy") {
    const r = out("catalog_answer");
    legacy = r?.result || null;
    if (legacy?.sections.length) {
      for (const s of legacy.sections) {
        const doc = legacy.evidence.find((d) => d.id === s.source);
        const src = doc ? { key: doc.url + "|" + doc.id, title: doc.title, url: doc.url, date: null, dateLabel: "", kind: kindLabel(doc.kind) } : null;
        block(s.title, "legacy", s.items, src);
      }
    }
  }

  const gapItems = p.gaps.map((g) => ({ title: g.title, why: g.why, instead: g.instead }));
  const answered = blocks.some((b) => b.kind !== "note" && b.kind !== "gap");
  return {
    goal: p.goal,
    label: GOAL_LABELS[p.goal],
    region,
    blocks,
    gaps: gapItems,
    sources,
    answered,
    legacy,
    note: answered
      ? "数字只来自上面注明的官方统计或高校报告；岗位、技能与路线是本站目录的编辑研究，不是实测结果。"
      : "没有足够的资料回答这个问题。",
  };
}
function kindLabel(kind) {
  return ["official-fact", "macro-fact", "graduate-fact"].includes(kind)
    ? "官方统计"
    : kind === "recruitment-fact"
      ? "官方招聘条件"
      : kind === "public-path"
        ? "官方入口"
        : kind === "policy-fact"
          ? "政策原文与分析"
          : "目录研究";
}

/** Plain-text rendering, shared by the evaluation runner and tests. */
export function answerText(a) {
  const lines = [];
  for (const b of a.blocks) {
    lines.push(`## ${b.title}${b.ref ? ` [${b.ref}]` : ""}`);
    for (const i of b.items) lines.push(`- ${i}`);
  }
  if (a.gaps.length) {
    lines.push("## 这些数据回答不了");
    for (const g of a.gaps) lines.push(`- ${g.title}：${g.why}${g.instead ? ` 可以改看：${g.instead}` : ""}`);
  }
  if (a.sources.length) {
    lines.push("## 来源");
    a.sources.forEach((s, i) => lines.push(`[${i + 1}] ${s.title}${s.date ? ` · ${s.dateLabel} ${s.date}` : ""} · ${s.url}`));
  }
  return lines.join("\n");
}

