import {
  scoreRole,
  industryScore,
  fitScore,
  roleObservation,
  freshness,
  DIMENSIONS,
} from "./scoring.js";
import { sparkline, lineChart } from "./charts.js?v=20261016-neutral";
import { advise } from "./advisor.js";
import { ModelClient } from "./model.js";
import { evidenceTask, selectEvidence } from "./grounded.js";
const $ = (s, root = document) => root.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const safeURL = (u) => (/^https:\/\//.test(u) ? u : "#sources");
const num = (n, d = 0) =>
  typeof n === "number" && Number.isFinite(n)
    ? n.toLocaleString("zh-CN", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      })
    : "—";
const list = (items) =>
  `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
const saved = () => {
  try {
    return JSON.parse(localStorage.getItem("career-atlas-preferences") || "{}");
  } catch {
    return {};
  }
};
const state = {
  region: saved().region === "US" ? "US" : "CN",
  page: "overview",
  query: "",
  sector: "all",
  industryId: "",
  roleSort: "catalog",
  category: "全部",
  major: "",
  majorCategory: "全部",
  sort: "score",
  limit: 24,
  compare: [],
  prefs: { major: "", priority: "balanced", ...saved() },
  trendIndicator: "unemployment",
  modelLoaded: false,
  generating: false,
};
let intentModel = null;
let catalog,
  data,
  ecosystem,
  reportText,
  toastTimer,
  model = new ModelClient();
const regions = { CN: "中国大陆", US: "美国" },
  pageNames = {
    overview: "首页",
    industries: "行业分类",
    careers: "专业与岗位",
    match: "职业定位",
    reports: "研究资讯",
    sources: "数据与方法",
  };
const iconMap = {
  software: "⌘",
  ai: "✳",
  chips: "▦",
  machines: "⚙",
  mobility: "↗",
  power: "ϟ",
  materials: "◈",
  mining: "◇",
  construction: "⌂",
  property: "▥",
  environment: "♧",
  agri: "♧",
  health: "+",
  pharma: "⌬",
  finance: "▥",
  professional: "§",
  commerce: "▧",
  logistics: "⇄",
  hospitality: "☷",
  education: "▤",
  media: "▣",
  creative: "◌",
  science: "⌬",
  public: "▥",
  personal: "✂",
  telecom: "◎",
};
const industryFor = (r) =>
  catalog.industries.find((i) => i.id === r.industryId);
const source = (k) => data.sources[k];
const annual = (key, region = state.region) =>
  source("wb-" + key)?.value?.[region] ?? [];
const latest = (rows) => rows?.at(-1);
const dateLabel = (s) =>
  s
    ? new Date(s).toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "暂无";
function toolbar() {
  return `<div class="page-toolbar"><span class="update-note"><i class="status-dot"></i>最近采集 ${esc(dateLabel(data.attemptedAt))} · UTC+8</span><div class="region-switch" role="group" aria-label="选择分析地区">${Object.entries(
    regions,
  )
    .map(
      ([k, v]) =>
        `<button data-region="${k}" class="${state.region === k ? "active" : ""}" aria-pressed="${state.region === k}">${v}</button>`,
    )
    .join("")}</div></div>`;
}
function heading(title, desc) {
  return `<div class="hero"><h1>${title}</h1><p>${desc}</p></div>`;
}
function metric(
  label,
  value,
  unit,
  sub,
  foot,
  rows = [],
  symbol = "↗",
  url = "#sources",
) {
  return `<a class="metric" href="${esc(url)}"><div class="metric-label">${label}<span class="metric-symbol">${symbol}</span></div><div class="metric-number">${value}<small>${unit}</small></div><div class="metric-sub">${sub}</div><div class="metric-foot"><span>${foot}</span>${sparkline(rows)}</div></a>`;
}
function industryCard(industry) {
  const s = industryScore(industry, catalog, state.region, data),
    roles = catalog.roles.filter((r) => r.industryId === industry.id);
  return `<button class="industry-card" data-industry="${industry.id}"><div class="industry-card-top"><div><h3>${esc(industry.name)}</h3><span class="industry-category">${roles.length}个岗位方向 · ${esc(industry.cities?.[state.region]?.slice(0, 3).join(" / ") || regions[state.region])}</span></div><span class="score-pill">探索指数 ${s.score ?? "—"}</span></div><p class="industry-summary">${esc(industry.summary)}</p><div class="chip-row">${roles
    .slice(0, 3)
    .map((r) => `<span class="chip">${esc(r.title)}</span>`)
    .join(
      "",
    )}</div><div class="industry-card-foot"><span>统计与判断覆盖 ${s.coverage}%</span><span>产业链 / 公司 / 岗位</span></div></button>`;
}
function scoreNote() {
  return `<p class="section-note"><strong>如何看这个分数：</strong>指数结合统计指标与编辑判断，行业分为目录中典型岗位的均值；覆盖率包含两类指标。仅用于同一地区的探索排序，缺失项与主观量规均可查看，<a href="#sources" class="text-link">了解计算方法 ↗</a></p>`;
}
function roleCard(role, { fit = false } = {}) {
  const industry = industryFor(role),
    s = scoreRole(role, industry, state.region, data),
    selected = state.compare.includes(role.id),
    reality = role.jobReality;
  return `<article class="role-card">${fit ? `<div class="fit-line"><span>偏好规则匹配</span><strong>${fitScore(role, state.prefs)} / 100</strong></div>` : ""}<div class="role-card-header"><div><h3><button class="role-title" data-role="${role.id}">${esc(role.title)}</button></h3><span class="minor">${esc(industry.name)} · ${regions[state.region]}</span></div><span class="score-pill">探索指数 ${s.score ?? "待补"}</span></div><div class="role-main"><div><p class="role-summary">${esc(reality?.deliverables?.[0] || role.daily[0])}</p><div class="chip-row">${role.skills
    .slice(0, 4)
    .map((k) => `<span class="chip">${esc(k)}</span>`)
    .join(
      "",
    )}</div></div><div class="entry-column"><span class="minor">入门准备</span><p>${esc(reality?.entryRoutes?.[0] || role.entry)}</p></div></div><div class="role-card-footer"><span class="minor">${esc(
    reality?.companyTypes
      ?.slice(0, 2)
      .map((x) => x.type)
      .join(" / ") || "不同公司职责不同",
  )} · 指标覆盖 ${s.coverage}%</span><span><button class="button subtle" data-compare="${role.id}" aria-pressed="${selected}">${selected ? "已选" : "加入比较"}</button><button class="button" data-role="${role.id}">岗位详情</button></span></div></article>`;
}
function macroIndicators() {
  if (state.region === "CN")
    return source("cn-current")?.value?.indicators || [];
  return [
    ["unemployment", "失业率（季调）", "fred-UNRATE", "%"],
    ["payroll", "非农就业人数（季调）", "fred-PAYEMS", "千人"],
  ].flatMap(([id, label, key, unit]) => {
    const s = source(key),
      series = s?.value || [],
      x = latest(series);
    return x
      ? [
          {
            id,
            label,
            value: x.value,
            unit,
            period: x.date.slice(0, 7),
            frequency: "月度",
            changeLabel: "当月水平",
            url: s.url,
            publishedAt: null,
            series,
            status: s.status,
          },
        ]
      : [];
  });
}
function currentStrip() {
  const items = macroIndicators();
  if (!items.length)
    return '<p class="evidence-note">最新指标暂不可用，请查看数据与方法中的来源状态。</p>';
  const years = items.map((x) => x.period.match(/\d{4}/)?.[0]).filter(Boolean);
  return `<section class="latest-strip"><div class="latest-heading"><h2>${esc(regions[state.region])} · ${esc(years.sort().at(-1))} 最新数据</h2><a href="#reports">查看趋势与统计口径 →</a></div><div class="latest-grid" ${state.region === "US" ? 'style="grid-template-columns:repeat(2,minmax(0,1fr))"' : ""}>${items.map((x) => `<a class="latest-item" href="${esc(safeURL(x.url))}" target="_blank" rel="noopener"><span>${esc(x.label)}</span><strong>${num(x.value, 1)}<small>${esc(x.unit)}</small></strong><small>${esc(x.period)} · ${esc(x.changeLabel)}</small><small>${x.publishedAt ? "发布 " + esc(x.publishedAt) : "来源 BLS / FRED；发布时间未提供"}${(x.status || source("cn-current")?.status) === "cached" ? " · 沿用缓存" : ""}</small>${sparkline(x.series.slice(-12), "#6485a9")}</a>`).join("")}</div><p class="section-note">${state.region === "CN" ? "来源：国家统计局。各指标按实际发布节奏更新；上半年 GDP 为累计同比，其他指标口径见各项。" : "来源：BLS / FRED。美国月度数据为季调值，可能修订。"} 短线图仅显示已采集的历史点。</p></section>`;
}
function currentTrend() {
  const items = macroIndicators().filter((x) => x.series.length >= 2);
  const item = items.find((x) => x.id === state.trendIndicator) || items[0];
  if (!item) return "";
  return `<section class="panel current-trends"><div class="section-heading"><div><h2>近期变化</h2><p>同一指标、相同口径的历史观测</p></div><select id="trend-indicator" aria-label="选择趋势指标">${items.map((x) => `<option value="${x.id}" ${x.id === item.id ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></div><div class="chart-container">${lineChart([{ name: item.label, values: item.series.slice(-24), color: "#6485a9" }], { unit: item.unit, label: item.label + " " + item.changeLabel })}</div><p class="trend-caption">${esc(item.changeLabel)} · ${esc(item.unit)}；${state.region === "CN" ? "数据点来自逐月官方发布，缺失月份不补值。GDP 目前只有一个已核验的累计观测，暂不绘制趋势。" : "显示最近24个已获取月份。"} 增速变化不等于规模变化，也不直接代表招聘增长。</p><details><summary>查看各期数值与来源</summary><div class="table-wrap"><table><thead><tr><th>统计期</th><th>${esc(item.unit)}</th><th>来源</th></tr></thead><tbody>${item.series
    .slice(-24)
    .map(
      (x) =>
        `<tr><td>${esc(x.date)}</td><td>${num(x.value, 1)}</td><td><a href="${esc(safeURL(x.url || item.url))}" target="_blank" rel="noopener">${x.publishedAt ? "发布 " + esc(x.publishedAt) : "BLS / FRED"}</a></td></tr>`,
    )
    .join("")}</tbody></table></div></details></section>`;
}
function researchSidebar() {
  const item = macroIndicators().find((x) => x.id === "unemployment");
  const metrics = item
    ? lineChart(
        [
          {
            name: item.label,
            values: item.series.slice(-12),
            color: "#6485a9",
          },
        ],
        { unit: "%", label: item.label + "近期趋势", height: 220 },
      )
    : '<p class="section-note">历史数据不足</p>';
  const news = source("nbs-news")?.value || [];
  return `<aside class="portal-aside"><section class="side-panel"><div class="side-title"><h2>就业趋势</h2><a href="#reports">看趋势</a></div>${metrics}<p class="section-note">${state.region === "US" ? "来源：BLS / FRED，季调月度失业率。" : "来源：国家统计局，全国城镇调查失业率。"}<br>统计期见每项，采集于 ${dateLabel(data.attemptedAt)}。</p></section><section class="side-panel"><div class="side-title"><h2>官方发布</h2><a href="#reports">全部</a></div><ul class="news-list">${news
    .slice(0, 5)
    .map(
      (n) =>
        `<li><a href="${esc(safeURL(n.url))}" target="_blank" rel="noopener">${esc(n.title)}</a><time>${esc(n.date)}</time></li>`,
    )
    .join(
      "",
    )}</ul><p class="section-note">国家统计局公开发布；标题不代表就业预测。</p></section><section class="side-panel"><h2>求职核对工具</h2><ul class="side-links"><li><a href="#match">专业与岗位匹配</a><span>选择背景与偏好</span></li><li><button id="top-assistant">岗位问题咨询</button><span>本地资料库与轻量模型</span></li><li><a href="#sources">评分依据与数据来源</a><span>查看缺失项与统计口径</span></li></ul></section><p class="author-signature">职业研究资料 / Leon Wang</p></aside>`;
}
function overview() {
  const groups = [
    ["互联网与数字技术", ["software", "ai", "telecom"]],
    ["工业与工程技术", ["chips", "machines", "mobility", "materials"]],
    ["能源与基础建设", ["power", "mining", "construction", "property"]],
    ["医疗与生命科学", ["health", "pharma", "science"]],
    ["商业与专业服务", ["finance", "professional", "commerce"]],
    ["教育与文化创意", ["education", "media", "creative"]],
    ["公共与生活服务", ["public", "personal", "hospitality"]],
    ["农业与供应链", ["agri", "environment", "logistics"]],
  ];
  const roleIds = [
    "agent",
    "mechanical",
    "nurse",
    "accountant",
    "ecommerce",
    "planner",
    "civilservice",
    "electrician",
  ];
  let roles = roleIds.map((id) => catalog.roles.find((r) => r.id === id));
  if (state.industryId || state.major)
    roles = catalog.roles.filter(
      (r) => !state.industryId || r.industryId === state.industryId,
    );
  if (state.major) roles = roles.filter((r) => r.majors.includes(state.major));
  return `${toolbar()}${currentStrip()}<section class="category-directory"><div class="directory-heading"><h2>行业分类</h2><a class="text-link" href="#industries">查看26个行业</a></div><div class="directory-grid">${groups
    .map(
      ([name, ids]) =>
        `<div class="directory-group"><h3>${name}</h3><div>${ids
          .map((id) => {
            const i = catalog.industries.find((i) => i.id === id);
            return `<button data-industry="${id}">${esc(i.name)}</button>`;
          })
          .join("")}</div></div>`,
    )
    .join(
      "",
    )}</div></section><div class="page-shortcuts"><a href="#industry/ai"><strong>人工智能岗位专题</strong><span>应用开发、研究与数据工程的区别</span></a><a href="#careers"><strong>按专业找方向</strong><span>44个专业族与相邻职业</span></a><a href="#public"><strong>考公与公共部门</strong><span>报考条件、岗位类型与核对入口</span></a><a href="#reports"><strong>经济与行业动态</strong><span>最近发布、历史趋势与统计口径</span></a></div><div class="portal-layout"><section class="results-column"><div class="filter-panel"><div class="filter-row"><span class="filter-label">行业</span><div class="filter-selects"><select id="home-industry" aria-label="按行业筛选"><option value="">各行业典型岗位</option>${catalog.industries.map((i) => `<option value="${i.id}" ${state.industryId === i.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select><label for="home-major">所学专业</label><select id="home-major"><option value="">不限专业</option>${catalog.majors.map((m) => `<option value="${m.id}" ${state.major === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div></div></div><div class="results-heading"><h2>${state.industryId ? "相关岗位" : "岗位方向"}</h2><span>${roles.length}个研究条目 · 可选2—3个比较</span><a href="#careers" class="text-link">全部111个岗位</a></div><p class="result-disclaimer">以下为职业研究资料。职责、入门准备与公司情境用于求职核对，不代表正在招聘。</p><div class="role-grid">${roles.map((r) => roleCard(r)).join("") || '<div class="empty-state">暂无对应条目，可放宽专业或行业筛选。</div>'}</div></section>${researchSidebar()}</div>`;
}
function industries() {
  const cats = ["全部", ...new Set(catalog.industries.map((i) => i.category))];
  let rows = catalog.industries.filter(
    (i) =>
      (state.category === "全部" || i.category === state.category) &&
      (!state.query ||
        JSON.stringify(i).toLowerCase().includes(state.query.toLowerCase())),
  );
  rows.sort((a, b) =>
    state.sort === "name"
      ? a.name.localeCompare(b.name, "zh")
      : (industryScore(b, catalog, state.region, data)[state.sort] ?? -1) -
        (industryScore(a, catalog, state.region, data)[state.sort] ?? -1),
  );
  return `${toolbar()}${heading("行业分类", "查看商业模式、产业链、公司样本与细分岗位。")}<div class="filters"><span class="micro-label">${rows.length} 个行业</span><select id="industry-sort" aria-label="行业排序"><option value="score" ${state.sort === "score" ? "selected" : ""}>按探索指数</option><option value="coverage" ${state.sort === "coverage" ? "selected" : ""}>按指标覆盖</option><option value="name" ${state.sort === "name" ? "selected" : ""}>按名称</option></select>${state.query ? `<button class="button subtle" data-clear-search>清除搜索「${esc(state.query)}」×</button>` : ""}</div><div class="filter-chips">${cats.map((c) => `<button data-category="${esc(c)}" class="${c === state.category ? "active" : ""}">${esc(c)}</button>`).join("")}</div>${scoreNote()}<div class="industry-grid">${rows.map(industryCard).join("") || '<div class="empty-state">没有符合条件的行业。可以换个关键词或清除筛选。</div>'}</div>`;
}
function careers() {
  const cats = ["全部", ...new Set(catalog.majors.map((m) => m.category))],
    majors = catalog.majors.filter(
      (m) =>
        state.majorCategory === "全部" || m.category === state.majorCategory,
    ),
    selected = catalog.majors.find((m) => m.id === state.major);
  let roles = catalog.roles.filter(
    (r) =>
      (!selected || selected.roleIds.includes(r.id)) &&
      (!state.industryId || r.industryId === state.industryId) &&
      (!state.query ||
        [
          r.title,
          industryFor(r).name,
          r.industryId === "ai" ? "AI 人工智能" : "",
          r.id === "civilservice" ? "考公 考编 公务员" : "",
          r.summary,
          ...r.skills,
          ...r.majors.map(
            (id) => catalog.majors.find((m) => m.id === id)?.name,
          ),
        ]
          .join(" ")
          .toLowerCase()
          .includes(state.query.toLowerCase())),
  );
  return `${toolbar()}${heading("专业与岗位", `${catalog.majors.length} 个专业族，${catalog.roles.length} 个岗位入口。按专业、行业与关键词筛选，比较工作内容和入门准备。`)}<div class="filters"><label for="career-industry">行业</label><select id="career-industry"><option value="">全部行业</option>${catalog.industries.map((i) => `<option value="${i.id}" ${state.industryId === i.id ? "selected" : ""}>${esc(i.name)}</option>`).join("")}</select><label class="micro-label" for="major-category">专业门类</label><select id="major-category">${cats.map((c) => `<option ${c === state.majorCategory ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>${state.query ? `<button class="button subtle" data-clear-search>清除搜索「${esc(state.query)}」×</button>` : ""}</div><div class="filters"><label for="major-select">具体专业</label><select id="major-select"><option value="">全部专业</option>${majors.map((m) => `<option value="${m.id}" ${state.major === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select><span class="section-note">选择专业后查看细分方向与岗位入口</span></div>${selected ? `<div class="major-advice"><strong>${esc(selected.name)}：</strong>${esc(selected.advice)}<p style="margin:8px 0 0">细分方向：${selected.directions.map(esc).join(" · ")}</p></div>` : ""}<div class="section-heading"><div><h2>${selected ? esc(selected.name) + "的岗位入口" : "岗位资料"}</h2><p>${roles.length} 个匹配岗位 · 最多选择三个岗位横向对比</p></div></div><div class="role-grid">${
    roles
      .slice(0, state.limit)
      .map((r) => roleCard(r))
      .join("") ||
    '<div class="empty-state">没有找到匹配岗位，试试更宽的专业或关键词。</div>'
  }</div>${roles.length > state.limit ? `<button class="button show-more" id="more-roles">继续查看 ${Math.min(24, roles.length - state.limit)} 个岗位</button>` : ""}<div id="public-paths" class="section-heading"><div><h2>公共部门与报考路径</h2><p>资格和岗位条件以当年、当地官方公告为准</p></div></div><div class="public-grid">${catalog.publicPaths
    .filter((p) => p.region === state.region)
    .map(
      (p) =>
        `<article class="public-card"><h3>${esc(p.title)}</h3><p>${esc(p.summary)}</p><ol>${p.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><h4>报名前逐项核对</h4>${list(p.checks)}<a href="${esc(safeURL(p.url))}" target="_blank" rel="noopener" class="text-link">进入官方信息入口 ↗</a></article>`,
    )
    .join("")}</div>`;
}
function match() {
  let roles = catalog.roles
    .slice()
    .sort((a, b) => fitScore(b, state.prefs) - fitScore(a, state.prefs));
  return `${toolbar()}${heading("职业定位", "结合所学专业和当前偏好，整理岗位清单与四周准备计划。")}<div class="match-layout"><section class="panel match-controls"><h2>我的探索偏好</h2><p class="section-note">这些选择只用于本页面的透明匹配。</p><form id="match-form"><div class="field"><label for="pref-major">我的专业 / 学习背景</label><select id="pref-major"><option value="">还不确定 / 不限专业</option>${catalog.majors.map((m) => `<option value="${m.id}" ${state.prefs.major === m.id ? "selected" : ""}>${esc(m.name)}</option>`).join("")}</select></div><div class="field"><label for="pref-priority">现阶段，我更看重</label><select id="pref-priority">${[
    ["balanced", "均衡探索"],
    ["moat", "积累专业壁垒"],
    ["ai", "与 AI 协作的空间"],
    ["access", "较容易开始实践"],
  ]
    .map(
      ([id, name]) =>
        `<option value="${id}" ${state.prefs.priority === id ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select></div><button class="button primary" type="submit">更新我的清单 ↗</button><button class="button subtle" type="button" id="save-prefs">仅在这台设备保存偏好</button><button class="button subtle" type="button" id="reset-prefs">清除偏好</button></form><p class="form-note spaced">匹配规则：专业相符 60 分，未选专业 40 分，跨专业 25 分；偏好对应量规贡献最多 40 分。它衡量资料匹配，不预测就业成功。<br>没有收集姓名、联系方式或身份信息。</p></section><section><div class="section-heading" style="margin-top:0"><div><h2>匹配岗位与准备计划</h2><p>${regions[state.region]} · 相同匹配分不代表有优劣之分</p></div><button class="text-link" id="download-plan">下载行动计划 ↗</button></div><div class="role-grid">${roles
    .slice(0, 8)
    .map((r) => roleCard(r, { fit: true }))
    .join(
      "",
    )}</div><div class="evidence-note">跨专业可以探索，但医学、法律、教育等受监管岗位通常有额外学历或资格要求。请在岗位详情中逐项核对。城市分布见行业详情，是产业观察入口，不是当前招聘数量。</div></section></div>`;
}
function reportPage() {
  const nbs = source("nbs-wages")?.value,
    bls = source("bls")?.value;
  const industries = catalog.industries
    .map((i) => ({ ...i, ...industryScore(i, catalog, state.region, data) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return `${toolbar()}${heading("经济与行业动态", "按最近发布的统计期阅读趋势，年度背景与月度变化分开呈现。")}${currentStrip()}${currentTrend()}<div class="report-actions"><a class="button primary" href="./data/report.md" download="向野-中美行业观察.md">下载完整报告 ↓</a><button class="button" id="print-report">打印 / 保存 PDF</button><a class="button subtle" href="./data/observations.json" download>下载数据快照</a></div><div class="evidence-note">报告采用固定统计模板生成，未经模型改写。中国工资期 ${nbs?.year ?? "缺失"} 年；美国职业预测期 ${bls?.period ?? "缺失"}，工资期 ${bls?.wageYear ?? "缺失"} 年。所有值均来自当前有效快照。</div><div class="two-col"><section class="panel report-body"><h2>年度历史背景</h2>${[
    "CN",
    "US",
  ]
    .map((r) => {
      const g = latest(annual("gdpGrowth", r)),
        u = latest(annual("unemployment", r));
      return `<h3>${regions[r]}</h3><p>实际 GDP 增长 ${num(g?.value, 2)}%（${g?.year} 年）；ILO 模型估计失业率 ${num(u?.value, 2)}%（${u?.year} 年）。宏观增长提供背景，不能直接推导某个专业的就业结果。</p>`;
    })
    .join(
      "",
    )}<a class="text-link" href="#sources">查看指标定义与源数据 ↗</a></section><section class="panel report-body"><h2>再把机会拆到岗位</h2><p>AI、能源、医疗等行业内部，研发、交付、生产、销售和支持岗位的门槛与发展路径各不相同。先比较实际工作内容，再看分数。</p><p>职业开放机会包含替代离职者的需求，因此“机会多”不一定意味着扩张快；高工资也可能反映更长的培养期。</p><p>本期没有足够可比的行业盈利、AI 专属资本开支与人均净利润数据，这些维度保留缺失。</p></section></div><div class="section-heading"><div><h2>${regions[state.region]} · 行业探索索引</h2><p>典型岗位样本均值 · 按探索优先指数排序 · 不进行跨国排名</p></div></div><div class="table-wrap"><table><thead><tr><th>行业</th><th>探索指数</th><th>指标覆盖</th><th>有分岗位 / 目录岗位</th></tr></thead><tbody>${industries.map((i) => `<tr><td><button class="text-link" data-industry="${i.id}">${esc(i.name)} ↗</button></td><td>${i.score ?? "不足以评分"}</td><td>${i.coverage}%</td><td>${i.scoredRoles} / ${i.roleCount}</td></tr>`).join("")}</tbody></table></div><div class="section-heading"><div><h2>来自官方的最新发布</h2><p>以下是发布日期，不是所有统计值的观测期</p></div></div><section class="panel"><ul class="release-list">${(
    source("nbs-news")?.value ?? []
  )
    .slice(0, 8)
    .map(
      (n) =>
        `<li><time>${n.date}</time><a href="${esc(safeURL(n.url))}" target="_blank" rel="noopener">${esc(n.title)} ↗</a></li>`,
    )
    .join("")}</ul></section>`;
}
function sourcePeriod(s) {
  const v = s.value;
  if (v?.indicators)
    return [...new Set(v.indicators.map((x) => x.period))].join(" / ");
  if (!v) return "暂无";
  if (v.period) return v.period;
  if (v.year) return String(v.year);
  if (Array.isArray(v)) return v.at(-1)?.date ?? "按公告";
  if (v.CN || v.US)
    return ["CN", "US"]
      .map(
        (r) =>
          `${regions[r]} ${v[r]?.[0]?.year ?? "—"}–${v[r]?.at(-1)?.year ?? "—"}`,
      )
      .join(" / ");
  return "详见原表";
}
function sourcesPage() {
  return `${toolbar()}${heading("数据来源与研究方法", "数据、编辑判断和个人偏好各自回答不同问题。这里记录每条来源的口径、状态与推荐规则。")}<div class="evidence-note">本项目每 6 小时尝试采集一次，源数据按各机构节奏发布。最新抓取不等于最新观测。自动任务可能延迟；始终以本页实际时间和状态为准。</div><div class="table-wrap"><table><thead><tr><th>数据源 / 原始入口</th><th>观测期</th><th>发布频率</th><th>上次有效获取（UTC+8）</th><th>采集状态</th></tr></thead><tbody>${Object.values(
    data.sources,
  )
    .map((s) => {
      const f = freshness(s);
      return `<tr><td><a class="source-row-title" href="${esc(safeURL(s.url))}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>${s.retrieval ? `<p class="section-note" style="margin:4px 0">${esc(s.retrieval)}</p>` : ""}${s.error ? `<p class="section-note" style="margin:4px 0">最近尝试失败；保留旧值。</p>` : ""}</td><td>${esc(sourcePeriod(s))}</td><td>${esc(s.frequency ?? "年度")}</td><td>${esc(dateLabel(s.lastSuccess))}</td><td><span class="source-status ${f.tone === "warn" ? "warn" : ""}">${f.label}</span></td></tr>`;
    })
    .join(
      "",
    )}</tbody></table></div><div class="section-heading"><div><h2>探索优先指数 · 方法 v1</h2><p>先说明它是什么，再看它能帮助你做什么</p></div><a class="text-link" href="https://github.com/leon1111-wgl/career-atlas/blob/main/web/scoring.js" target="_blank" rel="noopener">查看计算代码 ↗</a></div><div class="method-grid"><section class="panel"><h3>统计事实与编辑量规</h3><p>就业、工资来自官方统计；壁垒、AI 互补与入门可行性来自原创编辑量规，是可争论、可修改的主观判断。维度得分经过公开尺度映射，不是训练得到的预测。</p><div class="table-wrap"><table><thead><tr><th>维度</th><th>权重</th><th>计算或缺失情况</th></tr></thead><tbody>${DIMENSIONS.map(([key, name, w]) => `<tr><td>${name}</td><td>${w}%</td><td>${{ growth: "美国十年预测：−10% → 0，20% → 100", openings: "年均开放 / 基期就业：0% → 0，15% → 100", pay: "当地薪资 / 全国同口径基准：0.5倍 → 0，3倍 → 100", payGrowth: "中国行业工资同比：−5% → 0，15% → 100", profit: "首版无同口径完整样本，保持缺失", moat: "编辑 1–5 级 × 20，见每个岗位理由", ai: "编辑 1–5 级 × 20，见每个岗位理由", access: "编辑 1–5 级 × 20，见每个岗位理由" }[key]}</td></tr>`).join("")}</tbody></table></div></section><section class="panel"><h3>缺失不会被“补成一个数字”</h3><div class="method-formula">指数 = Σ（有效得分 × 权重） / Σ有效权重</div><p>各维度映射在 0–100 之间截断。覆盖率不足 50% 时不出总分；统计覆盖单独列示。中国通常只有行业工资相关统计，美国有职业预测与工资，不能直接比较两国指数。</p><p><strong>缺失边界：</strong>把缺失维度分别设为 0 与 100，得到全权重下的可能范围。这是缺失敏感性范围，<strong>不是统计置信区间</strong>。</p><p><strong>行业分：</strong>目录内能评分岗位的简单平均，反映我们选取的岗位样本，不按行业就业人数加权。共用 SOC 或中国门类的细分方向不拥有独立统计数据。</p><p><strong>开放机会：</strong>包含离开职业和转岗形成的替代需求，不是净新增岗位，更不是今天的招聘广告量。</p><p><strong>工资：</strong>中国为城镇单位行业年平均工资，美国为职业年薪中位数；均不是应届生起薪。不跨币种换算排名。</p></section><section class="panel"><h3>怎样使用行业判断框架</h3><p>需求与增长、政策技术、竞争盈利、周期、人才资本都是调查问题。首版将能持续取得的数据纳入评分，其余列为行业详情中的“待观察变量”。</p>${list(["不使用统一渗透率阈值判断所有行业的拐点。", "不把公司总资本开支当作 AI 专属投资；不混用财年、自然年与季度。", "不把行业卖课多、融资热或单家公司利润当作红利期的充分证据。", "不以 MBTI、性别或家庭背景决定适合什么工作。"])}</section><section class="panel"><h3>我们的小模型，如何工作</h3><p>基座：Qwen3 0.6B（MLC 4-bit）；运行时：WebLLM。我们部署模型文件，建立自己的岗位知识库、检索和证据约束。没有宣称从零训练或未经执行的微调。</p><p>模型只在点击加载后下载，在浏览器 WebGPU 上推理；首版采用证据筛选式回答，只展示程序校验过的原文片段。问题不发送到远程推理服务。小模型可能误解或遗漏资料，来源链接由程序单独呈现，不能只凭模型语气判断可信度。</p><p>模型下载约 335 MiB，建议留出约 1.5 GB 图形内存；不支持的设备可继续使用资料检索。停止模型会释放当前运行资源，已缓存文件由浏览器管理。</p><a class="text-link" href="https://github.com/leon1111-wgl/career-atlas/blob/main/docs/MODEL_CARD.md" target="_blank" rel="noopener">阅读模型卡与验证记录 ↗</a></section></div><div class="section-heading"><div><h2>开源同行，怎样被使用</h2><p>星数是 ${esc(ecosystem.checkedAt?.slice(0, 10))} 的 API 快照；受欢迎不等于可靠或适合复制</p></div></div><div class="resource-grid">${ecosystem.projects.map((p) => `<article class="resource-card"><h3><a href="${esc(safeURL(p.url))}" target="_blank" rel="noopener">${esc(p.name)} ↗</a></h3><small>★ ${num(p.stars)} · ${esc(p.license || "未明确许可证")}</small><p>${esc(p.why)}</p><p>${p.id === "mlc-ai/web-llm" ? "已集成：本地推理运行时，保留 Apache 2.0 许可。" : p.name.includes("zhangxuefeng") ? "作为职业提问框架的参考；不运行第三方技能，不冒充本人或声称授权。" : p.name.includes("developer-roadmap") ? "提供外部学习路线入口；遵循其专有许可，不转载路线图内容。" : "作为外部资料入口；项目中的分析和量规为原创，未直接运行或复制该仓库。"}</p></article>`).join("")}</div><p class="section-note">遇到数据问题，可以在 <a class="text-link" href="https://github.com/leon1111-wgl/career-atlas/issues" target="_blank" rel="noopener">GitHub 提交问题 ↗</a>。请附指标、统计期和原始链接，帮助我们复核。</p>`;
}
function render() {
  const hash = decodeURIComponent(location.hash.slice(1));
  let page = hash.split(/[=/]/)[0] || "overview";
  if (page === "industry") page = "industries";
  if (["role", "major", "public"].includes(page)) page = "careers";
  if (!pageNames[page]) page = "overview";
  state.page = page;
  $("#main").innerHTML = {
    overview,
    industries,
    careers,
    match,
    reports: reportPage,
    sources: sourcesPage,
  }[page]();
  $("#breadcrumb-current").textContent = pageNames[page];
  document.querySelectorAll("[data-page]").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === page);
    if (a.dataset.page === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#sidebar").classList.remove("open");
  updateCompare();
  $("#menu-button").setAttribute("aria-expanded", "false");
  if (hash === "public")
    requestAnimationFrame(() => $("#public-paths")?.scrollIntoView());
  if (/^industry[=/]/.test(hash)) showIndustry(hash.split(/[=/]/)[1]);
  else if (/^role[=/]/.test(hash)) showRole(hash.split(/[=/]/)[1]);
  else if (/^major[=/]/.test(hash)) {
    const id = hash.split(/[=/]/)[1];
    state.major = id;
    history.replaceState(null, "", "#careers");
    render();
  } else if ($("#detail-dialog").open) $("#detail-dialog").close();
}
function openDetail(html) {
  $("#detail-content").innerHTML = html;
  if (!$("#detail-dialog").open) $("#detail-dialog").showModal();
  $("#detail-dialog").scrollTop = 0;
}
function dialogHeader(title, sub = "行业观察") {
  return `<header class="dialog-header"><div><span class="eyebrow">${esc(sub)}</span><h2>${esc(title)}</h2></div><button class="icon-button" data-close="detail-dialog" aria-label="关闭详情">×</button></header>`;
}
const fredMap = {
  software: "USINFO",
  ai: "USINFO",
  telecom: "USINFO",
  chips: "MANEMP",
  machines: "MANEMP",
  mobility: "MANEMP",
  materials: "MANEMP",
  pharma: "MANEMP",
  health: "USEHS",
  education: "USEHS",
  finance: "USFIRE",
  professional: "USPBS",
  science: "USPBS",
  construction: "USCONS",
  property: "USFIRE",
  hospitality: "USLAH",
  public: "USGOVT",
  media: "USINFO",
  creative: "USINFO",
};
function showIndustry(id) {
  const i = catalog.industries.find((x) => x.id === id);
  if (!i) {
    toast("未找到该行业");
    return;
  }
  const scores = industryScore(i, catalog, state.region, data),
    roles = catalog.roles.filter((r) => r.industryId === id),
    wages = source("nbs-wages")?.value?.sectors?.[i.cnWageIndustry],
    fred = source("fred-" + fredMap[id]);
  openDetail(
    `${dialogHeader(i.name, regions[state.region] + " / 行业与产业链")}<div class="dialog-body"><p class="detail-intro">${esc(i.summary)}</p><div class="detail-grid"><section class="panel"><h3>这个行业，靠什么赚钱</h3><p>${esc(i.businessModel)}</p><div class="chip-row">${(i.cities[state.region] ?? []).map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div><p class="micro-label" style="margin-bottom:0">城市为编辑观察入口，不能视为当前招聘数量。</p></section><section class="panel"><h3>典型岗位的探索指数</h3><div class="detail-score">${scores.score ?? "—"} <small>/ 100</small></div><p>指标覆盖 ${scores.coverage}% · ${scores.scoredRoles} / ${scores.roleCount} 个岗位可评分。${scores.score === null ? "数据不足，暂不评分。" : "这是目录岗位简单均值，不是整个行业的预测。"}</p><a class="text-link" href="#sources" data-close="detail-dialog">查看完整方法 ↗</a></section></div><div class="section-heading"><h2>沿着产业链，把工作串起来</h2></div><div class="chain">${i.chain.map((s) => `<section class="chain-item"><h4>${esc(s.stage)} →</h4><p>${esc(s.description)}</p></section>`).join("")}</div><div class="detail-grid"><section class="panel"><h3>增长可能由什么驱动</h3>${list(i.drivers)}</section><section class="panel"><h3>进入之前，留意这些约束</h3>${list(i.risks)}</section></div><section class="panel spaced"><h3>接下来要观察的变量</h3>${list(i.watch)}</section>${
      state.region === "CN"
        ? `<section class="panel spaced"><h3>工资背景 · ${esc(i.cnWageIndustry)}</h3><p class="section-note">${source("nbs-wages")?.value?.year} 年 · 人民币/年 · 该门类可能包含多个细分行业；不是岗位起薪。</p><div class="table-wrap"><table><thead><tr><th>单位类型</th><th>本期年均工资</th><th>上期年均工资</th><th>名义同比</th></tr></thead><tbody>${[
            ["private", "城镇私营单位"],
            ["nonprivate", "城镇非私营单位"],
          ]
            .map(
              ([key, label]) =>
                `<tr><td>${label}</td><td>${num(wages?.[key]?.wage)}</td><td>${num(wages?.[key]?.previous)}</td><td>${wages?.[key]?.growth === undefined ? "—" : num(wages[key].growth, 1) + "%"}</td></tr>`,
            )
            .join(
              "",
            )}</tbody></table></div><a href="${esc(safeURL(source("nbs-wages")?.url ?? ""))}" target="_blank" rel="noopener" class="text-link">国家统计局原表 ↗</a></section>`
        : fred?.value
          ? `<section class="panel spaced"><h3>更宽行业的月度就业背景</h3><p class="section-note">${esc(fred.title)} · 单位：千人 · 非 ${esc(i.name)} 专属统计，不进入当前细分行业评分</p>${lineChart([{ name: fred.title.replace("FRED / BLS：", ""), values: fred.value.slice(-36) }], { unit: "千人", label: fred.title })}<p class="chart-caption">${freshness(fred).label} · 观测到 ${latest(fred.value)?.date} · <a href="${esc(safeURL(fred.url))}" target="_blank" rel="noopener">源数据 ↗</a></p></section>`
          : ""
    }<div class="section-heading"><div><h2>行业里，有这些不同的工作</h2><p>看任务、门槛和可展示的成果，选择三个岗位做对比。</p></div></div><div class="role-grid">${roles.map((r) => roleCard(r)).join("")}</div><div class="section-heading"><div><h2>从机构样本理解用人场景</h2><p>示例机构，不代表正在招聘或推荐雇主</p></div></div><section class="panel spaced"><h3>做选择前，核实这三件事</h3>${list(i.decisionChecklist || i.watch)}</section><div class="company-list">${i.companies[state.region].map((c) => `<a class="company" href="${esc(safeURL(c.url))}" target="_blank" rel="noopener" title="${esc(c.note)}">${esc(c.name)} ↗</a>`).join("")}</div><p class="section-note">公司之间的岗位等级、团队任务和招聘条件不同。到官方入口核对，再用岗位详情中的任务清单提问。</p></div>`,
  );
}
function dimensionBars(s) {
  return `<div class="dimensions">${s.dimensions.map((d) => `<div class="dimension"><span>${d.name} · ${d.weight}%</span><span class="bar">${d.value !== null ? `<span class="${d.kind === "编辑判断" ? "editorial" : ""}" style="width:${d.value}%"></span>` : ""}</span><span>${d.value === null ? "缺失" : Math.round(d.value) + " /100"}</span></div>`).join("")}</div>`;
}
function wageText(obs) {
  if (!obs.record) return "暂无同口径数据";
  if (state.region === "CN")
    return `${num(obs.record.wage)} 元/年 · ${obs.period}年行业均值`;
  return `${num(obs.record.medianWage)}${obs.record.wageCensored ? "及以上" : ""} 美元/年 · ${obs.source.value.wageYear}年职业中位数`;
}
function jobRealityHTML(r) {
  const j = r.jobReality;
  if (!j) return "";
  return `<section class="panel spaced"><h3>工作成果与入门路线</h3><div class="detail-grid"><div><h4>通常交付什么</h4>${list(j.deliverables)}</div><div><h4>可以怎样准备</h4>${list(j.entryRoutes)}</div></div></section><section class="panel spaced"><h3>同一岗位，不同公司有什么差别</h3><p class="section-note">以下为岗位研究框架，用于核对具体团队，不是对所有雇主的概括。</p><div class="table-wrap"><table><thead><tr><th>公司 / 组织类型</th><th>工作重点</th><th>选择时核对</th></tr></thead><tbody>${j.companyTypes.map((x) => `<tr><th>${esc(x.type)}</th><td>${esc(x.work)}</td><td>${esc(x.tradeoff)}</td></tr>`).join("")}</tbody></table></div><h4>面试或从业者访谈时可以问</h4>${list(j.interviewChecks)}</section>`;
}
function showRole(id) {
  const r = catalog.roles.find((x) => x.id === id);
  if (!r) {
    toast("未找到该岗位");
    return;
  }
  const i = industryFor(r),
    s = scoreRole(r, i, state.region, data),
    obs = s.observation;
  openDetail(
    `${dialogHeader(r.title, regions[state.region] + " / " + i.name)}<div class="dialog-body"><button class="text-link" data-industry="${i.id}">← 回到行业：${esc(i.name)}</button><p class="detail-intro spaced">${esc(r.summary)}</p><div class="detail-grid"><section class="panel"><h3>日常具体在做什么</h3>${list(r.daily)}<h3 class="spaced">需要积累的能力</h3><div class="chip-row">${r.skills.map((k) => `<span class="chip">${esc(k)}</span>`).join("")}</div></section><section class="panel"><h3>探索优先指数 · 可解释</h3><div class="detail-score">${s.score ?? "—"} <small>/ 100</small></div><p>统计覆盖 ${s.observedCoverage}%；编辑判断 ${s.coverage - s.observedCoverage}%。${s.score !== null ? `缺失敏感性范围 ${s.lower}–${s.upper}，不是置信区间。` : "总覆盖不足 50%，不出总分。"}</p>${dimensionBars(s)}<p class="micro-label">蓝色为统计映射，橙色为编辑量规。</p></section></div><section class="panel spaced"><h3>先核对，怎样才能开始</h3><p class="detail-intro">${esc(r.regions?.[state.region]?.entry ?? r.entry)}</p><p class="section-note"><strong>学历与资格：</strong>${esc(r.regions?.[state.region]?.credential ?? r.education)}</p><h3>用一个小项目验证兴趣</h3><p class="detail-intro">${esc(r.portfolio)}</p><div class="chip-row">${r.majors
      .map((id) => catalog.majors.find((m) => m.id === id))
      .filter(Boolean)
      .map(
        (m) =>
          `<button class="chip" data-major-link="${m.id}">${esc(m.name)} ↗</button>`,
      )
      .join(
        "",
      )}</div></section>${jobRealityHTML(r)}<div class="detail-grid"><section class="panel"><h3>AI 更容易覆盖的任务</h3>${list(r.ai.automated)}</section><section class="panel"><h3>与 AI 协作，仍值得积累什么</h3>${list(r.ai.complement)}</section></div><section class="panel spaced"><h3>统计背景 · ${esc(obs.kind)}</h3><p class="detail-intro">${esc(wageText(obs))}</p>${state.region === "US" && obs.record ? `<p class="section-note">SOC ${esc(r.soc)} · ${esc(obs.record.name)}<br>${obs.period} 就业变化预测 ${num(obs.record.growth, 1)}%；年均开放机会 ${num(obs.record.openings)} 人，含替代需求。</p>` : `<p class="section-note">统计门类：${esc(i.cnWageIndustry)}。整个门类均值，不是 ${esc(r.title)} 的薪资报价。</p>`}<p class="evidence-note">${state.region === "US" ? "SOC 为广义职业代理，不能代表所有细分岗位；工资为中位数。" : "行业均值受到城市、岗位和经验构成影响，私营与非私营单位须分开。"} 不是应届生起薪，也不预测你的收入。<br>来源状态：${freshness(obs.source).label} · 上次有效获取 ${dateLabel(obs.source?.lastSuccess)}</p><a class="text-link" href="${esc(safeURL(obs.source?.url ?? ""))}" target="_blank" rel="noopener">核对原始统计表 ↗</a></section><section class="panel spaced"><h3>编辑量规的理由</h3>${Object.entries(
      r.rubric,
    )
      .map(
        ([k, v]) =>
          `<p class="detail-intro"><strong>${{ moat: "职业壁垒", ai: "AI 互补", access: "入门可行" }[k]} ${v.value}/5：</strong>${esc(v.reason)}</p>`,
      )
      .join(
        "",
      )}</section><div class="section-heading"><h2>可能的相邻方向</h2><button class="button primary" data-compare="${r.id}">${state.compare.includes(r.id) ? "已加入对比 ✓" : "加入岗位对比"}</button></div><div class="chip-row">${r.transition
      .map((id) => catalog.roles.find((x) => x.id === id))
      .filter(Boolean)
      .map(
        (x) =>
          `<button class="button subtle" data-role="${x.id}">${esc(x.title)} ↗</button>`,
      )
      .join(
        "",
      )}</div><p class="section-note">相邻方向是探索建议，不代表无需学习或资格即可转岗。</p></div>`,
  );
}
function updateCompare() {
  const bar = $("#compare-bar");
  bar.hidden = !state.compare.length;
  bar.innerHTML = `<span>已选 ${state.compare.length} / 3 个岗位</span><button class="button primary" id="show-compare">横向对比 ↗</button><button class="text-link" id="clear-compare">清空</button>`;
  document.querySelectorAll("[data-compare]").forEach((b) => {
    const yes = state.compare.includes(b.dataset.compare);
    b.setAttribute("aria-pressed", yes);
    b.textContent = yes ? "已选 ✓" : "＋ 对比";
  });
}
function showCompare() {
  const roles = state.compare.map((id) =>
    catalog.roles.find((r) => r.id === id),
  );
  if (roles.length < 2) {
    toast("先选择至少两个岗位");
    return;
  }
  const rows = [
    ["行业", (r) => esc(industryFor(r).name)],
    [
      "探索指数",
      (r) => {
        const s = scoreRole(r, industryFor(r), state.region, data);
        return `${s.score ?? "—"} /100；覆盖 ${s.coverage}%`;
      },
    ],
    [
      "统计薪资背景",
      (r) =>
        esc(wageText(roleObservation(r, industryFor(r), state.region, data))),
    ],
    ["日常任务", (r) => list(r.daily)],
    ["交付成果", (r) => list(r.jobReality?.deliverables || r.daily)],
    [
      "公司类型差异",
      (r) =>
        list(
          r.jobReality?.companyTypes.map((x) => x.type + "：" + x.work) || [],
        ),
    ],
    [
      "进入要求",
      (r) => esc(r.regions?.[state.region]?.credential ?? r.education),
    ],
    ["关键能力", (r) => list(r.skills)],
    ["练习与作品", (r) => esc(r.portfolio)],
    ["AI 互补", (r) => list(r.ai.complement)],
  ];
  openDetail(
    `${dialogHeader("岗位对比", regions[state.region] + " / 岗位对比")}<div class="dialog-body"><p class="section-note">同一行业中的岗位也可能有不同门槛。统计薪资是背景代理，不能推断个人 offer。</p><div class="table-wrap"><table class="comparison-table"><thead><tr><th>比较维度</th>${roles.map((r) => `<th>${esc(r.title)}</th>`).join("")}</tr></thead><tbody>${rows.map(([name, fn]) => `<tr><th>${name}</th>${roles.map((r) => `<td>${fn(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`,
  );
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
  const roles = catalog.roles
    .slice()
    .sort((a, b) => fitScore(b, state.prefs) - fitScore(a, state.prefs))
    .slice(0, 3);
  const major = catalog.majors.find((m) => m.id === state.prefs.major);
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
      `规则匹配：${fitScore(r, state.prefs)}/100；探索指数：${s.score ?? "证据不足"}；指标覆盖：${s.coverage}%。`,
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
function evidenceURL(url) {
  if (url.startsWith("#")) return url;
  return safeURL(url);
}
function evidenceHTML(evidence) {
  return `<div class="chat-evidence">本次检索依据（${regions[state.region]}）：${evidence.map((d, i) => `<a href="${esc(evidenceURL(d.url))}" ${d.url.startsWith("#") ? "data-evidence-internal" : 'target="_blank" rel="noopener"'}>[${i + 1}] ${esc(d.title)} · ${["official-fact", "macro-fact"].includes(d.kind) ? "官方统计" : d.kind === "public-path" ? "官方入口" : "编辑资料"}</a>`).join("")}</div>`;
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
    $("#model-status").textContent =
      "当前浏览器未提供 WebGPU。资料检索可直接使用；本地模型需要兼容设备。";
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
      $("#model-status").textContent =
        `正在加载 ${Math.round((p.progress || 0) * 100)}% · 首次需要下载模型，完成后浏览器可缓存`;
    });
    state.modelLoaded = true;
    $("#model-status").textContent =
      "本地模型已就绪 · Qwen3 0.6B · 问题留在当前设备";
    $("#load-model").hidden = true;
    $("#unload-model").textContent = "卸载并释放内存";
    $("#send-chat").textContent = "问一问 ↗";
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
  $("#model-status").textContent =
    "模型已停止，运行内存已释放。已下载文件由浏览器缓存管理。";
  $("#send-chat").textContent = "查一查 ↗";
  $("#send-chat").disabled = false;
  $("#stop-chat").hidden = true;
}
async function ask(question) {
  if (state.generating) return;
  question = question.trim().slice(0, 500);
  if (!question) return;
  $("#chat-input").value = "";
  appendChat("user", question);
  const result = advise(question, catalog, data, state.region, intentModel);
  const evidence = result.evidence;
  const bubble = appendChat("assistant", "");
  const label = document.createElement("div");
  label.className = "answer-label";
  label.textContent = state.modelLoaded
    ? "本地小模型 · 证据筛选与整理"
    : `${intentModel ? "轻量问题分类" : "通用检索"} · ${result.label}`;
  bubble.append(label);
  const answer = document.createElement("div");
  bubble.append(answer);
  if (!evidence.length) {
    answer.textContent =
      "当前资料中没有找到足够相关的依据。可以补充一个行业、专业或岗位名称，我会继续帮你找。";
    return;
  }
  const renderAnswer = () => {
    answer.className = "structured-answer";
    answer.innerHTML =
      result.sections
        .map(
          (section) =>
            `<section><h3>${esc(section.title)} <small>[${evidence.findIndex((d) => d.id === section.source) + 1}]</small></h3>${list(section.items)}</section>`,
        )
        .join("") + `<p class="section-note">${esc(result.note)}</p>`;
  };
  renderAnswer();
  if (!state.modelLoaded) {
    bubble.insertAdjacentHTML("beforeend", evidenceHTML(evidence));
    $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
    return;
  }
  state.generating = true;
  $("#send-chat").disabled = true;
  $("#stop-chat").hidden = false;
  let full = "";
  label.textContent = "Qwen 正在本地筛选补充依据…";
  try {
    const task = evidenceTask(question, evidence);
    full = await model.generate(
      task.messages,
      () => {
        label.textContent = "Qwen 正在本地筛选补充依据…";
      },
      task.schema,
    );
    const selected = selectEvidence(full, task.choices);
    label.textContent = `本地 Qwen 证据筛选 · ${result.label}`;
    answer.insertAdjacentHTML(
      "beforeend",
      `<details><summary>模型选中的补充依据</summary>${selected.map((c) => `<p>[${c.docIndex + 1}] ${esc(c.text)}</p>`).join("")}</details>`,
    );
    full = "";
  } catch (e) {
    label.textContent = `Qwen 本次未完成，保留资料回答 · ${result.label}`;
    state.modelLoaded = model.loaded;
    if (!model.loaded) {
      $("#load-model").hidden = false;
      $("#unload-model").hidden = true;
      $("#send-chat").textContent = "查一查 ↗";
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
function closeDetail() {
  const hash = location.hash;
  if (/^#(industry|role)[=/]/.test(hash)) {
    history.replaceState(null, "", "#" + state.page);
  }
  $("#detail-dialog").close();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("button,a");
  if (!b) return;
  if (b.dataset.page) {
    $("#sidebar").classList.remove("open");
    $("#menu-button").setAttribute("aria-expanded", "false");
  }
  if (b.hasAttribute("data-search")) {
    state.query = b.dataset.search;
    state.industryId = "";
    state.major = "";
    $("#search-input").value = state.query;
    location.hash = "careers";
    render();
    return;
  }
  if (b.dataset.region) {
    state.region = b.dataset.region;
    render();
    return;
  }
  if (b.dataset.industry) {
    location.hash = "industry/" + b.dataset.industry;
    return;
  }
  if (b.dataset.role) {
    location.hash = "role/" + b.dataset.role;
    return;
  }
  if (b.dataset.category) {
    state.category = b.dataset.category;
    render();
    return;
  }
  if (b.hasAttribute("data-major")) {
    state.major = b.dataset.major;
    state.limit = 24;
    render();
    return;
  }
  if (b.dataset.majorLink) {
    closeDetail();
    state.major = b.dataset.majorLink;
    location.hash = "careers";
    render();
    return;
  }
  if (b.dataset.compare) {
    const id = b.dataset.compare;
    if (state.compare.includes(id))
      state.compare = state.compare.filter((x) => x !== id);
    else if (state.compare.length < 3) state.compare.push(id);
    else toast("最多同时对比三个岗位，请先取消一个");
    updateCompare();
    return;
  }
  if (b.dataset.close) {
    e.preventDefault();
    if (b.dataset.close === "detail-dialog") {
      const target = b.getAttribute("href");
      closeDetail();
      if (target) location.hash = target;
    } else $("#" + b.dataset.close).close();
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
    $("#chat-input").value = b.dataset.prompt;
    ask(b.dataset.prompt);
    return;
  }
  switch (b.id) {
    case "open-assistant":
    case "top-assistant":
      openAssistant();
      break;
    case "load-model":
      loadModel();
      break;
    case "unload-model":
    case "stop-chat":
      unloadModel();
      break;
    case "menu-button":
      $("#sidebar").classList.toggle("open");
      $("#menu-button").setAttribute(
        "aria-expanded",
        $("#sidebar").classList.contains("open"),
      );
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
        localStorage.setItem(
          "career-atlas-preferences",
          JSON.stringify({ ...state.prefs, region: state.region }),
        );
        toast("已在当前设备保存偏好");
      } catch {
        toast("浏览器未允许保存，当前选择仍可使用");
      }
      break;
    case "reset-prefs":
      try {
        localStorage.removeItem("career-atlas-preferences");
      } catch {}
      state.prefs = { major: "", priority: "balanced" };
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
  if (["home-industry", "career-industry"].includes(e.target.id)) {
    state.industryId = e.target.value;
    state.limit = 24;
    render();
  }
  if (["home-major", "major-select"].includes(e.target.id)) {
    state.major = e.target.value;
    render();
  }
  if (e.target.id === "trend-indicator") {
    state.trendIndicator = e.target.value;
    render();
  }
  if (e.target.id === "industry-sort") {
    state.sort = e.target.value;
    render();
  }
  if (e.target.id === "major-category") {
    state.majorCategory = e.target.value;
    state.major = "";
    render();
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "global-search") {
    e.preventDefault();
    state.query = $("#search-input").value.trim();
    state.industryId = "";
    state.major = "";
    state.limit = 24;
    location.hash = "careers";
    render();
  }
  if (e.target.id === "match-form") {
    e.preventDefault();
    state.prefs = {
      major: $("#pref-major").value,
      priority: $("#pref-priority").value,
    };
    render();
  }
  if (e.target.id === "chat-form") {
    e.preventDefault();
    ask($("#chat-input").value);
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) &&
    !$("dialog[open]")
  ) {
    e.preventDefault();
    $("#search-input").focus();
  }
  if (e.key === "Enter" && !e.shiftKey && e.target.id === "chat-input") {
    e.preventDefault();
    ask(e.target.value);
  }
});
$("#detail-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeDetail();
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
});
window.addEventListener("pagehide", () => model.interrupt());
async function init() {
  fetch(new URL("./intent-model.json", import.meta.url))
    .then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    })
    .then((m) => {
      intentModel = m;
    })
    .catch(() => {});
  try {
    [catalog, data, ecosystem, reportText] = await Promise.all(
      ["catalog.json", "observations.json", "ecosystem.json", "report.md"].map(
        async (p) => {
          const r = await fetch(new URL("./data/" + p, import.meta.url));
          if (!r.ok) throw new Error("数据文件暂不可用");
          return p.endsWith(".md") ? r.text() : r.json();
        },
      ),
    );
    render();
  } catch (e) {
    $("#main").innerHTML =
      `<div class="empty-state"><h1>资料暂时没有加载完成</h1><p>${esc(e.message)}。请刷新页面，或稍后再试。</p><button class="button" onclick="location.reload()">重新加载</button></div>`;
  }
}
init();
