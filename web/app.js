import {
  normalizePreferences,
  rankPreferredRoles,
} from "./preferences.js?v=20261102";
import { roleOutcomes, resolveMajor, majorEvidence } from "./research.js?v=20261102";
import {
  majorGuideHTML,
  industryResearchHTML,
  policiesHTML,
  evidenceLibraryHTML,
} from "./research-views.js?v=20261102";
import {
  scoreRole,
  industryScore,
  roleObservation,
  freshness,
  DIMENSIONS,
} from "./scoring.js?v=20261102";
import { sparkline, lineChart } from "./charts.js?v=20261102";
import { advise } from "./advisor.js?v=20261102";
import { ModelClient } from "./model.js?v=20261102";
import { evidenceTask, selectEvidence } from "./grounded.js?v=20261102";
import { atlasSVG, GROUPS, PLACES, gridRef, groupOf } from "./atlas.js?v=20261102";

const $ = (s, root = document) => root.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const safeURL = (u) => (/^https:\/\//.test(u) ? u : "#/data");
const num = (n, d = 0) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("zh-CN", { maximumFractionDigits: d, minimumFractionDigits: d })
    : "—";
const list = (items) => `<ul>${(items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
const saved = () => {
  try {
    return JSON.parse(localStorage.getItem("career-atlas-preferences") || "{}");
  } catch {
    return {};
  }
};
const state = {
  region: saved().region === "US" ? "US" : "CN",
  route: { view: "cover" },
  query: "",
  industryId: "",
  major: "",
  trailMajor: "",
  indSort: "catalog",
  indQuery: "",
  roleSort: "catalog",
  limit: 24,
  compare: [],
  prefs: normalizePreferences(saved()),
  trendIndicator: "unemployment",
  modelLoaded: false,
  generating: false,
};
let intentModel = null;
let catalog, data, ecosystem, research, outcomes, policies, recruitment, toastTimer;
const model = new ModelClient();
const regions = { CN: "中国大陆", US: "美国" };
const TABS = { atlas: "总览", industries: "行业", roles: "岗位", majors: "专业", plan: "路线", data: "数据" };
const FEATURED = ["agent", "mechanical", "nurse", "accountant", "ecommerce", "planner", "civilservice", "electrician"];

const industryById = (id) => catalog.industries.find((i) => i.id === id);
const roleById = (id) => catalog.roles.find((r) => r.id === id);
const majorById = (id) => catalog.majors.find((m) => m.id === id);
const industryFor = (r) => industryById(r.industryId);
const source = (k) => data.sources[k];
const annual = (key, region = state.region) => source("wb-" + key)?.value?.[region] ?? [];
const latest = (rows) => rows?.at(-1);
const dateLabel = (s) =>
  s
    ? new Date(s).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "暂无";
const groupIndex = (id) => GROUPS.findIndex((g) => g.ids.includes(id));
const swatch = (industryId) => `<i class="swatch" style="--g:var(--g${groupIndex(industryId) + 1})" aria-hidden="true"></i>`;
const majorRoles = (m) => (m ? catalog.roles.filter((r) => m.roleIds.includes(r.id)) : []);
const routeCounts = (m) => {
  const counts = {};
  for (const r of majorRoles(m)) counts[r.industryId] = (counts[r.industryId] || 0) + 1;
  return counts;
};

/* ---------- Shared pieces ---------- */
function layerSwitch() {
  return `<div class="layer"><span class="collected" title="采集时间与统计所属期分开记录"><i aria-hidden="true"></i>最近采集 ${esc(dateLabel(data.attemptedAt))}</span><span aria-hidden="true">图层</span><div class="layer-switch" role="group" aria-label="选择分析地区">${Object.entries(regions)
    .map(([k, v]) => `<button type="button" data-region="${k}" aria-pressed="${state.region === k}">${v}</button>`)
    .join("")}</div></div>`;
}
function pageHead({ crumbs = [], title, desc = "", extra = "", layer = true }) {
  return `<div class="page-head"><div><nav class="crumbs" aria-label="当前位置"><a href="#/atlas">图册</a>${crumbs
    .map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`))
    .join("")}</nav><h1 id="page-title">${title}</h1>${desc ? `<p class="desc">${desc}</p>` : ""}${extra}</div>${layer ? layerSwitch() : ""}</div>`;
}
function sectionHead(title, desc = "", aside = "", id = "") {
  return `<div class="section-head"${id ? ` id="${id}"` : ""}><div><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div>${aside}</div>`;
}
function scoreChip(s) {
  return s.score === null
    ? `<span class="score-chip none" title="有效统计不足，不显示指数">统计不足</span>`
    : `<span class="score-chip" title="统计参考指数：只由已核对统计合成，50 为中性参考，不是录用概率">${s.score}<small>统计参考</small></span>`;
}
function macroIndicators() {
  if (state.region === "CN") return source("cn-current")?.value?.indicators || [];
  return [
    ["unemployment", "失业率（季调）", "fred-UNRATE", "%"],
    ["payroll", "非农就业人数（季调）", "fred-PAYEMS", "千人"],
  ].flatMap(([id, label, key, unit]) => {
    const s = source(key),
      series = s?.value || [],
      x = latest(series);
    return x
      ? [{ id, label, value: x.value, unit, period: x.date.slice(0, 7), frequency: "月度", changeLabel: "当月水平", url: s.url, publishedAt: null, series, status: s.status }]
      : [];
  });
}
const cachedNote = (x) => ((x.status || source("cn-current")?.status) === "cached" ? " · 沿用缓存" : "");
function strip() {
  const items = macroIndicators();
  if (!items.length) return '<p class="evidence-note">最新指标暂不可用，请在数据页查看来源状态。</p>';
  return `<div class="strip" style="--n:${items.length}">${items
    .map(
      (x) =>
        `<a class="strip-item" href="${esc(safeURL(x.url))}" target="_blank" rel="noopener"><span class="k">${esc(x.label)}</span><span class="v">${num(x.value, 1)}<small>${esc(x.unit)}</small></span><span class="p">${esc(x.period)} · ${esc(x.changeLabel)}</span><span class="p">${x.publishedAt ? "发布 " + esc(x.publishedAt) : "BLS / FRED 月度"}${cachedNote(x)}</span>${sparkline(x.series.slice(-12))}</a>`,
    )
    .join("")}</div><p class="note">${state.region === "CN" ? "来源：国家统计局。各指标按实际发布节奏更新；GDP 为累计同比，其余口径见各项。" : "来源：BLS / FRED。美国月度数据为季调值，可能修订。"}短线只画已采集的历史点。</p>`;
}
function roleCard(role, { preference = null } = {}) {
  const industry = industryFor(role),
    s = scoreRole(role, industry, state.region, data),
    j = role.jobReality,
    selected = state.compare.includes(role.id);
  return `<article class="role-card">${
    preference
      ? `<div class="fit-line">${preference.majorMatch ? "目录中的相关专业方向" : state.prefs.major ? "跨专业探索，先核对资格" : "未限定专业"}</div>`
      : ""
  }<div class="role-card-head"><div><h3><a href="#/role/${role.id}">${esc(role.title)}</a></h3><span class="where">${swatch(role.industryId)}${esc(industry.name)} · ${regions[state.region]}</span></div>${scoreChip(s)}</div><p class="deliver"><b>交付</b>${esc(j?.deliverables?.[0] || role.daily[0])}</p><p class="entry">入门：${esc(j?.entryRoutes?.[0] || role.entry)}</p><div class="chip-row">${role.skills
    .slice(0, 4)
    .map((k) => `<span class="chip">${esc(k)}</span>`)
    .join("")}</div><div class="role-card-foot"><span>${esc(
    j?.companyTypes?.slice(0, 2).map((x) => x.type).join(" / ") || "不同公司职责不同",
  )} · ${esc(s.evidenceLabel)}</span><div><button class="button subtle" type="button" data-compare="${role.id}" aria-pressed="${selected}">${selected ? "已选 ✓" : "＋ 对比"}</button><a class="button" href="#/role/${role.id}">详情</a></div></div></article>`;
}
const roleGrid = (roles, empty = "没有符合条件的岗位，可以放宽专业或行业筛选。") =>
  roles.length ? `<div class="role-grid">${roles.map((r) => roleCard(r)).join("")}</div>` : `<div class="empty-state">${empty}</div>`;
function mapSheet(frameId, label) {
  const m = majorById(state.trailMajor);
  return `<div class="map-frame" id="${frameId}"><div class="map-scroll">${atlasSVG({ industries: catalog.industries, counts: routeCounts(m), from: m?.name || "", label })}</div><div class="map-callout" hidden></div></div><p class="map-hint">左右滑动查看完整地图，点地点进入行业。</p>`;
}

/* ---------- Cover ---------- */
let coverReady = false;
function renderCover() {
  document.title = "向野 · Career Atlas｜中美行业与职业图册 | Leon Wang";
  if (!coverReady) {
    $("#trailhead-major").insertAdjacentHTML("beforeend", majorOptions(state.trailMajor));
    coverReady = true;
  }
  $("#trailhead-major").value = state.trailMajor;
  const items = source("cn-current")?.value?.indicators || [];
  $("#cover-collected").textContent = "采集 " + dateLabel(data.attemptedAt);
  $("#cover-ledger").innerHTML = items.length
    ? items
        .map(
          (x) =>
            `<div class="ledger-row"><span class="k">${esc(x.label)}<small>${esc(x.period)} · ${esc(x.changeLabel)}${x.publishedAt ? " · 发布 " + esc(x.publishedAt) : ""}</small></span><span class="v">${num(x.value, 1)}<small>${esc(x.unit)}</small></span>${sparkline(x.series.slice(-12)) || "<span></span>"}</div>`,
        )
        .join("") + `<p class="form-note">国家统计局 · 中国大陆。美国 BLS 数据在图册内切换图层查看。</p>`
    : '<p class="form-note">最新指标暂不可用，请在数据台账查看来源状态。</p>';
  $("#cover-stats").textContent = `${catalog.industries.length} 行业 · ${catalog.roles.length} 岗位 · ${catalog.majors.length} 专业 · ${Object.keys(data.sources).length} 路官方来源`;
  const m = majorById(state.trailMajor);
  $("#cover-map").innerHTML = atlasSVG({ industries: catalog.industries, counts: routeCounts(m), from: m?.name || "", label: "行业地图：八个板块、二十六个行业地点" });
}
function majorOptions(selected = "") {
  const cats = [...new Set(catalog.majors.map((m) => m.category))];
  return cats
    .map(
      (c) =>
        `<optgroup label="${esc(c)}">${catalog.majors
          .filter((m) => m.category === c)
          .map((m) => `<option value="${m.id}" ${selected === m.id ? "selected" : ""}>${esc(m.name)}</option>`)
          .join("")}</optgroup>`,
    )
    .join("");
}

/* ---------- 总览 ---------- */
function atlasPage() {
  const m = majorById(state.trailMajor),
    counts = routeCounts(m),
    route = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const news = source("nbs-news")?.value || [];
  return `${pageHead({ title: "总览", desc: "本期官方数据、行业地图与常用入口。选择一个专业，地图会画出它通往的行业。" })}
  ${strip()}
  <div class="atlas-layout section">
    <section class="map-sheet" aria-labelledby="atlas-map-title"><div class="map-sheet-head"><h2 id="atlas-map-title">行业地图</h2><span class="mono">${catalog.industries.length} 个地点 · ${GROUPS.length} 个板块</span></div>${mapSheet("atlas-map-frame", "行业地图")}</section>
    <div class="atlas-side">
      <section class="panel"><h2>路线起点</h2><label for="atlas-major" class="sr-only">选择专业</label><select id="atlas-major" style="width:100%"><option value="">选择专业，画出路线</option>${majorOptions(state.trailMajor)}</select>${
        m
          ? `<ul class="route-list">${route.map(([id, n]) => `<li><a href="#/industry/${id}">${esc(industryById(id).name)}</a><span class="mono">${n} 个岗位</span></li>`).join("")}</ul><p class="note">共 ${majorRoles(m).length} 个目录关联岗位；关联不等于符合招聘资格。</p><a class="button" href="#/major/${m.id}" style="margin-top:10px;width:100%">查看${esc(m.name)}详情</a>`
          : `<p class="note">路线来自岗位目录里的专业关联，用来缩小探索范围，不表示录用概率。</p>`
      }</section>
      <section class="panel"><h2>官方发布</h2><ul class="news-list">${news
        .slice(0, 5)
        .map((n) => `<li><a href="${esc(safeURL(n.url))}" target="_blank" rel="noopener">${esc(n.title)}</a><time>${esc(n.date)}</time></li>`)
        .join("")}</ul><p class="note">国家统计局公开发布的标题与日期，不代表就业预测。</p></section>
    </div>
  </div>
  <div class="section shortcuts">
    <a class="shortcut" href="#/industry/ai"><strong>人工智能岗位专题</strong><span>应用开发、研究与数据工程的区别</span></a>
    <a class="shortcut" href="#/majors"><strong>毕业生实际去向</strong><span>${(outcomes?.groups || []).length} 组官方与高校去向表</span></a>
    <a class="shortcut" href="#/plan"><strong>考公与公共部门</strong><span>报考条件、岗位类型与核对入口</span></a>
    <a class="shortcut" href="#/data"><strong>数据台账</strong><span>每路来源的统计期与采集状态</span></a>
  </div>
  <section class="section">${sectionHead("从这些岗位开始看", "职业研究资料：职责、入门准备与公司情境用于求职核对，不代表正在招聘。", `<a class="text-link" href="#/roles">全部 ${catalog.roles.length} 个岗位 →</a>`)}${roleGrid(FEATURED.map(roleById).filter(Boolean))}</section>`;
}

/* ---------- 行业 ---------- */
function industryRow(i) {
  const s = industryScore(i, catalog, state.region, data),
    roles = catalog.roles.filter((r) => r.industryId === i.id);
  return `<a class="ind-row" href="#/industry/${i.id}"><span class="ref">${gridRef(PLACES[i.id])}</span><span><h3>${esc(i.name)}</h3><span class="cat">${esc(i.category)}</span></span><p>${esc(i.summary)}</p><span class="stat"><strong>${s.score ?? "—"}</strong>${s.score === null ? "统计不足" : "统计参考"} · ${s.evidenceGroups} 组口径<br>${roles.length} 个岗位方向</span></a>`;
}
function industryList() {
  const q = state.indQuery.trim().toLowerCase();
  const text = (i) =>
    [i.name, i.category, i.summary, i.businessModel, ...i.chain.map((c) => c.stage), ...catalog.roles.filter((r) => r.industryId === i.id).map((r) => r.title)].join(" ").toLowerCase();
  let rows = catalog.industries.filter((i) => !q || text(i).includes(q));
  if (state.indSort === "catalog")
    return (
      GROUPS.map((g, gi) => {
        const inGroup = g.ids.map(industryById).filter((i) => rows.includes(i));
        return inGroup.length
          ? `<section class="region-sheet" style="--g:var(--g${gi + 1})"><div class="region-sheet-head"><i class="swatch" aria-hidden="true"></i><h2>${esc(g.name)}</h2><span class="mono">${inGroup.length} 个行业</span></div>${inGroup.map(industryRow).join("")}</section>`
          : "";
      }).join("") || '<div class="empty-state">没有符合条件的行业，可以换个关键词。</div>'
    );
  rows = [...rows].sort((a, b) =>
    state.indSort === "name"
      ? a.name.localeCompare(b.name, "zh")
      : (industryScore(b, catalog, state.region, data)[state.indSort] ?? -1) - (industryScore(a, catalog, state.region, data)[state.indSort] ?? -1),
  );
  return rows.length ? `<div class="region-sheet">${rows.map(industryRow).join("")}</div>` : '<div class="empty-state">没有符合条件的行业，可以换个关键词。</div>';
}
function industriesPage() {
  return `${pageHead({ crumbs: [["行业"]], title: "行业", desc: "八个板块、二十六个行业。看商业模式、产业链、公司样本与细分岗位；图幅编号对应总览地图上的位置。" })}
  <div class="toolbar"><span class="count">${catalog.industries.length} 个行业</span><label class="sr-only" for="ind-filter">筛选行业</label><input id="ind-filter" placeholder="筛选：如 新能源、医院、物流" value="${esc(state.indQuery)}" /><label class="sr-only" for="industry-sort">排序</label><select id="industry-sort"><option value="catalog" ${state.indSort === "catalog" ? "selected" : ""}>按板块</option><option value="score" ${state.indSort === "score" ? "selected" : ""}>按统计参考指数</option><option value="observedCoverage" ${state.indSort === "observedCoverage" ? "selected" : ""}>按统计依据完整度</option><option value="name" ${state.indSort === "name" ? "selected" : ""}>按名称</option></select></div>
  <p class="evidence-note">指数只使用可核对统计，未验证的研究判断不加分。中国细分行业共用国家统计局门类工资，不能据此区分细分岗位的好坏。<a href="#/data">计算方法 →</a></p>
  <div id="ind-list">${industryList()}</div>`;
}
const fredMap = { software: "USINFO", ai: "USINFO", telecom: "USINFO", chips: "MANEMP", machines: "MANEMP", mobility: "MANEMP", materials: "MANEMP", pharma: "MANEMP", health: "USEHS", education: "USEHS", finance: "USFIRE", professional: "USPBS", science: "USPBS", construction: "USCONS", property: "USFIRE", hospitality: "USLAH", public: "USGOVT", media: "USINFO", creative: "USINFO" };
function industryPage(id) {
  const i = industryById(id);
  if (!i) return notFound("这个行业");
  const g = groupOf(id),
    s = industryScore(i, catalog, state.region, data),
    roles = catalog.roles.filter((r) => r.industryId === id),
    wages = source("nbs-wages")?.value?.sectors?.[i.cnWageIndustry],
    fred = source("fred-" + fredMap[id]);
  const wageBlock =
    state.region === "CN"
      ? `<section class="panel spaced"><h2>工资背景 · ${esc(i.cnWageIndustry)}</h2><p class="source-line">${source("nbs-wages")?.value?.year ?? "—"} 年 · 人民币/年 · 门类均值可能包含多个细分行业，不是岗位起薪。</p><div class="table-wrap"><table><thead><tr><th>单位类型</th><th class="num">本期年均工资</th><th class="num">上期年均工资</th><th class="num">名义同比</th></tr></thead><tbody>${[
          ["private", "城镇私营单位"],
          ["nonprivate", "城镇非私营单位"],
        ]
          .map(([key, label]) => `<tr><th scope="row">${label}</th><td class="num">${num(wages?.[key]?.wage)}</td><td class="num">${num(wages?.[key]?.previous)}</td><td class="num">${wages?.[key]?.growth === undefined ? "—" : num(wages[key].growth, 1) + "%"}</td></tr>`)
          .join("")}</tbody></table></div><a class="text-link" href="${esc(safeURL(source("nbs-wages")?.url ?? ""))}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px">国家统计局原表 ↗</a></section>`
      : fred?.value
        ? `<section class="panel spaced"><h2>更宽行业的月度就业背景</h2><p class="source-line">${esc(fred.title)} · 单位：千人 · 不是 ${esc(i.name)} 专属统计，不进入细分行业评分</p>${lineChart([{ name: fred.title.replace("FRED / BLS：", ""), values: fred.value.slice(-36) }], { unit: "千人", label: fred.title })}<p class="source-line">${freshness(fred).label} · 观测到 ${esc(latest(fred.value)?.date)} · <a href="${esc(safeURL(fred.url))}" target="_blank" rel="noopener">源数据 ↗</a></p></section>`
        : "";
  return `${pageHead({
    crumbs: [["行业", "#/industries"], [i.name]],
    title: esc(i.name),
    desc: esc(i.summary),
    extra: `<p class="sheet-title" style="margin-top:10px">${swatch(id)}<span class="tag">${esc(g?.name || "")}</span><span class="tag">图幅 ${gridRef(PLACES[id])}</span><span class="tag">${esc(i.category)}</span></p>`,
  })}
  <div class="cols-2"><section class="panel"><h2>这个行业靠什么赚钱</h2><p>${esc(i.businessModel)}</p><div class="chip-row">${(i.cities?.[state.region] ?? []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div><p class="note">城市为编辑观察入口，不代表当前招聘数量。</p></section>
  <section class="panel"><h2>统计参考</h2><div class="stat-big">${s.score ?? "—"} <small>/ 100</small></div><p class="note">${s.evidenceGroups} 组统计口径 · ${s.scoredRoles} / ${s.roleCount} 个岗位有评分依据。${s.score === null ? "数据不足，暂不评分。" : "共用统计的方向先合并，不把目录条目数当作证据数量。"}</p><a class="text-link" href="#/data" style="display:inline-block;margin-top:8px">查看完整方法 →</a></section></div>
  <section class="panel spaced"><h2>沿着产业链，把工作串起来</h2><div class="chain" style="--n:${i.chain.length}">${i.chain
    .map(
      (c, k) =>
        `<div class="chain-step"><span class="mono">${String(k + 1).padStart(2, "0")}</span><h3>${esc(c.stage)}</h3><p>${esc(c.description)}</p><div class="chip-row">${(c.roles || [])
          .map(roleById)
          .filter(Boolean)
          .map((r) => `<a class="chip" href="#/role/${r.id}">${esc(r.title)}</a>`)
          .join("")}</div></div>`,
    )
    .join("")}</div></section>
  ${industryResearchHTML(i.id, research)}
  <div class="cols-2 spaced"><section class="panel"><h2>增长可能由什么驱动</h2>${list(i.drivers)}</section><section class="panel"><h2>进入之前，留意这些约束</h2>${list(i.risks)}</section></div>
  <section class="panel spaced"><h2>接下来要观察的变量</h2>${list(i.watch)}</section>
  ${wageBlock}
  ${policiesHTML(policies, state.region, i.id)}
  <section class="section">${sectionHead("行业里的不同工作", "看任务、门槛和可展示的成果；最多选三个岗位横向对比。")}${roleGrid(roles)}</section>
  <section class="panel section"><h2>做选择前，核实这三件事</h2>${list(i.decisionChecklist || i.watch)}<h3>机构样本</h3><div class="companies">${(i.companies?.[state.region] || [])
    .map((c) => `<a class="company" href="${esc(safeURL(c.url))}" target="_blank" rel="noopener" title="${esc(c.note)}">${esc(c.name)} ↗</a>`)
    .join("")}</div><p class="note">示例机构用于理解用人场景，不代表正在招聘或推荐雇主。岗位等级、团队任务和招聘条件以官方入口为准。</p></section>`;
}

/* ---------- 岗位 ---------- */
function roleMatches(r, q) {
  return [
    r.title,
    industryFor(r).name,
    r.industryId === "ai" ? "AI 人工智能" : "",
    r.id === "civilservice" ? "考公 考编 公务员" : "",
    r.summary,
    ...r.skills,
    ...r.majors.map((id) => majorById(id)?.name),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q.toLowerCase());
}
function rolesPage() {
  const m = majorById(state.major);
  let roles = catalog.roles.filter(
    (r) => (!m || m.roleIds.includes(r.id)) && (!state.industryId || r.industryId === state.industryId) && (!state.query || roleMatches(r, state.query)),
  );
  if (state.roleSort === "score")
    roles = [...roles].sort(
      (a, b) => (scoreRole(b, industryFor(b), state.region, data).score ?? -1) - (scoreRole(a, industryFor(a), state.region, data).score ?? -1),
    );
  const alsoInd = state.query ? catalog.industries.filter((i) => i.name.includes(state.query)) : [];
  return `${pageHead({ crumbs: [["岗位"]], title: "岗位", desc: `${catalog.roles.length} 个岗位研究条目。按行业、专业和关键词筛选，比较工作内容与入门准备。` })}
  <div class="toolbar"><span class="count">${roles.length} 个匹配</span><label class="sr-only" for="role-industry">行业</label><select id="role-industry"><option value="">全部行业</option>${catalog.industries
    .map((i) => `<option value="${i.id}" ${state.industryId === i.id ? "selected" : ""}>${esc(i.name)}</option>`)
    .join("")}</select><label class="sr-only" for="role-major">专业</label><select id="role-major"><option value="">全部专业</option>${majorOptions(state.major)}</select><label class="sr-only" for="role-sort">排序</label><select id="role-sort"><option value="catalog" ${state.roleSort === "catalog" ? "selected" : ""}>按目录顺序</option><option value="score" ${state.roleSort === "score" ? "selected" : ""}>按统计参考指数</option></select>${
    state.query ? `<button class="button subtle" type="button" data-clear-search>清除搜索「${esc(state.query)}」×</button>` : ""
  }</div>
  ${alsoInd.length ? `<p class="note" style="margin:-6px 0 14px">也匹配行业：${alsoInd.map((i) => `<a href="#/industry/${i.id}">${esc(i.name)}</a>`).join("、")}</p>` : ""}
  <p class="evidence-note" style="margin:0 0 16px">以下为职业研究资料，不代表正在招聘。统计参考只概括已有统计背景；专业关联不等于符合招聘资格。</p>
  ${roleGrid(roles.slice(0, state.limit), "没有找到匹配岗位，试试更宽的专业或关键词。")}${
    roles.length > state.limit ? `<div class="more"><button class="button" type="button" id="more-roles">继续查看 ${Math.min(24, roles.length - state.limit)} 个岗位</button></div>` : ""
  }`;
}
function wageText(obs) {
  if (!obs.record) return "暂无同口径数据";
  if (state.region === "CN") return `${num(obs.record.wage)} 元/年 · ${obs.period} 年行业均值`;
  return `${num(obs.record.medianWage)}${obs.record.wageCensored ? "及以上" : ""} 美元/年 · ${obs.source.value.wageYear} 年职业中位数`;
}
function dimensionBars(s) {
  return `<div class="dimensions">${s.dimensions
    .map(
      (d) =>
        `<div class="dimension"><span>${d.name} · ${d.weight}%</span><span class="bar">${d.value !== null ? `<span class="${d.kind === "研究判断" ? "editorial" : ""}" style="width:${d.value}%"></span>` : ""}</span><span>${d.value === null ? "缺失" : Math.round(d.value)}</span></div>`,
    )
    .join("")}</div>`;
}
function roleOutcomeHTML(role) {
  const evidence = roleOutcomes(outcomes, role, state.region);
  if (!evidence.length) return "";
  return `<section class="panel spaced"><h2>哪些专业的毕业生进入这个职业</h2><p class="source-line">分母是相应学科的已就业学位持有人，不是该职业的员工构成，也不是今年毕业生的录用概率。</p><div class="table-wrap"><table><thead><tr><th>学科样本</th><th>从事对应职业的比例</th><th>统计期</th></tr></thead><tbody>${evidence
    .map(({ group: g, row: r }) => `<tr><td><a href="${esc(safeURL(g.source.url))}" target="_blank" rel="noopener">${esc(g.title)} ↗</a></td><td>${r.share}% · ${esc(r.occupationZh || r.occupation)}</td><td>${esc(g.period)}</td></tr>`)
    .join("")}</tbody></table></div></section>`;
}
function rolePage(id) {
  const r = roleById(id);
  if (!r) return notFound("这个岗位");
  const i = industryFor(r),
    s = scoreRole(r, i, state.region, data),
    obs = s.observation,
    j = r.jobReality,
    selected = state.compare.includes(r.id);
  const majors = r.majors.map(majorById).filter(Boolean);
  const next = r.transition.map(roleById).filter(Boolean);
  return `${pageHead({
    crumbs: [["岗位", "#/roles"], [i.name, `#/industry/${i.id}`], [r.title]],
    title: esc(r.title),
    extra: `<p class="sheet-title" style="margin-top:8px">${swatch(i.id)}<a href="#/industry/${i.id}">${esc(i.name)}</a>${state.region === "US" && r.soc ? `<span class="tag">SOC ${esc(r.soc)}</span>` : ""}<button class="button${selected ? "" : " primary"}" type="button" data-compare="${r.id}" aria-pressed="${selected}" style="margin-left:6px">${selected ? "已选 ✓" : "＋ 对比"}</button></p>`,
  })}
  <div class="role-layout"><div>
    <p class="lead">${esc(r.summary)}</p>
    <div class="cols-2 spaced"><section class="panel"><h2>日常具体在做什么</h2>${list(r.daily)}<h3>需要积累的能力</h3><div class="chip-row">${r.skills.map((k) => `<span class="chip">${esc(k)}</span>`).join("")}</div></section>
    <section class="panel"><h2>先核对，怎样才能开始</h2><p>${esc(r.regions?.[state.region]?.entry ?? r.entry)}</p><p class="note"><strong>学历与资格：</strong>${esc(r.regions?.[state.region]?.credential ?? r.education)}</p><h3>用一个小项目验证兴趣</h3><p>${esc(r.portfolio)}</p></section></div>
    ${
      j
        ? `<section class="panel spaced"><h2>工作成果与入门路线</h2><div class="detail-grid"><div><h4>通常交付什么</h4>${list(j.deliverables)}</div><div><h4>可以怎样准备</h4>${list(j.entryRoutes)}</div></div></section>
    <section class="panel spaced"><h2>同一岗位，不同公司有什么差别</h2><p class="source-line">岗位研究框架，用于核对具体团队，不是对所有雇主的概括。</p><div class="table-wrap"><table><thead><tr><th>公司 / 组织类型</th><th>工作重点</th><th>选择时核对</th></tr></thead><tbody>${j.companyTypes
      .map((x) => `<tr><th scope="row">${esc(x.type)}</th><td>${esc(x.work)}</td><td>${esc(x.tradeoff)}</td></tr>`)
      .join("")}</tbody></table></div><h3>面试或从业者访谈时可以问</h3>${list(j.interviewChecks)}</section>`
        : ""
    }
    ${roleOutcomeHTML(r)}
    <div class="cols-2 spaced"><section class="panel"><h2>AI 更容易覆盖的任务</h2>${list(r.ai.automated)}</section><section class="panel"><h2>与 AI 协作，仍值得积累什么</h2>${list(r.ai.complement)}</section></div>
    <section class="panel spaced"><h2>研究判断的理由</h2>${Object.entries(r.rubric)
      .map(([k, v]) => `<p><strong>${{ moat: "职业壁垒", ai: "AI 互补", access: "入门可行" }[k]}：</strong>${esc(v.reason)}</p>`)
      .join("")}<p class="note">研究判断是阅读参考，目前不参与指数计分。</p></section>
    ${policiesHTML(policies, state.region, r.industryId)}
    <section class="panel spaced"><h2>可能的相邻方向</h2><div class="next-trail"><span class="here">${esc(r.title)}</span>${next
      .map((x) => `<span class="seg" aria-hidden="true"></span><a class="button" href="#/role/${x.id}">${esc(x.title)}</a>`)
      .join("")}</div><p class="note">相邻方向是探索建议，不代表无需学习或资格即可转岗。</p></section>
  </div>
  <aside class="rail">
    <section class="panel"><h2>统计参考指数</h2><div class="stat-big">${s.score ?? "—"} <small>/ 100</small></div><p class="note">${esc(s.evidenceLabel)}。${s.score !== null ? `有效统计贡献 ${s.coverage}% 权重，其余权重按中性参考值 50 计算。` : "有效统计依据不足，暂不显示指数。"}</p>${dimensionBars(s)}<details><summary>缺失资料如何影响分数</summary><p class="source-line">缺失保持为空；只在合成指数时把缺失权重放在 50。完整资料下可能范围 ${s.lower ?? "—"}–${s.upper ?? "—"}，不是预测区间。</p>${s.issues.map((x) => `<p class="source-line">${esc(x)}</p>`).join("")}</details></section>
    <section class="panel"><h2>统计背景 · ${esc(obs.kind)}</h2><p class="stat-big" style="font-size:17px;line-height:1.5">${esc(wageText(obs))}</p>${
      state.region === "US" && obs.record
        ? `<p class="note">SOC ${esc(r.soc)} · ${esc(obs.record.name)}<br>${esc(obs.period)} 就业变化预测 ${num(obs.record.growth, 1)}%；年均开放机会 ${num(obs.record.openings)} 人，含替代需求。</p>`
        : `<p class="note">统计门类：${esc(i.cnWageIndustry)}。整个门类均值，不是${esc(r.title)}的薪资报价。</p>`
    }<p class="note">${state.region === "US" ? "SOC 为广义职业代理，不能代表所有细分岗位；工资为中位数。" : "行业均值受到城市、岗位和经验构成影响，私营与非私营单位须分开看。"}不是应届生起薪，也不预测个人收入。来源状态：${freshness(obs.source).label} · 上次有效获取 ${esc(dateLabel(obs.source?.lastSuccess))}</p><a class="text-link" href="${esc(safeURL(obs.source?.url ?? ""))}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px">核对原始统计表 ↗</a></section>
    ${majors.length ? `<section class="panel"><h2>相关专业</h2><div class="chip-row">${majors.map((m) => `<a class="chip" href="#/major/${m.id}">${esc(m.name)}</a>`).join("")}</div><p class="note">目录关联，用于探索；具体专业要求以招聘公告为准。</p></section>` : ""}
  </aside></div>`;
}

/* ---------- 专业 ---------- */
function majorsPage() {
  const cats = [...new Set(catalog.majors.map((m) => m.category))];
  const withData = catalog.majors.filter((m) => majorEvidence(outcomes, m.id, state.region).length).length;
  return `${pageHead({ crumbs: [["专业"]], title: "专业", desc: `${catalog.majors.length} 个专业类别。每个专业有课程基础、三条职业路线、读研取舍；${withData} 个专业接入了${regions[state.region]}的毕业去向表。` })}
  ${cats
    .map(
      (c) =>
        `<section class="major-cat"><h2>${esc(c)}<span class="mono">${catalog.majors.filter((m) => m.category === c).length}</span></h2><div class="major-index">${catalog.majors
          .filter((m) => m.category === c)
          .map((m) => {
            const has = majorEvidence(outcomes, m.id, state.region).length;
            return `<a class="major-tile" href="#/major/${m.id}"><strong>${esc(m.name)}</strong><span>${m.roleIds.length} 个岗位${has ? `<span class="tag ok">去向表</span>` : ""}</span></a>`;
          })
          .join("")}</div></section>`,
    )
    .join("")}
  <p class="evidence-note section">去向表来自 BLS 学科职业分布（美国）与高校官方就业质量报告（中国大陆）。学校、年份和分母分别保留，单校结果不外推全国。</p>`;
}
function majorPage(id) {
  const m = majorById(id);
  if (!m) return notFound("这个专业");
  const counts = routeCounts(m),
    route = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const guide = majorGuideHTML(m.id, catalog, research, outcomes, state.region);
  return `${pageHead({
    crumbs: [["专业", "#/majors"], [m.name]],
    title: esc(m.name),
    desc: `细分方向：${m.directions.map(esc).join(" · ")}`,
    extra: `<p class="sheet-title" style="margin-top:8px"><span class="tag">${esc(m.category)}</span><span class="tag">${m.roleIds.length} 个关联岗位</span><span class="tag">${route.length} 个行业</span></p>`,
  })}
  <div class="atlas-layout"><section class="map-sheet"><div class="map-sheet-head"><h2>这个专业通往哪些行业</h2><span class="mono">起点：${esc(m.name)}</span></div>${mapSheet("major-map-frame", m.name + "的专业路线")}</section>
  <div class="atlas-side"><section class="panel"><h2>路线上的行业</h2><ul class="route-list">${route
    .map(([iid, n]) => `<li><a href="#/industry/${iid}">${esc(industryById(iid).name)}</a><span class="mono">${n} 个岗位</span></li>`)
    .join("")}</ul><p class="note">${esc(m.advice)}</p></section></div></div>
  ${guide || ""}
  <section class="section">${sectionHead(`${esc(m.name)}的岗位入口`, "目录中的相关岗位；受监管职业仍须取得对应教育与当地资格。")}${roleGrid(majorRoles(m))}</section>`;
}

/* ---------- 路线 ---------- */
function planPage() {
  const ranked = rankPreferredRoles(catalog, state.region, data, state.prefs);
  return `${pageHead({ crumbs: [["路线"]], title: "路线规划", desc: "先核对专业关联与真实统计，再比较具体岗位的要求，最后下载一份四周行动计划。" })}
  <div class="plan-layout"><section class="panel"><h2>我的起点</h2><form id="match-form" class="plan-form"><div class="field"><label for="pref-major">专业 / 学习背景</label><select id="pref-major"><option value="">还不确定 / 不限专业</option>${majorOptions(state.prefs.major)}</select></div><div class="field"><label for="pref-priority">排序依据</label><select id="pref-priority"><option value="" ${!state.prefs.priorities.length ? "selected" : ""}>相关方向，按目录顺序</option><option value="pay" ${state.prefs.priorities.includes("pay") ? "selected" : ""}>${state.region === "CN" ? "行业薪资统计优先" : "职业薪资统计优先"}</option></select></div><div class="actions"><button class="button primary" type="submit">更新路线</button><button class="button" type="button" id="save-prefs">只在这台设备保存</button><button class="button subtle" type="button" id="reset-prefs">清除偏好</button></div></form><p class="note">先列出与所选专业关联的方向，再按所选统计排序；同口径数值相同则并列。工时、录用难度与院校背景优势的数据正在补充，目前不参与排序。中国行业均薪不是岗位报价。</p></section>
  <section>${sectionHead("岗位与准备计划", `${regions[state.region]} · 查看具体要求后再作选择`, `<button class="button" type="button" id="download-plan">下载四周计划</button>`)}<div class="role-grid">${ranked
    .slice(0, 8)
    .map(({ role, assessment }) => roleCard(role, { preference: assessment }))
    .join("")}</div><p class="evidence-note">医学、法律、教育等岗位有额外学历或资格要求；能否报考、能否被录用，需要分别核实。</p></section></div>
  <section class="section">${sectionHead("公共部门与报考路径", "资格和岗位条件以当年、当地官方公告为准", "", "public-paths")}<div class="public-grid">${catalog.publicPaths
    .filter((p) => p.region === state.region)
    .map(
      (p) =>
        `<article class="panel public-card"><h2>${esc(p.title)}</h2><p>${esc(p.summary)}</p><ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><h4>报名前逐项核对</h4>${list(p.checks)}<a class="text-link" href="${esc(safeURL(p.url))}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px">官方信息入口 ↗</a></article>`,
    )
    .join("")}</div></section>`;
}

/* ---------- 数据 ---------- */
function sourcePeriod(s) {
  const v = s.value;
  if (v?.indicators) return [...new Set(v.indicators.map((x) => x.period))].join(" / ");
  if (!v) return "暂无";
  if (v.period) return v.period;
  if (v.year) return String(v.year);
  if (Array.isArray(v)) return v.at(-1)?.date ?? "按公告";
  if (v.CN || v.US) return ["CN", "US"].map((r) => `${regions[r]} ${v[r]?.[0]?.year ?? "—"}–${v[r]?.at(-1)?.year ?? "—"}`).join(" / ");
  return "详见原表";
}
function trendPanel() {
  const items = macroIndicators().filter((x) => x.series.length >= 2);
  const item = items.find((x) => x.id === state.trendIndicator) || items[0];
  if (!item) return "";
  return `<section class="panel section"><div class="trend-head"><div><h2 style="margin:0">近期变化</h2><p class="source-line">同一指标、相同口径的历史观测</p></div><label class="sr-only" for="trend-indicator">选择趋势指标</label><select id="trend-indicator">${items
    .map((x) => `<option value="${x.id}" ${x.id === item.id ? "selected" : ""}>${esc(x.label)}</option>`)
    .join("")}</select></div>${lineChart([{ name: item.label, values: item.series.slice(-24) }], { unit: item.unit, label: item.label + " " + item.changeLabel })}<p class="source-line">${esc(item.changeLabel)} · ${esc(item.unit)}；${
    state.region === "CN" ? "数据点来自逐月官方发布，缺失月份不补值；GDP 只有累计观测，暂不绘制趋势。" : "显示最近 24 个已获取月份。"
  }增速变化不等于规模变化，也不直接代表招聘增长。</p><details><summary>查看各期数值与来源</summary><div class="table-wrap"><table><thead><tr><th>统计期</th><th class="num">${esc(item.unit)}</th><th>来源</th></tr></thead><tbody>${item.series
    .slice(-24)
    .map((x) => `<tr><td>${esc(x.date)}</td><td class="num">${num(x.value, 1)}</td><td><a href="${esc(safeURL(x.url || item.url))}" target="_blank" rel="noopener">${x.publishedAt ? "发布 " + esc(x.publishedAt) : "BLS / FRED"}</a></td></tr>`)
    .join("")}</tbody></table></div></details></section>`;
}
function dataPage() {
  const nbs = source("nbs-wages")?.value,
    bls = source("bls")?.value;
  const inds = catalog.industries.map((i) => ({ ...i, ...industryScore(i, catalog, state.region, data) })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const statuses = Object.values(data.sources).map((s) => freshness(s));
  const okCount = statuses.filter((f) => f.tone === "ok").length;
  return `${pageHead({ crumbs: [["数据"]], title: "数据台账", desc: `${Object.keys(data.sources).length} 路官方来源，每 6 小时检查一次。采集时间与统计所属期分开记录；抓取失败时保留原值和原获取时间。` })}
  ${strip()}
  ${trendPanel()}
  <div class="cols-2 section"><section class="panel"><h2>年度历史背景</h2>${["CN", "US"]
    .map((r) => {
      const g = latest(annual("gdpGrowth", r)),
        u = latest(annual("unemployment", r));
      return `<h3>${regions[r]}</h3><p>实际 GDP 增长 ${num(g?.value, 2)}%（${esc(g?.year)} 年）；ILO 模型估计失业率 ${num(u?.value, 2)}%（${esc(u?.year)} 年）。宏观增长提供背景，不能直接推导某个专业的就业结果。</p>`;
    })
    .join("")}</section><section class="panel"><h2>再把机会拆到岗位</h2><p>AI、能源、医疗等行业内部，研发、交付、生产、销售和支持岗位的门槛与发展路径各不相同。先比较实际工作内容，再看分数。</p><p>职业开放机会包含替代离职者的需求，“机会多”不一定意味着扩张快；高工资也可能反映更长的培养期。</p><p>本期没有足够可比的行业盈利、AI 专属资本开支与人均净利润数据，这些维度保留缺失。</p></section></div>
  <section class="section">${sectionHead(`${regions[state.region]} · 行业探索索引`, "按去重后的统计组汇总，只在同一地区内参考，不做跨国排名")}<div class="table-wrap"><table><thead><tr><th>行业</th><th class="num">统计参考指数</th><th class="num">统计依据</th><th class="num">有分岗位 / 目录岗位</th></tr></thead><tbody>${inds
    .map((i) => `<tr><td><a href="#/industry/${i.id}">${esc(i.name)}</a></td><td class="num">${i.score ?? "不足以评分"}</td><td class="num">${i.evidenceGroups} 组</td><td class="num">${i.scoredRoles} / ${i.roleCount}</td></tr>`)
    .join("")}</tbody></table></div><p class="note">中国工资期 ${esc(nbs?.year ?? "缺失")} 年；美国职业预测期 ${esc(bls?.period ?? "缺失")}，工资期 ${esc(bls?.wageYear ?? "缺失")} 年。所有值来自当前有效快照。</p></section>
  <section class="panel section"><h2>官方最新发布</h2><p class="source-line">以下是发布日期，不是所有统计值的观测期</p><ul class="release-list">${(source("nbs-news")?.value ?? [])
    .slice(0, 8)
    .map((n) => `<li><time>${esc(n.date)}</time><a href="${esc(safeURL(n.url))}" target="_blank" rel="noopener">${esc(n.title)} ↗</a></li>`)
    .join("")}</ul></section>
  ${policiesHTML(policies, state.region)}
  ${evidenceLibraryHTML(outcomes, state.region)}
  <div class="downloads"><a class="button primary" href="./data/report.md" download="向野-中美行业观察.md">下载完整报告</a><button class="button" type="button" id="print-report">打印 / 保存 PDF</button><a class="button" href="./data/observations.json" download>下载数据快照 JSON</a></div>
  <section class="section">${sectionHead("来源台账", `${okCount} / ${statuses.length} 路采集正常；其余显示沿用快照或待刷新`, "", "sources-ledger")}<div class="table-wrap"><table><thead><tr><th>统计来源</th><th>数据所属期</th><th>发布频率</th><th>上次有效获取</th><th>状态</th></tr></thead><tbody>${Object.values(data.sources)
    .map((s) => {
      const f = freshness(s);
      return `<tr><td><a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener">${esc(s.title)} ↗</a></td><td>${esc(sourcePeriod(s))}</td><td>${esc(s.frequency || "年度")}</td><td class="mono">${esc(dateLabel(s.lastSuccess))}</td><td><span class="tag ${f.tone === "warn" ? "warn" : "ok"}">${f.label}</span></td></tr>`;
    })
    .join("")}</tbody></table></div></section>
  <section class="section">${sectionHead("统计参考指数怎么算", "", `<a class="text-link" href="https://github.com/leon1111-wgl/career-atlas/blob/main/docs/SCORING.md" target="_blank" rel="noopener">完整方法与代码 ↗</a>`)}
  <div class="method-grid"><section class="panel"><h3>统计数据与研究判断分开看</h3><p>中国目前使用行业工资及其同比，美国使用职业预测与薪酬。未经真实样本支持的职业壁垒、AI 互补和准入难度暂停数值计分，保留为阅读参考。</p><div class="table-wrap"><table><thead><tr><th>维度</th><th class="num">权重</th><th>依据</th></tr></thead><tbody>${DIMENSIONS.map(
    ([k, n, w]) =>
      `<tr><td>${n}</td><td class="num">${w}%</td><td>${{ growth: "美国十年职业就业变化预测", pay: "同一地区、同口径工资相对全国基准", payGrowth: "中国行业工资名义同比", profit: "可比盈利资料不足，暂留缺失", moat: "尚无可比样本，暂停计分", ai: "尚无可比样本，暂停计分", access: "尚无招聘竞争样本，暂停计分" }[k]}</td></tr>`,
  ).join("")}</tbody></table></div></section>
  <section class="panel"><h3>资料少，分数也要克制</h3><p>指数以 50 为中性参考，只让已有依据推动分数上移或下移。缺失资料保留为空，不推算工资或就业人数；只在指数合成时，缺失权重停留在中性参考值。</p><div class="method-formula">50 + Σ［权重 ×（已知维度分 − 50）］</div><p>至少两个有效统计指标、合计权重至少 35% 才显示统计参考指数。统计数据距今超过两年、年份无效或口径不明时不参与计算。分数是探索工具，不是录用概率。</p><p>行业汇总先合并共用的统计组，再取均值；重复添加同一岗位不会增加证据。</p></section>
  <section class="panel"><h3>报告如何进入分析</h3><p>毕业去向表提取为专业、职业分布、统计年和样本范围，进入专业页与资料咨询。去向比例说明常见路径，不代表专业对口率、应届起薪或进入成功率。</p><p>政策原文与岗位影响分开记录：先看实施状态，再看资金、项目、订单与招聘是否兑现。政策不直接加分。</p><p>美国的职业分布只用于美国；中国院校报告保留学校和毕业届别，不能外推为全国专业结果。</p></section>
  <section class="panel"><h3>几个容易混淆的数字</h3><p>年均开放岗位含退休、离开职业与转岗形成的替代需求，已移出指数，仍作为职业规模背景展示。</p><p>中国行业平均工资和美国职业工资中位数都不是应届生起薪；两国指数不横向排名。工业产量增长、融资额或公司资本开支也不能直接当作岗位增长。</p><p>权重和归一化尺度由项目设定；分数只概括已有统计背景，不是经过就业结果验证的预测。</p></section></div></section>
  <details class="panel spaced"><summary>政策核对记录</summary>${(policies?.sources || [])
    .map(
      (s) =>
        `<p class="source-line"><a href="${esc(safeURL(s.url))}" target="_blank" rel="noopener">${esc(s.title)} ↗</a> · ${esc({ ok: "核对成功", cached: "保留已核对资料", reviewed: "人工核对", unavailable: "暂不可用", error: "待重试" }[s.status] || "待核对")} · ${esc(s.lastSuccess ? dateLabel(s.lastSuccess) : "待核对")}</p>`,
    )
    .join("")}</details>
  <details class="panel spaced"><summary>资料助手与开源参考</summary><p class="source-line">助手从本站的统计、专业研究和政策资料中检索依据。可选在设备上加载语言模型，问题保留在当前设备。<a href="https://github.com/leon1111-wgl/career-atlas/blob/main/docs/MODEL_CARD.md" target="_blank" rel="noopener">技术说明 ↗</a></p><div class="resource-grid">${ecosystem.projects
    .map((p) => `<article class="resource-card"><h3><a href="${esc(safeURL(p.url))}" target="_blank" rel="noopener">${esc(p.name)} ↗</a></h3><p>${esc(p.why)}</p></article>`)
    .join("")}</div></details>
  <p class="note">发现数据问题可以在 <a href="https://github.com/leon1111-wgl/career-atlas/issues" target="_blank" rel="noopener">GitHub Issues</a> 反馈。</p>`;
}
function notFound(what) {
  return `<div class="empty-state"><h1>没有找到${what}</h1><p>链接可能已经过期。</p><p style="margin-top:12px"><a class="button" href="#/atlas">回到总览</a></p></div>`;
}

/* ---------- Routing ---------- */
const LEGACY = { overview: "atlas", careers: "roles", match: "plan", reports: "data", sources: "data", public: "plan" };
const ROUTE_HEADS = new Set([...Object.keys(TABS), ...Object.keys(LEGACY), "industry", "role", "major"]);
/** null means an in-page anchor such as #main or #how, which the router leaves alone. */
function parseRoute() {
  const raw = decodeURIComponent(location.hash.slice(1)),
    h = raw.replace(/^\//, "");
  if (!h) return { view: "cover" };
  const [head, arg] = h.split(/[=/]/);
  if (!ROUTE_HEADS.has(head)) return raw.startsWith("/") ? { view: "atlas", tab: "atlas" } : null;
  const tab = LEGACY[head] || head;
  if (["industry", "role", "major"].includes(tab) && arg) return { view: tab, id: arg, tab: { industry: "industries", role: "roles", major: "majors" }[tab] };
  if (TABS[tab]) return { view: tab, tab, anchor: head === "public" ? "public-paths" : head === "sources" ? "sources-ledger" : "" };
  return { view: "atlas", tab: "atlas" };
}
const VIEWS = { atlas: atlasPage, industries: industriesPage, roles: rolesPage, majors: majorsPage, plan: planPage, data: dataPage, industry: industryPage, role: rolePage, major: majorPage };
function render() {
  // A typed in-page anchor (#main) keeps the current view, so its controls still re-render.
  const r = parseRoute() || (state.route.tab ? state.route : { view: "cover" });
  state.route = r;
  if (r.view === "major" && majorById(r.id)) state.trailMajor = r.id;
  if (r.view === "cover") {
    document.documentElement.dataset.view = "cover";
    renderCover();
    return;
  }
  document.documentElement.dataset.view = "console";
  $("#main").innerHTML = VIEWS[r.view](r.id);
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === r.tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const h1 = $("#page-title")?.textContent;
  document.title = `${h1 && h1 !== TABS[r.tab] ? h1 + " · " : ""}${TABS[r.tab] || "图册"} · 向野 Career Atlas`;
  updateCompare();
  if (r.anchor) requestAnimationFrame(() => document.getElementById(r.anchor)?.scrollIntoView());
}
function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

/* ---------- Map callouts ---------- */
function showCallout(wp) {
  const frame = wp.closest(".map-frame") || $("#cover-map-frame"),
    box = frame?.querySelector(".map-callout");
  if (!box || matchMedia("(max-width: 640px)").matches) return;
  const id = wp.dataset.wp,
    i = industryById(id),
    m = majorById(state.trailMajor),
    n = routeCounts(m)[id] || 0,
    roles = catalog.roles.filter((r) => r.industryId === id);
  frame.querySelectorAll(".wp.hot").forEach((x) => x.classList.remove("hot"));
  wp.classList.add("hot");
  box.innerHTML = `<h3>${esc(i.name)}</h3><span class="mono">图幅 ${gridRef(PLACES[id])} · ${esc(groupOf(id)?.name)} · ${roles.length} 个岗位</span><p>${esc(i.summary.length > 64 ? i.summary.slice(0, 64) + "…" : i.summary)}</p>${m ? `<p style="color:var(--trail-ink);margin-top:4px">${n ? `${esc(m.name)}：${n} 个相关岗位` : `不在${esc(m.name)}的目录路线上`}</p>` : ""}`;
  box.hidden = false;
  const f = frame.getBoundingClientRect(),
    w = wp.querySelector(".wp-ring").getBoundingClientRect();
  let left = w.right - f.left + 14,
    top = w.top - f.top - 16;
  if (left + 290 > f.width) left = w.left - f.left - 294;
  top = Math.max(0, Math.min(top, f.height - box.offsetHeight));
  box.style.left = Math.max(0, left) + "px";
  box.style.top = top + "px";
}
function hideCallout(wp) {
  const frame = wp.closest(".map-frame") || $("#cover-map-frame");
  frame?.querySelector(".map-callout")?.setAttribute("hidden", "");
  wp.classList.remove("hot");
}
document.addEventListener("mouseover", (e) => {
  const wp = e.target.closest?.(".wp");
  if (wp) showCallout(wp);
});
document.addEventListener("mouseout", (e) => {
  const wp = e.target.closest?.(".wp");
  if (wp && !wp.contains(e.relatedTarget)) hideCallout(wp);
});
document.addEventListener("focusin", (e) => {
  const wp = e.target.closest?.(".wp");
  if (wp) showCallout(wp);
});
document.addEventListener("focusout", (e) => {
  const wp = e.target.closest?.(".wp");
  if (wp) hideCallout(wp);
});

/* ---------- Compare, toast, downloads ---------- */
function updateCompare() {
  const bar = $("#compare-bar");
  bar.hidden = !state.compare.length;
  bar.innerHTML = `<span>已选 ${state.compare.length} / 3 个岗位</span><button class="button primary" type="button" id="show-compare">横向对比</button><button class="text-link" type="button" id="clear-compare">清空</button>`;
  document.querySelectorAll("[data-compare]").forEach((b) => {
    const yes = state.compare.includes(b.dataset.compare);
    b.setAttribute("aria-pressed", yes);
    b.textContent = yes ? "已选 ✓" : "＋ 对比";
  });
}
function dialogHeader(title, sub) {
  return `<header class="dialog-header"><div><span class="eyebrow">${esc(sub)}</span><h2 id="detail-title">${esc(title)}</h2></div><button class="icon-button" type="button" data-close="detail-dialog" aria-label="关闭">×</button></header>`;
}
function showCompare() {
  const roles = state.compare.map(roleById).filter(Boolean);
  if (roles.length < 2) {
    toast("先选择至少两个岗位");
    return;
  }
  const rows = [
    ["行业", (r) => esc(industryFor(r).name)],
    ["统计参考指数", (r) => {
      const s = scoreRole(r, industryFor(r), state.region, data);
      return `${s.score ?? "—"} /100；${esc(s.evidenceLabel)}`;
    }],
    ["统计薪资背景", (r) => `${esc(wageText(roleObservation(r, industryFor(r), state.region, data)))}<br><span class="source-line">${state.region === "US" ? "SOC 广义职业代理，中位数" : "整个行业门类均值，受城市、岗位和经验构成影响"}；不是应届起薪</span>`],
    ["日常任务", (r) => list(r.daily)],
    ["交付成果", (r) => list(r.jobReality?.deliverables || r.daily)],
    ["公司类型差异", (r) => list(r.jobReality?.companyTypes.map((x) => x.type + "：" + x.work) || [])],
    ["进入要求", (r) => esc(r.regions?.[state.region]?.credential ?? r.education)],
    ["关键能力", (r) => list(r.skills)],
    ["练习与作品", (r) => esc(r.portfolio)],
    ["AI 互补", (r) => list(r.ai.complement)],
  ];
  $("#detail-content").innerHTML = `${dialogHeader("岗位对比", regions[state.region] + " · 岗位对比")}<div class="dialog-body"><p class="note" style="margin:0 0 6px">同一行业中的岗位也可能有不同门槛。统计薪资是背景代理，不能推断个人 offer。</p><div class="table-wrap"><table class="comparison-table"><thead><tr><th>比较维度</th>${roles
    .map((r) => `<th><a href="#/role/${r.id}" data-close="detail-dialog">${esc(r.title)}</a></th>`)
    .join("")}</tr></thead><tbody>${rows.map(([name, fn]) => `<tr><th scope="row">${name}</th>${roles.map((r) => `<td>${fn(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
  $("#detail-dialog").scrollTop = 0;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 3200);
}
function download(text, filename, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadPlan() {
  const roles = rankPreferredRoles(catalog, state.region, data, state.prefs)
    .slice(0, 3)
    .map((x) => x.role);
  const major = majorById(state.prefs.major);
  const lines = [
    "# 向野 · 我的四周职业探索计划",
    "整理：Leon Wang",
    "",
    `地区：${regions[state.region]}；专业：${major?.name ?? "未限定"}；基于 ${catalog.reviewedAt} 目录。`,
    "",
    "这是根据明确偏好生成的实践建议，不是录用预测。",
    "",
  ];
  for (const r of roles) {
    const s = scoreRole(r, industryFor(r), state.region, data);
    lines.push(
      `## ${r.title}`,
      `统计参考：${s.score ?? "证据不足"}；统计依据：${s.statisticalCount}项。专业关联不等于招聘资格或录用概率。`,
      "",
      `日常：${r.daily.join("；")}`,
      `进入要求：${r.regions?.[state.region]?.credential ?? r.education}`,
      `实践：${r.portfolio}`,
      "",
    );
  }
  lines.push(
    "## 四周行动",
    "1. 第一周：在目标城市收集至少10条真实岗位要求，记录任务、学历、经验和工资口径；不把重复广告当新增岗位。",
    "2. 第二周：约谈1-2名从业者，用日常任务清单核实加班、出差、培养与晋升。",
    "3. 第三周：选一个岗位完成最小项目，写清自己的贡献和结果。",
    "4. 第四周：根据反馈调整目标，比较进入成本和生活安排，再决定投递/学习计划。",
    "",
    "请到官方渠道核对职业资格和当年招聘条件。",
  );
  download(lines.join("\n"), "向野-我的职业探索计划.md");
}

/* ---------- Assistant ---------- */
const evidenceURL = (url) => (url.startsWith("#") ? url : safeURL(url));
function evidenceHTML(evidence) {
  return `<div class="chat-evidence">本次检索依据（${regions[state.region]}）：${evidence
    .map(
      (d, i) =>
        `<a href="${esc(evidenceURL(d.url))}" ${d.url.startsWith("#") ? "data-evidence-internal" : 'target="_blank" rel="noopener"'}>[${i + 1}] ${esc(d.title)} · ${
          ["official-fact", "macro-fact", "graduate-fact"].includes(d.kind) ? "官方统计" : d.kind === "recruitment-fact" ? "官方招聘条件" : d.kind === "public-path" ? "官方入口" : d.kind === "policy-fact" ? "政策原文与分析" : "研究资料"
        }</a>`,
    )
    .join("")}</div>`;
}
function appendChat(kind, text) {
  const el = document.createElement("div");
  el.className = "chat-bubble " + kind;
  el.textContent = text;
  $("#chat-log").append(el);
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  return el;
}
async function openAssistant() {
  if (!$("#assistant-dialog").open) $("#assistant-dialog").showModal();
  $("#chat-input").focus();
  if (!state.modelLoaded && !(await ModelClient.available()))
    $("#model-status").textContent = "当前浏览器未提供 WebGPU。资料检索可直接使用；本地模型需要兼容设备。";
}
async function loadModel() {
  if (state.generating) return;
  $("#load-model").disabled = true;
  $("#model-progress").hidden = false;
  $("#unload-model").hidden = false;
  $("#unload-model").textContent = "取消加载";
  $("#model-status").textContent = "正在检查设备并加载模型文件…";
  try {
    await model.load((p) => {
      $("#model-progress").value = p.progress || 0;
      $("#model-status").textContent = `正在加载 ${Math.round((p.progress || 0) * 100)}% · 首次需要下载模型，完成后浏览器可缓存`;
    });
    state.modelLoaded = true;
    $("#model-status").textContent = "本机模型已就绪 · 问题留在当前设备";
    $("#load-model").hidden = true;
    $("#unload-model").textContent = "卸载并释放内存";
    $("#send-chat").textContent = "整理";
  } catch (e) {
    state.modelLoaded = false;
    $("#model-status").textContent = e.message;
    $("#unload-model").hidden = true;
  } finally {
    $("#load-model").disabled = false;
    $("#model-progress").hidden = true;
  }
}
async function unloadModel() {
  await model.unload();
  state.modelLoaded = false;
  state.generating = false;
  $("#load-model").hidden = false;
  $("#load-model").disabled = false;
  $("#unload-model").hidden = true;
  $("#model-progress").hidden = true;
  $("#model-status").textContent = "模型已停止，运行内存已释放。已下载文件由浏览器缓存管理。";
  $("#send-chat").textContent = "查询";
  $("#send-chat").disabled = false;
  $("#stop-chat").hidden = true;
}
async function ask(question) {
  if (state.generating) return;
  question = question.trim().slice(0, 500);
  if (!question) return;
  $("#chat-input").value = "";
  appendChat("user", question);
  const result = advise(question, catalog, data, state.region, intentModel, { research, outcomes, policies, recruitment });
  const evidence = result.evidence;
  const bubble = appendChat("assistant", "");
  const label = document.createElement("div");
  label.className = "answer-label";
  label.textContent = state.modelLoaded ? "资料整理" : `资料咨询 · ${result.label}`;
  bubble.append(label);
  const answer = document.createElement("div");
  bubble.append(answer);
  if (!result.sections.length) {
    answer.textContent = "当前资料中没有找到足够相关的依据。可以补充一个行业、专业或岗位名称，我会继续帮你找。";
    return;
  }
  answer.className = "structured-answer";
  answer.innerHTML =
    result.sections
      .map(
        (section) =>
          `<section><h3>${esc(section.title)} ${evidence.some((d) => d.id === section.source) ? `<small>[${evidence.findIndex((d) => d.id === section.source) + 1}]</small>` : ""}</h3>${list(section.items)}</section>`,
      )
      .join("") + `<p class="note">${esc(result.note)}</p>`;
  if (!state.modelLoaded || !evidence.length) {
    if (evidence.length) bubble.insertAdjacentHTML("beforeend", evidenceHTML(evidence));
    $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
    return;
  }
  state.generating = true;
  $("#send-chat").disabled = true;
  $("#stop-chat").hidden = false;
  label.textContent = "正在核对补充资料…";
  try {
    const task = evidenceTask(question, evidence);
    const full = await model.generate(task.messages, () => (label.textContent = "正在核对补充资料…"), task.schema);
    const selected = selectEvidence(full, task.choices);
    label.textContent = `资料整理 · ${result.label}`;
    answer.insertAdjacentHTML("beforeend", `<details><summary>模型选中的补充依据</summary>${selected.map((c) => `<p>[${c.docIndex + 1}] ${esc(c.text)}</p>`).join("")}</details>`);
  } catch {
    label.textContent = `保留已查到的资料 · ${result.label}`;
    state.modelLoaded = model.loaded;
    if (!model.loaded) {
      $("#load-model").hidden = false;
      $("#unload-model").hidden = true;
      $("#send-chat").textContent = "查询";
      $("#model-status").textContent = "模型未就绪，可重新加载。";
    }
  } finally {
    state.generating = false;
    $("#send-chat").disabled = false;
    $("#stop-chat").hidden = true;
    bubble.insertAdjacentHTML("beforeend", evidenceHTML(evidence));
    $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
  }
}

/* ---------- Theme ---------- */
const THEME_LABEL = { system: "外观：跟随系统", light: "外观：浅色", dark: "外观：深色" };
function currentTheme() {
  return document.documentElement.dataset.theme || "system";
}
function syncThemeButtons() {
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
    b.setAttribute("aria-label", THEME_LABEL[currentTheme()] + "，点击切换");
    b.title = THEME_LABEL[currentTheme()];
  });
}
function cycleTheme() {
  const next = { system: "light", light: "dark", dark: "system" }[currentTheme()];
  if (next === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  try {
    if (next === "system") localStorage.removeItem("career-atlas-theme");
    else localStorage.setItem("career-atlas-theme", next);
  } catch {}
  syncThemeButtons();
  toast(THEME_LABEL[next]);
}

/* ---------- Events ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("button,a");
  if (!b) return;
  if (b.classList.contains("skip-link") || b.getAttribute("href") === "#how") {
    e.preventDefault();
    const target = b.classList.contains("skip-link") ? (document.documentElement.dataset.view === "console" ? $("#main") : $("#cover-main")) : $("#how");
    target.focus({ preventScroll: true });
    target.scrollIntoView();
    return;
  }
  if (b.hasAttribute("data-theme-toggle")) return cycleTheme();
  if (b.dataset.region) {
    state.region = b.dataset.region;
    render();
    return;
  }
  if (b.dataset.industry) return go("#/industry/" + b.dataset.industry);
  if (b.dataset.role) {
    if ($("#detail-dialog").open) $("#detail-dialog").close();
    return go("#/role/" + b.dataset.role);
  }
  if (b.dataset.majorLink) return go("#/major/" + b.dataset.majorLink);
  if (b.dataset.compare) {
    const id = b.dataset.compare;
    if (state.compare.includes(id)) state.compare = state.compare.filter((x) => x !== id);
    else if (state.compare.length < 3) state.compare.push(id);
    else toast("最多同时对比三个岗位，请先取消一个");
    updateCompare();
    return;
  }
  if (b.dataset.close) {
    const target = b.getAttribute("href");
    if (!target) e.preventDefault();
    $("#" + b.dataset.close).close();
    return;
  }
  if (b.hasAttribute("data-evidence-internal")) {
    $("#assistant-dialog").close();
    return;
  }
  if (b.hasAttribute("data-clear-search")) {
    state.query = "";
    $("#search-input").value = "";
    render();
    return;
  }
  if (b.dataset.prompt) {
    ask(b.dataset.prompt);
    return;
  }
  switch (b.id) {
    case "open-assistant":
      openAssistant();
      break;
    case "load-model":
      loadModel();
      break;
    case "unload-model":
    case "stop-chat":
      unloadModel();
      break;
    case "more-roles":
      state.limit += 24;
      render();
      break;
    case "show-compare":
      showCompare();
      break;
    case "clear-compare":
      state.compare = [];
      updateCompare();
      break;
    case "save-prefs":
      try {
        localStorage.setItem("career-atlas-preferences", JSON.stringify({ ...state.prefs, region: state.region }));
        toast("已在当前设备保存偏好");
      } catch {
        toast("浏览器未允许保存，当前选择仍可使用");
      }
      break;
    case "reset-prefs":
      try {
        localStorage.removeItem("career-atlas-preferences");
      } catch {}
      state.prefs = normalizePreferences({});
      render();
      toast("已清除本地偏好");
      break;
    case "download-plan":
      downloadPlan();
      break;
    case "print-report":
      window.print();
      break;
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "trailhead-major") {
    state.trailMajor = t.value;
    renderCover();
  }
  if (t.id === "atlas-major") {
    state.trailMajor = t.value;
    render();
    $("#atlas-major")?.focus();
  }
  if (t.id === "role-industry") {
    state.industryId = t.value;
    state.limit = 24;
    render();
  }
  if (t.id === "role-major") {
    state.major = t.value;
    state.limit = 24;
    render();
  }
  if (t.id === "role-sort") {
    state.roleSort = t.value;
    render();
  }
  if (t.id === "industry-sort") {
    state.indSort = t.value;
    $("#ind-list").innerHTML = industryList();
  }
  if (t.id === "trend-indicator") {
    state.trendIndicator = t.value;
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "ind-filter") {
    state.indQuery = e.target.value;
    $("#ind-list").innerHTML = industryList();
  }
});
document.addEventListener("submit", (e) => {
  const id = e.target.id;
  if (id === "trailhead") {
    e.preventDefault();
    state.trailMajor = $("#trailhead-major").value;
    go(state.trailMajor ? "#/major/" + state.trailMajor : "#/atlas");
  }
  if (id === "global-search") {
    e.preventDefault();
    const query = $("#search-input").value.trim();
    if (!query) return;
    const ind = catalog.industries.find((i) => i.name === query);
    if (ind) return go("#/industry/" + ind.id);
    const role = catalog.roles.find((r) => r.title === query);
    if (role) return go("#/role/" + role.id);
    const major = resolveMajor(catalog, query);
    if (major) {
      state.query = "";
      return go("#/major/" + major.id);
    }
    state.query = query;
    state.industryId = "";
    state.major = "";
    state.limit = 24;
    go("#/roles");
  }
  if (id === "match-form") {
    e.preventDefault();
    state.prefs = normalizePreferences({ major: $("#pref-major").value, priorities: [$("#pref-priority").value] });
    render();
  }
  if (id === "chat-form") {
    e.preventDefault();
    ask($("#chat-input").value);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) && !$("dialog[open]")) {
    if (document.documentElement.dataset.view !== "console") return;
    e.preventDefault();
    $("#search-input").focus();
  }
  if (e.key === "Enter" && !e.shiftKey && e.target.id === "chat-input") {
    e.preventDefault();
    ask(e.target.value);
  }
});
window.addEventListener("hashchange", () => {
  if (!parseRoute() && state.route.view) return;
  render();
  if (!state.route.anchor) window.scrollTo({ top: 0, behavior: "instant" });
  if (state.route.view !== "cover") $("#main").focus({ preventScroll: true });
});
window.addEventListener("pagehide", () => model.interrupt());

async function init() {
  syncThemeButtons();
  fetch(new URL("./intent-model.json", import.meta.url))
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((m) => (intentModel = m))
    .catch(() => {});
  try {
    [catalog, data, ecosystem, research, outcomes, policies, recruitment] = await Promise.all(
      ["catalog.json", "observations.json", "ecosystem.json", "research.json", "graduate-outcomes.json", "policies.json", "recruitment-evidence.json"].map(async (p) => {
        const r = await fetch(new URL("./data/" + p, import.meta.url), { cache: "no-cache" });
        if (!r.ok) throw new Error("数据文件暂不可用");
        return r.json();
      }),
    );
    render();
  } catch (e) {
    document.documentElement.dataset.view = "console";
    $("#main").innerHTML = `<div class="empty-state"><h1>资料暂时没有加载完成</h1><p>${esc(e.message)}。请刷新页面，或稍后再试。</p><p style="margin-top:12px"><button class="button" type="button" onclick="location.reload()">重新加载</button></p></div>`;
  }
}
init();
