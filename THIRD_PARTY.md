# 第三方声明

本项目原创代码的MIT许可不覆盖第三方模型、运行时和数据。

- **WebLLM 0.2.86**：MLC AI，Apache-2.0；`web/vendor/LICENSE-webllm`。运行时原包以npm发布完整性字段校验。来源：https://github.com/mlc-ai/web-llm
- **Qwen3-0.6B / MLC quantization**：Qwen团队基础模型，MLC转换，Apache-2.0；`web/vendor/MODEL_LICENSE`。固定版本与每文件哈希见`web/model-manifest.json`。来源：https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC
- **MLC WebGPU模型库**：MLC AI，保留其Apache许可；来源：https://github.com/mlc-ai/binary-mlc-llm-libs 。对应Git对象见模型配置。
- **World Bank WDI**：明确引用世界银行及指标代码，适用其数据使用条款（通常CC BY4.0，具体指标可能有额外归属）；https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets
- **BLS**：美国劳工统计局数据，保留定义与来源，https://www.bls.gov/bls/linksite.htm 。只使用公开统计事实。
- **FRED**：美联储圣路易斯分行数据分发服务；当前序列原始机构BLS。保留两级来源和原频率。https://fred.stlouisfed.org/legal/
- **国家统计局**：保留官方统计数据、时期、口径与链接，不声称获得其推荐或授权。https://www.stats.gov.cn/

其他GitHub仓库仅提供链接和原创概述，没有把未许可内容复制到项目，具体许可审核在`content/ecosystem.json`和`docs/SOURCE_AUDIT.md`。
