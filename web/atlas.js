/**
 * The atlas map: eight industry regions drawn as contour islands, one waypoint per
 * industry, and dashed trails from "you are here" to the industries a major links to.
 * Positions are editorial layout only; distance on the map carries no meaning.
 */
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

export const W = 1000,
  H = 620,
  HOME = [500, 312];

export const GROUPS = [
  { id: "digital", name: "互联网与数字技术", ids: ["software", "ai", "telecom"], at: [150, 172] },
  { id: "industry", name: "工业与工程技术", ids: ["chips", "machines", "mobility", "materials"], at: [392, 150] },
  { id: "energy", name: "能源与基础建设", ids: ["power", "mining", "construction", "property"], at: [636, 176] },
  { id: "health", name: "医疗与生命科学", ids: ["health", "pharma", "science"], at: [866, 152] },
  { id: "business", name: "商业与专业服务", ids: ["finance", "professional", "commerce"], at: [160, 462] },
  { id: "culture", name: "教育与文化创意", ids: ["education", "media", "creative"], at: [404, 478] },
  { id: "public", name: "公共与生活服务", ids: ["public", "personal", "hospitality"], at: [646, 450] },
  { id: "supply", name: "农业与供应链", ids: ["agri", "environment", "logistics"], at: [868, 476] },
];

const COLS = "ABCDEFGH";
/** Grid reference of a map point, like an atlas index: column letter, row number. */
export const gridRef = ([x, y]) =>
  COLS[Math.min(7, Math.floor(x / (W / 8)))] + (Math.min(4, Math.floor(y / (H / 5))) + 1);

/** Waypoint position of every industry, keyed by id. */
export const PLACES = Object.fromEntries(
  GROUPS.flatMap((g) =>
    g.ids.map((id, k) => {
      const n = g.ids.length,
        y = g.at[1] - (n - 1) * 17 + 10 + k * 34,
        x = g.at[0] - 54 + (k % 2) * 16;
      return [id, [x, y]];
    }),
  ),
);
export const groupOf = (id) => GROUPS.find((g) => g.ids.includes(id));

function closedCurve(pts) {
  const n = pts.length,
    f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n],
      p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

/** Concentric, slightly wobbling rings around a region centre: the contour lines. */
function contours([cx, cy], seed) {
  const ph = [seed * 1.7, seed * 2.9 + 1, seed * 0.6 + 2];
  const peak = [Math.cos(seed) * 16, Math.sin(seed * 1.3) * 10];
  return [1, 0.76, 0.53, 0.31].map((s, ring) => {
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const t = (i / 36) * Math.PI * 2,
        r =
          97 *
          s *
          (1 +
            0.09 * Math.sin(2 * t + ph[0]) +
            0.06 * Math.sin(3 * t + ph[1] + ring * 0.4) +
            0.035 * Math.sin(5 * t + ph[2]));
      const shift = 1 - s;
      pts.push([cx + peak[0] * shift + r * 1.1 * Math.cos(t), cy + peak[1] * shift + r * 0.95 * Math.sin(t)]);
    }
    return closedCurve(pts);
  });
}

function trail(to) {
  const [x0, y0] = HOME,
    [x1, y1] = to,
    mx = (x0 + x1) / 2,
    my = (y0 + y1) / 2,
    len = Math.hypot(x1 - x0, y1 - y0) || 1,
    bend = 0.18 * len * (x1 < x0 ? -1 : 1);
  const cx = mx - ((y1 - y0) / len) * bend,
    cy = my + ((x1 - x0) / len) * bend;
  return `M${x0} ${y0}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1} ${y1}`;
}

/**
 * @param industries catalog industries
 * @param counts {industryId: number} roles of the chosen major in each industry; empty = no trails
 * @param from label of the trailhead (the chosen major), or "" for none
 */
export function atlasSVG({ industries, counts = {}, from = "", label = "行业地图" }) {
  const byId = Object.fromEntries(industries.map((i) => [i.id, i]));
  const lit = Object.keys(counts).filter((id) => counts[id] > 0 && PLACES[id]);
  const grid = [];
  for (let c = 1; c < 8; c++) grid.push(`<line x1="${(c * W) / 8}" y1="0" x2="${(c * W) / 8}" y2="${H}"/>`);
  for (let r = 1; r < 5; r++) grid.push(`<line x1="0" y1="${(r * H) / 5}" x2="${W}" y2="${(r * H) / 5}"/>`);
  const ticks =
    [...COLS].map((c, i) => `<text x="${(i + 0.5) * (W / 8)}" y="14" text-anchor="middle">${c}</text>`).join("") +
    [1, 2, 3, 4, 5].map((r) => `<text x="8" y="${(r - 0.5) * (H / 5) + 4}">${r}</text>`).join("");
  const regions = GROUPS.map((g, gi) => {
    const rings = contours(g.at, gi + 1);
    const top = g.at[1] - (g.ids.length - 1) * 17 - 20;
    return `<g class="region" style="--g:var(--g${gi + 1})" data-group="${g.id}"><path class="land" d="${rings[0]}"/>${rings
      .slice(1)
      .map((d) => `<path class="contour" d="${d}"/>`)
      .join("")}<text class="region-name" x="${g.at[0]}" y="${top}" text-anchor="middle">${esc(g.name)}</text></g>`;
  }).join("");
  const trails = lit.map((id) => `<path class="trail" d="${trail(PLACES[id])}"/>`).join("");
  const points = Object.entries(PLACES)
    .filter(([id]) => byId[id])
    .map(([id, [x, y]]) => {
      const i = byId[id],
        n = counts[id] || 0,
        on = n > 0;
      return `<a class="wp${on ? " on" : ""}${lit.length && !on ? " dim" : ""}" href="#/industry/${id}" data-wp="${id}" aria-label="${esc(i.name)}，图幅 ${gridRef([x, y])}${on ? `，${n} 个相关岗位` : ""}"><circle class="wp-hit" cx="${x}" cy="${y}" r="15"/><circle class="wp-ring" cx="${x}" cy="${y}" r="7.5"/><circle class="wp-dot" cx="${x}" cy="${y}" r="3"/>${on ? `<g class="wp-badge"><rect x="${x - 26}" y="${y - 9}" width="17" height="18" rx="3"/><text x="${x - 17.5}" y="${y + 4.5}" text-anchor="middle">${n}</text></g>` : ""}<text class="wp-label" x="${x + 13}" y="${y + 4.5}">${esc(i.name)}</text></a>`;
    })
    .join("");
  const home = `<g class="home${from ? " set" : ""}"><circle cx="${HOME[0]}" cy="${HOME[1]}" r="11"/><path d="M${HOME[0]} ${HOME[1] - 6}l4 9-4-2.2-4 2.2z"/><text x="${HOME[0]}" y="${HOME[1] + 30}" text-anchor="middle">${from ? esc(from) : "从你的专业出发"}</text></g>`;
  return `<svg class="atlas" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(label)}"><g class="graticule">${grid.join("")}</g><g class="grid-ticks" aria-hidden="true">${ticks}</g>${regions}<g class="trails" aria-hidden="true">${trails}</g>${home}${points}</svg>`;
}
