// Ask the route assistant from the command line: node scripts/route-probe.mjs "问题" [--region US] [--major accounting]
import { readFileSync } from "node:fs";
import { routeAnswer, answerText } from "../web/route.js";
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
export function loadBase() {
  return {
    catalog: read("../web/data/catalog.json"),
    data: read("../web/data/observations.json"),
    research: read("../web/data/research.json"),
    outcomes: read("../web/data/graduate-outcomes.json"),
    policies: read("../web/data/policies.json"),
    recruitment: read("../web/data/recruitment-evidence.json"),
    intentModel: read("../web/intent-model.json"),
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const region = opt("--region") || "CN";
  const contextMajor = opt("--major") || null;
  const base = loadBase();
  for (const q of args) {
    const a = routeAnswer(q, base, { region, contextMajor });
    console.log(`\n### ${q}\n[${a.label}] ${a.trace.map((t) => t.tool).join(" → ")}\n${a.trace[0].output}\n${answerText(a)}`);
  }
}
