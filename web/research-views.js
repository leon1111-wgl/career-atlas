import { majorEvidence, relevantPolicies } from "./research.js?v=20261016-data";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const url = (s) => (/^https:\/\//.test(s || "") ? esc(s) : "#sources");
const shareLabel = (r) =>
  typeof r.share === "number" ? `${r.share}%` : "未披露";
const verifiedDay = (value) =>
  value?.includes("T")
    ? new Date(value).toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" })
    : value;
const list = (a) =>
  `<ul>${(a || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
export function outcomeHTML(outcomes, majorId, region) {
  const groups = majorEvidence(outcomes, majorId, region);
  if (!groups.length)
    return `<p class="source-line">该专业尚未接入${region === "CN" ? "中国大陆" : "美国"}同口径的毕业去向统计，职业路线依据课程与岗位要求整理。</p>`;
  return groups
    .map(
      (g) =>
        `<section class="research-block"><h3>${esc(g.title)} · ${esc(g.metric || "实际职业去向")}</h3><p class="source-line">${esc(g.period)} · ${esc(g.population)}</p><div class="table-wrap"><table><thead><tr><th>${esc(g.rowLabel || "去向类别")}</th><th>该样本中占比</th></tr></thead><tbody>${g.rows.map((r) => `<tr><td>${esc(r.occupationZh || r.occupation)}</td><td>${shareLabel(r)}</td></tr>`).join("")}</tbody></table></div>${g.degreeStats ? `<p class="source-line">样本中拥有更高学位者 ${g.degreeStats.advancedDegreeShare}%；从事通常要求至少学士学位的职业者 ${g.degreeStats.bachelorsRequiredOccupationShare}%。这是样本特征，不是读研必要性的结论。</p>` : ""}<details><summary>统计口径与适用范围</summary><p>${esc(g.limitations.join("；"))}</p></details><a class="text-link" href="${url(g.source.url)}" target="_blank" rel="noopener">${esc(g.source.title)} ↗</a></section>`,
    )
    .join("");
}
export function majorGuideHTML(id, catalog, research, outcomes, region) {
  const m = research?.majors?.find((x) => x.id === id);
  if (!m) return "";
  return `<section class="major-guide panel spaced"><h2>从所学专业，到具体工作</h2><p>${esc(m.summary)}</p><h3>先打牢这些基础</h3><div class="chip-row">${m.foundations.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div><div class="research-grid">${m.routes
    .map(
      (r) =>
        `<article class="research-block"><h3>${esc(r.title)}</h3><p><strong>进入要求：</strong>${esc(r.entry)}</p><p><strong>未来怎样发展：</strong>${esc(r.progression)}</p><p><strong>先做一次验证：</strong>${esc(r.proof)}</p><p><strong>需要接受的取舍：</strong>${esc(r.tradeoff)}</p><div class="chip-row">${r.roleIds
          .map((rid) => {
            const role = catalog.roles.find((x) => x.id === rid);
            return role
              ? `<button class="button subtle" data-role="${rid}">${esc(role.title)} ↗</button>`
              : "";
          })
          .join("")}</div></article>`,
    )
    .join(
      "",
    )}</div><div class="detail-grid"><div><h3>读研、资格与投入</h3>${list(m.degreeDecisions)}</div><div><h3>可迁移能力与常见误区</h3>${list(m.transferable)}${list(m.pitfalls)}</div></div><p class="source-line">职业路线为研究建议；具体资格以所选地区岗位要求为准。</p>${outcomeHTML(outcomes, id, region)}<details><summary>研究参考</summary>${m.sources.map((s) => `<p class="source-line"><a href="${url(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a> · ${esc(s.scope)}</p>`).join("")}</details></section>`;
}
export function industryResearchHTML(id, research) {
  const i = research?.industries?.find((x) => x.id === id);
  if (!i) return "";
  return `<section class="panel spaced"><h3>利润集中在哪里</h3><p>${esc(i.profitPool)}</p><div class="detail-grid"><div><h3>怎样判断需求在改善</h3>${list(i.leadingSignals)}</div><div><h3>出现这些变化，要重新评估</h3>${list(i.weakSignals)}</div></div><h3>看公司时具体核对</h3>${list(i.companyChecks)}<p class="source-line">以上是研究与跟踪方法，实际变化需结合最新披露验证。</p></section>`;
}
export function policiesHTML(policies, region, industryId = null) {
  const rows = relevantPolicies(policies, region, industryId);
  if (!rows.length)
    return industryId
      ? ""
      : `<section class="panel spaced"><h2>政策与就业观察</h2><p>当前地区暂无已核对的相关政策资料。</p></section>`;
  return `<section class="panel spaced policy-list"><h2>${industryId ? "相关政策如何传导到岗位" : "政策与就业观察"}</h2><p class="source-line">按文件发布日期排列 · 政策信号需经过项目、订单和招聘兑现</p>${rows
    .slice(0, industryId ? 4 : 8)
    .map(
      (p) =>
        `<article class="policy-item"><p class="source-line">${esc(p.publishedAt)} · ${esc(p.status)}</p><h3><a href="${url(p.url)}" target="_blank" rel="noopener">${esc(p.title)} ↗</a></h3><p>${esc(p.summary)}</p><details ${industryId ? "open" : ""}><summary>对岗位意味着什么</summary><h4>可能传导的方向</h4>${list(p.opportunities)}<h4>落地前要核对</h4>${list(p.constraints)}</details><p class="source-line">核对于 ${esc(verifiedDay(p.verifiedAt))} · ${p.verificationStatus?.includes("cache") ? "保留已核对资料 · " : ""}岗位影响为研究分析</p></article>`,
    )
    .join("")}</section>`;
}
export function evidenceLibraryHTML(outcomes, region) {
  const input = (outcomes?.groups || []).filter((g) => g.region === region);
  const first = new Map();
  for (const g of input)
    if (!first.has(g.source.url)) first.set(g.source.url, g);
  const lead = [...first.values()];
  const ids = new Set(lead.map((g) => g.id));
  const groups = [...lead, ...input.filter((g) => !ids.has(g.id))];
  const reports = (outcomes?.reports || []).filter((r) => r.region === region);
  const card = (g) =>
    `<article class="research-block"><h3>${esc(g.title)}</h3><p class="source-line">${esc(g.period)} · ${esc(g.metric || (g.groupType === "industry" ? "签约样本的行业分布" : "毕业去向分布"))}</p><p>${esc(g.population)}</p><p>${g.rows
      .slice(0, 3)
      .map((r) => `${esc(r.occupationZh || r.occupation)} ${shareLabel(r)}`)
      .join(
        "；",
      )}</p><details><summary>查看全部数据和口径</summary><div class="table-wrap"><table><thead><tr><th>去向类别</th><th>样本内占比</th></tr></thead><tbody>${g.rows.map((r) => `<tr><td>${esc(r.occupationZh || r.occupation)}</td><td>${shareLabel(r)}</td></tr>`).join("")}</tbody></table></div><p>${esc(g.limitations.join("；"))}</p><a class="text-link" href="${url(g.source.url)}" target="_blank" rel="noopener">核对原始资料 ↗</a></details><div class="chip-row">${g.majorIds.map((id) => `<a class="text-link" href="#major=${id}">查看专业分析 ↗</a>`).join("")}</div></article>`;
  return `<section class="panel spaced"><h2>毕业去向与就业研究</h2><p>${groups.length} 组样本已进入专业分析与资料咨询，学校、年份和分母分别保留。</p>${groups.length ? `<div class="research-grid">${groups.slice(0, 6).map(card).join("")}</div>${groups.length > 6 ? `<details><summary>展开其余 ${groups.length - 6} 组专业资料</summary><div class="research-grid">${groups.slice(6).map(card).join("")}</div></details>` : ""}` : "<p>当前地区尚未接入可核对的去向样本。</p>"}${reports.length ? `<details><summary>报告来源与样本范围</summary>${reports.map((r) => `<p><a class="text-link" href="${url(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a><br><span class="source-line">${esc(r.period)} · ${esc(r.population)} · ${esc(r.coverage)}</span></p>`).join("")}</details>` : ""}</section>`;
}
