import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { routeAnswer, answerText, plan, resolveEntities, GAP_RULES } from "../web/route.js";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const base = {
  catalog: read("../web/data/catalog.json"),
  data: read("../web/data/observations.json"),
  research: read("../web/data/research.json"),
  outcomes: read("../web/data/graduate-outcomes.json"),
  policies: read("../web/data/policies.json"),
  recruitment: read("../web/data/recruitment-evidence.json"),
  intentModel: read("../web/intent-model.json"),
};
const ask = (q, extra = {}) => routeAnswer(q, base, { region: "CN", ...extra });
// The bot refreshes web/data every 6 hours; tests that need a specific live series skip, rather than block a deploy, if a feed drops it.
const src = base.data.sources;
const hasIndicator = (id) => (src["cn-current"]?.value?.indicators || []).some((i) => i.id === id);
const hasSOC = (soc) => src.bls?.value?.occupations?.[soc]?.type === "Line item";
const hasSector = (name) => Boolean(src["nbs-wages"]?.value?.sectors?.[name]);
const hasUSAnnual = (key) => Boolean(src[key]?.value?.US?.length);
const tools = (a) => a.trace.slice(1).map((t) => t.tool);
const text = (a) => answerText(a);
const corpus = JSON.stringify([base.catalog, base.research, base.policies, base.recruitment, base.outcomes, base.data]);
// Published numbers, also rounded to two decimals (annual World Bank series are shown rounded).
const published = new Set();
for (const n of corpus.match(/-?\d+(\.\d+)?/g)) {
  published.add(n.replace(/^-/, ""));
  published.add(String(Math.round(Math.abs(Number(n)) * 100) / 100));
}

/* Coverage: every topic the assistant says it handles, one plain and one colloquial wording. */
const COVERAGE = [
  ["transfer", "我学会计，想转数据分析要补什么", ["skill_gap"]],
  ["transfer", "本科读的英语，能转做产品经理吗，差什么", ["skill_gap"]],
  ["destinations", "计算机类专业毕业可以去哪些行业", ["major_routes", "graduate_outcomes"]],
  ["destinations", "学护理的毕业以后都干啥", ["major_routes", "graduate_outcomes"]],
  ["stats", "软件与企业服务行业的平均工资是多少", ["wage_stat"]],
  ["stats", "做会计一年能挣多少", ["wage_stat"]],
  ["stats", "最新的 CPI 是多少", ["macro_lookup"]],
  ["stats", "现在国内失业率多少啊", ["macro_lookup"]],
  ["adjacent", "软件测试工程师有哪些相邻岗位", ["adjacent_trail"]],
  ["adjacent", "当老师的话还能转什么", ["adjacent_trail"]],
  ["industry", "电力与新能源行业有哪些岗位", ["industry_map"]],
  ["industry", "芯片行业都招什么人", ["industry_map"]],
  ["compare", "前端开发工程师和后端开发工程师有什么区别", ["role_profile", "role_profile"]],
  ["compare", "产品经理跟用户体验设计师选哪个", ["role_profile", "role_profile"]],
  ["entry", "律师需要什么资格", ["role_profile"]],
  ["entry", "零基础怎么入门网络安全", ["role_profile"]],
  ["public", "考公和事业单位招聘有什么区别", ["public_paths"]],
  ["public", "美国联邦政府的岗位怎么申请", ["public_paths"]],
  ["legacy", "国家对人工智能有啥支持政策", ["catalog_answer"]],
  ["legacy", "新能源方面最近有什么政策", ["catalog_answer"]],
];
const NEEDS = { "最新的 CPI 是多少": () => hasIndicator("cpi"), "现在国内失业率多少啊": () => hasIndicator("unemployment") };
for (const [goal, q, expectTools] of COVERAGE)
  test(`coverage · ${goal} · ${q}`, { skip: NEEDS[q] && !NEEDS[q]() ? "live series missing" : false }, () => {
    const a = ask(q);
    assert.equal(a.goal, goal);
    for (const t of expectTools) assert(tools(a).includes(t), `${q}: missing tool ${t} in ${tools(a)}`);
    assert(a.answered, `${q}: no substantive block`);
    assert.equal(a.trace[0].tool, "planner");
    assert.equal(a.engine, "rules");
  });

const GAP_COVERAGE = [
  ["starting_salary", "计算机专业应届生起薪多少", "刚毕业做会计一个月能拿多少"],
  ["admission_odds", "考公务员的录用率是多少", "我这样能进国家电网吗"],
  ["school_background", "985 和双非找工作差多少", "二本学历进银行吃亏吗"],
  ["working_hours", "程序员加班多吗", "做审计累不累"],
  ["employer_pay", "腾讯给后端开多少工资", "华为一年给多少钱"],
  ["prediction", "会计五年后会不会被 AI 取代", "护士这行还有前途吗"],
  ["personal_fit", "我性格内向适合做什么", "你看我适合当老师吗"],
  ["ranking", "哪个专业最赚钱", "什么专业最好就业"],
  ["city", "上海做护士月薪多少", "在北京做后端工资高吗"],
  ["match_rate", "法学专业对口率多少", "学会计的有多少人专业对口"],
  ["further_study", "法学专业保研率多少", "学会计考研上岸率高吗"],
  ["time_to_job", "毕业几个月内能找到工作吗", "What percent of nursing majors get a job within 6 months?"],
];
for (const [id, plain, colloquial] of GAP_COVERAGE)
  for (const q of [plain, colloquial])
    test(`data gap · ${id} · ${q}`, () => {
      const a = ask(q);
      assert(a.gaps.some((g) => g.title === GAP_RULES.find((r) => r.id === id).title), `${q}: gap ${id} missing (${a.gaps.map((g) => g.title)})`);
      if (["starting_salary", "employer_pay", "city", "ranking", "personal_fit"].includes(id)) {
        assert(!a.blocks.some((b) => b.kind === "stat"), `${q}: a gap question must not carry a wage block`);
        assert(!/元\/年/.test(text(a)), `${q}: wage number in a gap answer`);
      }
    });

test("every number in a statistics block names its source, period and date", () => {
  const qs = ["软件与企业服务行业的平均工资是多少", "最新的 CPI 是多少", "经济学专业毕业去向有官方数据吗", "会计与审计专业毕业去哪"];
  const us = ["数据科学家工资多少", "护士的就业预测", "美国失业率是多少", "会计学毕业去向"];
  let checked = 0;
  for (const [q, region] of [...qs.map((q) => [q, "CN"]), ...us.map((q) => [q, "US"])]) {
    const a = ask(q, { region });
    for (const b of a.blocks.filter((x) => x.kind === "stat" || x.kind === "outcome"))
      for (const item of b.items)
        if (/\d+(\.\d+)?\s*(%|元|美元|千人|个\/年)/.test(item)) {
          checked++;
          assert.match(item, /〔\[\d+\] .+，统计期 .+，(最近成功采集|沿用核验快照|发布|页面更新) \d{4}-\d{2}-\d{2}〕/, `${q}: ${item}`);
        }
  }
  assert(checked >= 4, `only ${checked} numeric facts were checked`);
});

test("no answer introduces a number that is not in the published data", () => {
  const qs = [...COVERAGE.map((c) => c[1]), ...GAP_COVERAGE.flatMap((g) => g.slice(1)), "数据科学家工资多少", "学机械的想转嵌入式软件，需要补哪些", "这个专业毕业去哪些行业，起薪数据有官方来源吗"];
  for (const q of qs)
    for (const region of ["CN", "US"]) {
      const a = ask(q, { region, contextMajor: "mech" });
      for (const b of a.blocks)
        for (const item of b.items) {
          const body = item.replace(/〔[^〕]*〕/g, "");
          for (const n of body.match(/\d[\d,]*(\.\d+)?/g) || []) {
            const plain = n.replace(/,/g, "");
            assert(published.has(plain) || published.has(String(Number(plain))), `${q} (${region}): number ${n} is not in the data: ${item}`);
          }
        }
    }
});

test("wage caveats survive: industry average in China, SOC proxy in the United States", { skip: !(hasSOC("15-2051") && hasSector("租赁和商务服务业")) && "live series missing" }, () => {
  const cn = ask("做会计一年能挣多少");
  const cnText = text(cn);
  assert(cnText.includes("行业均值") && cnText.includes("不是某个岗位、某家公司或应届生的工资"));
  assert(cnText.includes("不能与美国职业中位数直接比较"));
  assert(!cnText.includes("美元"));
  const shared = ask("机械与工业自动化行业平均工资多少");
  assert(text(shared).includes("共用这个数"), "industries sharing an NBS sector must say so");
  const us = ask("数据科学家工资多少", { region: "US" });
  const usText = text(us);
  assert(usText.includes("代理") && usText.includes("不是应届工资") && usText.includes("不是当前空缺"));
  assert(!/(?<!美)元\/年/.test(usText));
  const noSoc = ask("产品经理在美国工资多少");
  assert.equal(noSoc.region, "US");
  assert(!noSoc.blocks.some((b) => b.kind === "stat"));
  assert(text(noSoc).includes("没有对应的美国详细职业"));
});

test("the trace lists the planner and each tool with its input and output", () => {
  const a = ask("我学会计，想转数据分析要补什么");
  assert.equal(a.trace.length, a.plan.steps.length + 1);
  assert(a.trace[0].output.includes("专业=会计与审计") && a.trace[0].output.includes("意图分类器="));
  for (const t of a.trace) assert(t.tool && typeof t.input === "string" && typeof t.output === "string");
  assert(text(a).includes("目录里没有名为“数据分析”的岗位"), "an approximate target is named as such");
});

test("a transfer separates the starting major from the target role", () => {
  const a = ask("学机械的想转嵌入式软件，需要补哪些");
  assert.equal(a.plan.majorId, "mech");
  const gap = a.plan.steps.find((s) => s.tool === "skill_gap");
  assert.equal(gap.args.toRole, "embedded");
  assert(text(a).includes("需要补："));
  const r = ask("我学会计，想转数据分析要补什么");
  assert(text(r).includes("SQL（专业课程基础"), "accounting foundations list basic SQL, which counts as existing background");
});

test("'this major' uses the open major page and asks when there is none", () => {
  const withPage = ask("这个专业毕业去哪些行业，起薪数据有官方来源吗", { contextMajor: "accounting" });
  assert.equal(withPage.goal, "destinations");
  assert.equal(withPage.plan.majorId, "accounting");
  assert(withPage.gaps.some((g) => g.title === "应届起薪"));
  assert(!/元\/年/.test(text(withPage)));
  const noPage = ask("这个专业毕业去哪些行业");
  assert.equal(noPage.goal, "none");
  assert(text(noPage).includes("请写出专业名称"));
});

test("roles and majors outside the catalog are said to be missing, not answered with a neighbour", () => {
  for (const q of ["区块链工程师前景怎么样", "飞行汽车设计师需要什么条件", "投行分析师要补什么"]) {
    const a = ask(q);
    assert.equal(a.goal, "none", q);
    assert(text(a).includes("目录里没有"), q);
    assert(!a.blocks.some((b) => b.kind === "catalog" || b.kind === "legacy"), q);
  }
});

test("graduate outcomes keep school, cohort, sample and limitation, and never borrow another major", () => {
  const a = ask("会计与审计专业毕业去向有官方数据吗");
  const outcome = a.blocks.filter((b) => b.kind === "outcome");
  assert(outcome.length >= 1);
  for (const b of outcome) {
    assert(b.items.some((x) => x.startsWith("样本：")));
    assert(b.items.some((x) => x.startsWith("使用限制：")));
  }
  const none = ask("机械类毕业去向数据");
  assert(text(none).includes("不从其他专业、学校或国家推算"));
  assert(!none.blocks.some((b) => b.kind === "outcome"));
});

test("entity resolution prefers the longer name and the phrasing of a major", () => {
  const cat = base.catalog;
  assert.deepEqual(resolveEntities("零基础怎么入门网络安全", cat).roles.map((r) => r.id), ["security"]);
  assert.deepEqual(resolveEntities("电力与新能源行业有哪些岗位", cat).majors, []);
  assert.equal(resolveEntities("我学会计", cat).majors[0].id, "accounting");
  assert.deepEqual(resolveEntities("我学会计", cat).roles, []);
  assert.equal(resolveEntities("做会计一年能挣多少", cat).roles[0].id, "accountant");
  assert.deepEqual(resolveEntities("双非本科进银行难不难", cat).majors, [], "'银行' alone is an industry, not the finance major");
  assert.equal(resolveEntities("美国的护士", cat, { region: "CN" }).region, "US");
});

test("a retrieval answer drops sections about roles the question did not name", () => {
  const p = plan("程序员每天具体做什么", { ...base, role: (id) => base.catalog.roles.find((r) => r.id === id), major: (id) => base.catalog.majors.find((m) => m.id === id), industry: (id) => base.catalog.industries.find((i) => i.id === id) });
  assert(["legacy", "entry", "gap"].includes(p.goal));
  const a = ask("程序员每天具体做什么");
  for (const b of a.blocks.filter((x) => x.kind === "legacy")) assert(!/数控|加工/.test(b.title), b.title);
});

/* Failure classes found by the first blind run (blind_v1 on 3c85af3), tested with new wordings. */
test("cue words ignore entity names: 数据 inside a role title is not a statistics request", () => {
  for (const q of ["数据科学家和统计师有什么区别", "数据平台工程师跟后端开发工程师差别在哪"]) {
    const a = ask(q);
    assert.equal(a.goal, "compare", q);
    assert(!a.blocks.some((b) => b.kind === "stat"), q);
  }
});
test("adjacency is recognised in everyday wordings", () => {
  for (const q of ["产品经理和哪些岗位比较接近", "做嵌入式软件的能平移去哪些岗位"]) assert.equal(ask(q).goal, "adjacent", q);
});
test("a transfer names the major or current job as the start and the other role as the target", () => {
  const a = ask("我是学历史的，现在想做内容运营要准备啥");
  assert.equal(a.goal, "transfer");
  assert.equal(a.plan.majorId, "history");
  assert.equal(a.plan.steps.find((s) => s.tool === "skill_gap").args.toRole, "content");
  const b = ask("我现在做软件测试，想转后端要补什么");
  const gap = b.plan.steps.find((s) => s.tool === "skill_gap");
  assert.deepEqual(gap.args.fromRoles, ["qa"]);
  assert.equal(gap.args.toRole, "backend");
});
test("English major and role names reach the United States tables", { skip: !hasSOC("29-1141") && "live series missing" }, () => {
  const a = ask("What jobs do psychology majors hold in the US?");
  assert.equal(a.region, "US");
  assert.equal(a.goal, "destinations");
  assert(a.blocks.some((b) => b.kind === "outcome" && b.items.join("").includes("BLS Field of degree")));
  const n = ask("registered nurse median pay in the US");
  assert.equal(n.goal, "stats");
  assert(text(n).includes("SOC 29-1141"));
  const pt = ask("physical therapist median pay in the US");
  assert.equal(pt.goal, "none");
  assert(!pt.blocks.some((b) => b.kind === "stat"));
});
test("an NBS sector named directly is looked up with the catalog industries that share it", { skip: !(hasSector("制造业") && hasSector("金融业")) && "live series missing" }, () => {
  const a = ask("制造业和金融业的工资对比一下");
  assert.equal(a.goal, "stats");
  const t = text(a);
  assert(t.includes("统计门类“制造业”") && t.includes("统计门类“金融业”"));
  assert(t.includes("目录里属于这个门类的行业"));
});
test("US inflation and GDP come from the annual World Bank series and say so", { skip: !hasUSAnnual("wb-inflation") && "live series missing" }, () => {
  const a = ask("美国通胀率是多少");
  assert(text(a).includes("世界银行，年度") && /统计期 \d{4} 年（年度）/.test(text(a)));
});
test("public-sector entry routes answer from the layer the question names", () => {
  const us = ask("美国州政府的公共岗位从哪里找");
  assert.equal(us.goal, "public");
  assert(us.sources.every((s) => !/scs\.gov\.cn|mohrss/.test(s.url)));
  const cn = ask("事业单位招聘怎么报名");
  assert.equal(cn.goal, "public");
  assert(cn.sources.every((s) => !/usajobs|usa\.gov/.test(s.url)));
});
test("a university that has no report gets no other school's numbers; a covered one gets only its own", () => {
  const a = ask("北京大学会计专业就业率多少");
  assert(!a.blocks.some((b) => b.kind === "outcome"));
  assert(text(a).includes("没有北京大学的报告"));
  const b = ask("湖北师范大学法学专业就业率多少");
  const outs = b.blocks.filter((x) => x.kind === "outcome");
  assert(outs.length >= 1 && outs.every((x) => x.title.includes("湖北师范大学")));
});
test("a forecast question shows the latest published value and says it does not forecast", { skip: !hasIndicator("unemployment") && "live series missing" }, () => {
  const a = ask("明年失业率会不会上升");
  assert.equal(a.goal, "stats");
  assert(a.gaps.some((g) => g.title === "未来走势与个人前景"));
  assert(a.blocks.some((b) => b.kind === "stat"));
});

/* Findings from the read-only review of 09aca34, tested with the reviewer's reproductions. */
test("a university's name never supplies the major", () => {
  const a = ask("湖北师范大学的会计专业就业去哪");
  assert.equal(a.plan.majorId, "accounting");
  const outs = a.blocks.filter((b) => b.kind === "outcome");
  assert(outs.length >= 1 && outs.every((b) => b.title.includes("湖北师范大学")));
  assert(!a.blocks.some((b) => b.title.includes("教育学与师范")));
  assert.equal(ask("华东师范大学法学专业就业率多少").plan.majorId, "law");
});
test("a pay difference between two roles is a comparison, not a transfer plan", () => {
  const a = ask("会计师和审计师有什么区别，工资差多少");
  assert.equal(a.goal, "compare");
  assert(!text(a).includes("需要补："));
});
test("a question naming China and the US answers both and says they cannot be compared", () => {
  const a = ask("中国和美国的失业率各是多少");
  const stats = a.blocks.filter((b) => b.kind === "stat");
  assert(stats.some((b) => b.title.includes("中国大陆")) && stats.some((b) => b.title.includes("美国")));
  const w = ask("中国程序员和美国程序员的收入差多少");
  const t = text(w);
  assert(t.includes("统计门类") && t.includes("SOC") && t.includes("不能直接比较"));
});
test("a comparison keeps both named things even when one is an approximate name", () => {
  const a = ask("程序员和产品经理哪个好");
  assert.equal(a.goal, "compare");
  assert(a.plan.steps.some((s) => s.args.roleId === "product"));
});
test("catalog-retrieval answers list a date for every source and drop majors the question did not name", () => {
  for (const q of ["国家对人工智能有啥支持政策", "考公务员的录用率是多少", "双非本科进银行难不难"]) {
    const a = ask(q);
    for (const s of a.sources) assert(s.date, `${q}: source without date: ${s.title}`);
  }
  const m = ask("医学专业毕业能当医生吗");
  assert(!a_has(m, "康复与医学技术"), "another major's research must not lead the answer");
});
function a_has(a, words) {
  return a.blocks.some((b) => b.title.includes(words));
}
test("everyday major names resolve: 统计学, 生物, 医学", () => {
  assert.equal(ask("统计学专业去哪").plan.majorId, "math");
  assert.equal(ask("生物专业就业前景怎么样").plan.majorId, "bio");
  assert.equal(ask("医学专业毕业能当医生吗").plan.majorId, "medicine");
});
test("national average wage, asked years and duplicate sectors", { skip: !hasSector("合计") && "live series missing" }, () => {
  const a = ask("全国平均工资多少");
  assert.equal(a.goal, "stats");
  assert(text(a).includes("所有行业合计"));
  const y = ask("2015年软件行业工资多少");
  assert(text(y).includes("问题问的是 2015 年"));
  const d = ask("What is the salary of a software developer?");
  assert.equal(d.blocks.filter((b) => b.kind === "stat").length, 1, "two roles reading one sector give one block");
});
