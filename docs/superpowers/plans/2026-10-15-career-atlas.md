# 向野 Implementation Plan

> Execute with subagent-driven-development for bounded work and root integration.

**Goal:** 发布中文版中美行业与职业数据平台和浏览器本地小模型。
**Architecture:** Python ingestion → versioned JSON/report → static UI + local WebLLM RAG.
**Tech Stack:** Python 3.12 stdlib, HTML/CSS/JS ES modules, WebLLM, GitHub Actions/Pages.
**Spec:** ../specs/2026-10-15-career-atlas-design.md

## Global Constraints
中文首发；仅中美；不发私密资料；不发虚构统计；数字可追溯；断源留旧标记；Qwen 基座准确归属；不调用付费模型。

## Tasks
1. `content/catalog.json`: 原创 24+ 行业、80+ 岗位、13+ 专业门类和细分方向；字段合同见 docs/catalog-contract.md。校验唯一 ID、引用和量表。
2. `pipeline/`: 抓取官方数据、记录来源/时期/失败、原子快照；`tests/` 测试解析和回退。真实网络抓取生成 web/data/observations.json。
3. `web/scoring.js`, `web/retrieval.js`: 评分、缺失范围、个人适配、资料检索先写关键失败测试，避免跨国代理污染。
4. `web/index.html`, `web/styles.css`, `web/app.js`: 中文响应式页面、SVG图、筛选/详情/比较/专业/报告/来源/助手。
5. `web/model.js`, `web/model-worker.js`, `docs/MODEL_CARD.md`: 锁定 WebLLM/Qwen 版本、分发、下载进度/取消/失败恢复、真实推理和评测。
6. `.github/workflows/`, `README.md`: 每日更新、手动刷新、Pages 部署；本地验证后发布并检查远端和线上资源。

## Interface review
catalog → UI/scoring/retrieval: stable IDs; data snapshot → UI/scoring: source ID, period, fetchedAt; model → UI: progress callback and async answer with separate evidence. Agents edit disjoint bounded files; root owns integration and final review.
