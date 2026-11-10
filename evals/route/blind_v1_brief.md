# Brief given to the blind question writer (blind_v1)

This is the full brief the question writer received. It saw this file and `blind_v1_inventory.md` only: no code, no planner rules, no keyword lists, no data values beyond the names in the inventory.

## The product

向野 Career Atlas is a free Chinese website about industries, roles and majors in mainland China and the United States. It is built from an original catalog (26 industries, 111 roles, 44 major families) and official statistics (China NBS, US BLS, FRED, World Bank) plus a small number of official university employment-quality reports. The inventory file lists every industry, role and major name and which statistics exist.

It has a "career route assistant" (路线助手). A visitor types a question in Chinese. The assistant runs in the browser with no language model by default. It answers only from the site's data and is supposed to:

1. 转方向要补什么 — from a major (or current role) to a target role or direction: what skills and proof to add, which catalog roles are closest.
2. 专业去向 — which roles and industries a major leads to in the catalog, plus official graduate-outcome tables where they exist.
3. 官方统计查询 — industry wage statistics (China: annual average wage by NBS statistical sector; US: BLS occupation median wage, projected growth and openings), and the latest official macro indicators. Every number must carry its source and date.
4. 相邻岗位 — which roles are adjacent to a given role and what they share.
5. 行业里有哪些岗位 — roles and value-chain stages within an industry.
6. 两个岗位比较; 入门准备与资格.
7. 公共部门招录 and verified policies.
8. Saying plainly what the data cannot answer, instead of guessing.

The default layer is mainland China; a visitor can switch to the United States layer.

## Your task

Write a blind evaluation set of **48 questions** for this assistant, in the JSON format below, as a real mix of visitors would ask them: students, career changers, parents. Use natural Chinese; include colloquial and imperfect wording, compound questions, and some questions where the visitor refers to "这个专业" while viewing a major page (give that page in `context_major`).

- **32 `answer` cases** across the eight topics above. Spread them; at least 3 per topic for topics 1–5.
- **16 `must_not_answer` cases**: questions where honest behaviour is to decline the specific claim because the listed data cannot support it (for example a figure the site does not hold, a prediction about a person, a specific employer's pay, admission odds), while it may still offer what related data does exist. Make some of them tempting: phrased so a careless system would produce a number.
- About 8 of the 48 should use the US layer (`"region": "US"`).
- Only refer to entities in the inventory, or deliberately to ones that are not there (and then say in `expect` that the assistant should say it is not in the catalog).

For each case write `expect` (what a correct answer must contain or do, specific enough to grade) and `forbid` (what would make it wrong). You do not know the data values; describe facts by kind ("cites the NBS sector average wage with its year and says it is an industry average, not a starting salary"), never invent numbers.

## Format

Write the file as UTF-8 JSON:

```json
{
  "set": "blind_v1",
  "written_by": "<your model name>",
  "written_at": "<ISO date>",
  "cases": [
    {
      "id": "b01",
      "question": "…",
      "region": "CN",
      "context_major": null,
      "kind": "answer",
      "topic": "transfer|major_destinations|official_stats|adjacent_roles|industry_roles|compare_or_entry|public_or_policy|data_gap",
      "expect": ["…"],
      "forbid": ["…"]
    }
  ]
}
```

Use topic `data_gap` for every `must_not_answer` case. Do not look at any code or other files; write only the one output file.
