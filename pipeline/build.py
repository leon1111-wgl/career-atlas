"""Build public content and a reproducible, non-LLM statistical briefing."""
import json, pathlib, shutil, datetime as dt
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
    out=ROOT/'web/data';out.mkdir(exist_ok=True)
    for name in ('catalog','ecosystem'):shutil.copyfile(ROOT/f'content/{name}.json',out/f'{name}.json')
    data=json.loads((out/'observations.json').read_text());s=data['sources'];catalog=json.loads((out/'catalog.json').read_text())
    latest=lambda k,r:s.get(k,{}).get('value',{}).get(r,[])[-1:]
    text=['# 向野 · 中美行业与职业观察','',f"最近采集尝试：{data['attemptedAt']}",'','这份报告由公开统计快照按固定规则生成。数据所属期见每项标注；不将采集日期当作统计期。评分是探索工具，不是收益或录用概率。','', '## 经济背景','']
    for country,label in [('CN','中国大陆'),('US','美国')]:
        for key,title in [('wb-gdpGrowth','实际 GDP 增长'),('wb-unemployment','ILO 模型估计失业率'),('wb-inflation','CPI 年度涨幅')]:
            rows=latest(key,country)
            if rows:
                p=rows[0];text.append(f"- {label} {title}：{p['value']:.2f}%（{p['year']}年）。[来源]({s[key]['url']})")
    text+=['','## 中国：行业工资是背景，不是应届生报价','','私营单位与非私营单位分别列示。统计覆盖、岗位结构、城市和经验分布不同，不能从均薪推断个人起薪。','', '| 行业门类 | 私营单位年均工资（元） | 名义同比 | 非私营单位年均工资（元） |','| --- | ---: | ---: | ---: |']
    nbs=s.get('nbs-wages',{}).get('value',{})
    for name,record in nbs.get('sectors',{}).items():
        p=record.get('private',{});n=record.get('nonprivate',{});fmt=lambda x:'缺失' if x is None else f'{x:,.0f}'
        text.append(f"| {name} | {fmt(p.get('wage'))} | {str(p['growth'])+'%' if p.get('growth') is not None else '缺失'} | {fmt(n.get('wage'))} |")
    text += ['',f"统计期：{nbs.get('year','缺失')}年。[国家统计局原表]({s.get('nbs-wages',{}).get('url','')})",'','## 美国：职业预测与工资口径','','以下是目录中的典型岗位代理，不是当前招聘广告数量。开放岗位含职业离开和转岗形成的替代需求。预测有不确定性，不能移用于中国。','', '| 岗位 | SOC | 十年就业变化 | 年均开放机会（人） | 年薪中位数（美元） |','| --- | --- | ---: | ---: | ---: |']
    bls=s.get('bls',{}).get('value',{})
    for role in catalog['roles']:
        r=bls.get('occupations',{}).get(role['soc'])
        if r and r.get('type')=='Line item':
            val=lambda k:'缺失' if r.get(k) is None else f'{r[k]:,.0f}'
            text.append(f"| {role['title']} | {role['soc']} | {r['growth']}% | {val('openings')} | {val('medianWage')}{'及以上' if r.get('wageCensored') else ''} |")
    text += ['',f"预测期：{bls.get('period')}；工资期：{bls.get('wageYear')}。[BLS 原表]({s['bls']['url']})",'','## 如何解读','','- 增长和薪资各自回答不同问题。行业工资较高，并不代表毕业生容易进入。','- 相同统计门类下的细分行业可能共用数据，人工智能、软件和通信不会因此被视为相同职业。','- 中国缺少本项目可持续抓取的同口径职业就业预测；缺失项保持缺失。','- 盈利质量、AI 专属资本开支和行业人均净利润尚无完整可比样本，不进入首版数字评分。','- 本地小模型基于 Qwen3 0.6B 和资料检索，负责解释；不修改统计值或评分规则。','', '## 采集状态','']
    for record in s.values():text.append(f"- {record['title']}：{record['status']}；上次有效获取 {record.get('lastSuccess','无')}。[来源]({record['url']})")
    text+=['','## 下一步行动','','1. 选两个行业、三个岗位，阅读任务与入门要求。','2. 在目标城市收集真实招聘要求，核对是否接受应届和跨专业。','3. 约一位从业者访谈，完成一个能验证兴趣的小项目。','4. 用一周的体验修正选择，不把一次评分当结论。','']
    report='\n'.join(text);(ROOT/'reports/latest.md').write_text(report);(out/'report.md').write_text(report)
    print(f"Built {len(catalog['industries'])} industries, {len(catalog['roles'])} roles, {len(catalog['majors'])} major families; report {len(report)} chars")
if __name__=='__main__':main()
