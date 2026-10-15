"""Build public content and a reproducible, non-LLM statistical briefing."""
import json, pathlib, shutil, datetime as dt
from pipeline.outcomes import attach_occupations
from pipeline.evidence import write_audit
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
    out=ROOT/'web/data';out.mkdir(exist_ok=True)
    for name in ('catalog','ecosystem','research','graduate-outcomes'):shutil.copyfile(ROOT/f'content/{name}.json',out/f'{name}.json')
    base=json.loads((out/'graduate-outcomes.json').read_text())
    for filename in ['graduate-supplement.json','graduate-cn-additions.json']:
        supplement=ROOT/'content'/filename
        if supplement.exists():
            extra=json.loads(supplement.read_text())
            for key in ['groups','reports']:
                existing={x['id'] for x in base.get(key,[])}
                base.setdefault(key,[]).extend(x for x in extra.get(key,[]) if x['id'] not in existing)
    (out/'graduate-outcomes.json').write_text(json.dumps(base,ensure_ascii=False,indent=2)+'\n')
    recruitment=ROOT/'content/recruitment-evidence.json'
    if recruitment.exists(): shutil.copyfile(recruitment,out/'recruitment-evidence.json')
    data=json.loads((out/'observations.json').read_text());s=data['sources'];catalog=json.loads((out/'catalog.json').read_text())
    labels_path=ROOT/'content/occupation-labels.json'
    labels=json.loads(labels_path.read_text()) if labels_path.exists() else {}
    base_outcomes=json.loads((out/'graduate-outcomes.json').read_text())
    for group in base_outcomes.get('groups',[]):
        if group.get('groupType') == 'destination':
            group.setdefault('dataKind','destination_distribution');group.setdefault('metric','毕业去向分布（含升学等）')
        elif group.get('groupType') == 'industry':
            group.setdefault('dataKind','industry_distribution');group.setdefault('metric','签约就业样本的行业分布')
    outcomes=attach_occupations(base_outcomes,data,labels)
    (out/'graduate-outcomes.json').write_text(json.dumps(outcomes,ensure_ascii=False,indent=2)+'\n')
    latest=lambda k,r:s.get(k,{}).get('value',{}).get(r,[])[-1:]
    text=['# 向野 · 中美行业与职业观察','','作者：Leon Wang','',f"最近采集尝试：{data['attemptedAt']}",'','这份报告由公开统计快照按固定规则生成。数据所属期见每项标注；不将采集日期当作统计期。评分是探索工具，不是收益或录用概率。','', '## 最新月度与季度观察','']
    for item in s.get('cn-current',{}).get('value',{}).get('indicators',[]):
        text.append(f"- 中国大陆 · {item['label']}：{item['value']:g}{item['unit']}（{item['period']}；{item['changeLabel']}；发布于 {item['publishedAt']}）。[国家统计局原文]({item['url']})")
    text+=['','以上是各项已发布的最新有效统计期，不要求所有指标属于同一月份。GDP为累计实际同比，失业率为当月水平，其余为当月同比；不混用同比、环比或累计变化。采集成功不代表观测期更新。','','## 年度历史背景','']
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
    text += ['',f"预测期：{bls.get('period')}；工资期：{bls.get('wageYear')}。[BLS 原表]({s['bls']['url']})",'','## 如何解读','','- 增长和薪资各自回答不同问题。行业工资较高，并不代表毕业生容易进入。','- 相同统计门类下的细分行业可能共用数据，人工智能、软件和通信不会因此被视为相同职业。','- 中国缺少本项目可持续抓取的同口径职业就业预测；缺失项保持缺失。','- 盈利质量、AI 专属资本开支和行业人均净利润尚无完整可比样本，不进入数字评分。','- 轻量问题分类器与本地资料库整理回答；可选 Qwen3 0.6B 筛选依据，均不修改统计值或评分规则。','', '## 采集状态','']
    for record in s.values():text.append(f"- {record['title']}：{record['status']}；上次有效获取 {record.get('lastSuccess','无')}。[来源]({record['url']})")
    policies=json.loads((out/'policies.json').read_text())
    text += ['', '## 政策如何传导到就业', '']
    for p in policies.get('items',[]):
        text += [f"### {p['title']}", f"{p['region']} · 发布 {p['publishedAt']} · {p['status']}",p['summary'], '就业传导分析：'+'；'.join(p['opportunities']), '落地约束：'+'；'.join(p['constraints']),f"[官方原文]({p['url']}) · 核对 {p['verifiedAt']}",'']
    outcomes=json.loads((out/'graduate-outcomes.json').read_text())
    text += ['', '## 毕业去向资料', '', '以下保持各自样本，不合成为全国就业率或个人录用概率。']
    for g in outcomes.get('groups',[]):
        text += [f"### {g['title']} · {g['region']}",f"{g['period']} · {g['population']}", '；'.join(f"{r.get('occupationZh',r['occupation'])} {str(r['share'])+'%' if r['share'] is not None else '未披露'}" for r in g['rows']), '；'.join(g['limitations']), f"[统计表]({g['source']['url']})", '']
    text+=['','## 下一步行动' ,'','1. 选两个行业、三个岗位，阅读任务与入门要求。','2. 在目标城市收集真实招聘要求，核对是否接受应届和跨专业。','3. 约一位从业者访谈，完成一个能验证兴趣的小项目。','4. 用一周的体验修正选择，不把一次评分当结论。','']
    report='\n'.join(text);(ROOT/'reports/latest.md').write_text(report);(out/'report.md').write_text(report)
    write_audit(ROOT)
    print(f"Built {len(catalog['industries'])} industries, {len(catalog['roles'])} roles, {len(catalog['majors'])} major families; report {len(report)} chars")
if __name__=='__main__':main()
