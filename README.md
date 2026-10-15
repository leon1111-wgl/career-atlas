# 向野 · Career Atlas

**给职业选择，多一点依据。** 面向年轻人的中美行业、专业与岗位探索平台。中文首版，开放源码，自动更新官方统计，配备真正运行在浏览器中的本地小模型。

[打开网站](https://leon1111-wgl.github.io/career-atlas/) · [观察报告](reports/latest.md) · [评分代码](web/scoring.js) · [模型卡](docs/MODEL_CARD.md)

## 可以做什么

- 看中美十余年的 GDP、就业与物价背景，以及美国月度就业变化。
- 从 26 个行业、111 个岗位、44 个专业族寻找细分方向。
- 沿产业链理解谁付钱、谁交付、机会和约束在哪里。
- 对比岗位的日常、技能、入门资格、AI影响与作品建议；公司是官方入口样本，不冒充招聘广告。
- 按专业和明确偏好生成探索清单，下载四周实践计划。
- 查看透明的探索指数、统计与编辑判断覆盖、缺失敏感性范围。
- 阅读自动生成的中文分析报告，下载原始结构化快照。
- 使用自托管的 Qwen3 0.6B 量化模型与本地资料检索，在设备上筛选依据、组织职业回答；不显示未经核验的生成事实。

## 数据有多“实时”

GitHub Actions **每6小时尝试更新**，官方数据按月或按年发布。采集时间与观测期分别标注。调度可能延迟，状态页显示实际结果。首版接入17路来源：世界银行4项中美年度指标、国家统计局行业工资和最新发布、FRED转发BLS的10项美国月度序列、BLS职业预测表。

遇到访问限制，使用公开可读的官方表格或官方数据分发渠道，不绕过登录/付费墙。BLS职业预测当前使用经官方网页核验的初始快照，自动HTTP抓取返回403时保留原值和原获取时间，标记“沿用快照”。后续直接抓取成功时自动替换。国家统计局最新发布页用于发现新的工资年报。

## 推荐指数不是就业预测

统计维度与编辑量规共同构成100点权重：就业增长20、职业开放15、当地薪酬15、工资增长10、盈利质量10、职业壁垒10、AI互补10、入门可行10。

缺失不填造，总有效权重不足50%不打总分。缺失范围不是置信区间。中国是行业年均工资代理，美国是广义SOC职业中位数和就业预测，**不能跨国排名，也不是应届生起薪**。盈利质量没有足够可比数据，保留缺失。所有映射尺度与编辑理由可查。

## 本地小模型：有自己的部署，也有清楚的归属

- 基座：Qwen3-0.6B；MLC 4-bit量化；运行时 WebLLM 0.2.86。
- 约335MiB模型仓库文件与WASM通过本项目GitHub Pages分发，不需要用户API Key或远程推理服务。
- 模型文件固定上游版本，发布时逐文件验证SHA256。
- 资料库、检索、推荐规则、提示约束和评测由本项目实现；**未宣称从零训练或微调基座**。
- 用户点击后才加载模型。需要WebGPU与足够内存；不支持时仍能使用检索、评分与报告。
- 本地完整推理已验收；本次公网冷启动测试在10分钟内未完成权重下载，GitHub Pages大文件速度取决于网络。下载较慢可先使用资料检索，或按下方命令下载发布包在本地运行。
- 不上传问题、专业偏好或聊天内容。仅显式保存时把偏好写入当前浏览器。

## 本地运行

Python 3.12+、Node.js 22+、curl。静态界面没有构建步骤和npm依赖。

```bash
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.mjs
python -m pipeline.build
python -m http.server 4173 --directory web
```

打开 `http://localhost:4173`。不下载模型也可使用全部数据页面和检索。要运行模型：

```bash
gh release download model-qwen3-0.6b-v1 --pattern qwen3-model.tar.gz
mkdir -p web/models/qwen3/resolve/main
tar -xzf qwen3-model.tar.gz -C web/models/qwen3/resolve/main
python scripts/verify-model.py web/models/qwen3/resolve/main
```

手动抓取与更新报告：

```bash
python -m pipeline.collect
python -m pipeline.build
```

`--offline` 保留现有数据和时间，不伪造更新。原始公开来源压缩件在 `content/raw/`，解析后的快照在 `web/data/observations.json`。BLS核验种子单独记录在 `content/bls-extract.txt`。

## 项目结构

| 目录 | 用途 |
| --- | --- |
| `pipeline/` | 有界抓取、解析、保留旧值、报告生成 |
| `content/` | 原创行业目录、开源参考、公开来源快照 |
| `web/` | 中文静态界面、可解释评分、检索、本地模型 |
| `tests/` | 国家/口径隔离、缺失、回退、评分、检索、模型协议 |
| `reports/` | 可阅读和引用的最新报告 |
| `docs/` | 模型卡、目录说明、设计与数据审计 |

## 开源参考与许可

WebLLM实际集成，保留Apache-2.0许可；Qwen/MLC模型保留上游许可。Developer Roadmap、Interview Handbook、Reactive Resume与职业规划/考公社区仓库作为资料入口，逐一核查许可证，不把高星当作事实背书，不自动执行第三方skill。[来源审计](docs/SOURCE_AUDIT.md)。

原创代码与原创说明采用 [MIT](LICENSE)。第三方模型、运行时与数据分别遵守其自身条款，见 [第三方声明](THIRD_PARTY.md)。统计数字是研究背景；本项目不保证录用、收入或特定政策结果。
