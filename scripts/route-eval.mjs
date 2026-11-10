// Run an evaluation set through the route assistant exactly as the page does, and save every answer.
//   node scripts/route-eval.mjs evals/route/blind_v1.json [--out evals/route/runs/blind_v1-<commit>.json]
// Grading is a separate, written step (evals/route/*_grades.json); this script only records answers.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { routeAnswer, answerText } from "../web/route.js";
import { loadBase } from "./route-probe.mjs";

const args = process.argv.slice(2);
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
const setPath = args[0] || "evals/route/blind_v1.json";
const set = JSON.parse(readFileSync(setPath, "utf8"));
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {}
const base = loadBase();
const majorByName = (name) => (name ? base.catalog.majors.find((m) => m.name === name || m.id === name || name.includes(m.name.replace(/类$/, "")))?.id || null : null);
const runs = set.cases.map((c) => {
  const contextMajor = majorByName(c.context_major);
  const a = routeAnswer(c.question, base, { region: c.region || "CN", contextMajor });
  return {
    id: c.id,
    kind: c.kind,
    topic: c.topic,
    question: c.question,
    region: c.region || "CN",
    context_major: c.context_major || null,
    context_major_id: contextMajor,
    goal: a.goal,
    answered: a.answered,
    gaps: a.gaps.map((g) => g.title),
    tools: a.trace.slice(1).map((t) => t.tool),
    planner: a.trace[0].output,
    answer: answerText(a),
  };
});
const report = { set: set.set, commit, ranAt: new Date().toISOString(), cases: runs.length, runs };
const counts = {};
for (const r of runs) counts[`${r.kind}:${r.goal}`] = (counts[`${r.kind}:${r.goal}`] || 0) + 1;
const file = out || `evals/route/runs/${set.set}-${commit}.json`;
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(report, null, 1) + "\n");
console.log(`${set.set} on ${commit}: ${runs.length} cases → ${file}`);
console.log(Object.entries(counts).sort().map(([k, v]) => `${k} ${v}`).join("\n"));
