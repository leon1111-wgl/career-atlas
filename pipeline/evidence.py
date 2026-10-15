"""Validate the factual corpus and expose missing model inputs without imputing them."""
import datetime as dt
import json
import math
from pathlib import Path
from urllib.parse import urlparse


def audit(catalog, outcomes, recruitment):
    major_ids = {m['id'] for m in catalog['majors']}
    role_ids = {r['id'] for r in catalog['roles']}
    industry_ids = {i['id'] for i in catalog['industries']}
    groups = outcomes.get('groups', [])
    assert len({g['id'] for g in groups}) == len(groups), 'duplicate sample ids'
    for g in groups:
        assert g['region'] in ('CN', 'US')
        assert set(g['majorIds']) <= major_ids, g['id']
        assert g.get('period') and g.get('population') and g.get('limitations'), g['id']
        assert urlparse(g['source']['url']).scheme == 'https', g['id']
        for row in g['rows']:
            v = row['share']
            assert v is None or (isinstance(v, (float, int)) and not isinstance(v, bool) and math.isfinite(v) and 0 <= v <= 100), g['id']
            if v is None:
                assert row.get('valueStatus') == 'not-reported', g['id']
            if g['region'] == 'CN':
                assert row.get('soc') is None, 'CN status/industry percentages cannot become US occupation facts'
    jobs = recruitment.get('records', [])
    assert len({r['id'] for r in jobs}) == len(jobs), 'duplicate recruiting ids'
    for r in jobs:
        assert r['region'] == 'CN' and r['evidenceKind'] == 'job_requirement'
        assert set(r['roleIds']) <= role_ids and set(r['industryIds']) <= industry_ids
        assert r['automaticScoringEligible'] is False, 'requirements are not hiring outcomes'
        assert r['constraintScope'] == 'named_employer_cohort_position_only'
        assert {'offer_probability', 'school_prestige_bonus', 'admission_difficulty_score'} <= set(r['excludedUses'])
        assert r.get('verifiedAt') and r['source'].get('url') and r.get('population')
    regions = {}
    for region in ('CN', 'US'):
        selected = [g for g in groups if g['region'] == region]
        numbers = [r['share'] for g in selected for r in g['rows']]
        regions[region] = {
            'sampleGroups': len(selected), 'reportedNumericCells': sum(v is not None for v in numbers),
            'missingCells': sum(v is None for v in numbers),
            'structuredSourceDocuments': len({g['source']['url'] for g in selected}),
            'coveredMajorIds': sorted({m for g in selected for m in g['majorIds']}),
            'missingMajorIds': sorted(major_ids - {m for g in selected for m in g['majorIds']}),
            'unresolvedDenominatorGroups': [g['id'] for g in selected if g.get('denominatorStatus') == 'unresolved'],
            'unspecifiedEducationGroups': sum(g.get('educationLevel') == 'unspecified' for g in selected),
        }
    return {
        'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'regions': regions,
        'recruitment': {'requirements': len(jobs), 'employerGroups': sorted({r.get('employerGroup', r['employer']) for r in jobs}),
                        'hiringOutcomeSamples': 0, 'eligibleForDifficultyOrSchoolScore': 0},
        'featureReadiness': {
            'cnIndustryWage': {'status': 'usable_as_industry_context', 'target': 'broad_industry_not_entry_role'},
            'graduateDestinations': {'status': 'descriptive_only', 'target': 'original_school_cohort_population'},
            'jobEligibility': {'status': 'named_historical_sample_only', 'target': 'named_employer_cohort_position'},
            **{k: {'status': 'missing', 'scoringEnabled': False} for k in
               ('cnEntryRolePay', 'actualWorkingHours', 'workload', 'jobStability', 'hiringDifficulty', 'schoolTierAdvantage', 'majorPopularity')},
        },
        'aggregationRule': 'Do not sum overlapping cohorts or mix school results with application-to-hire rates.',
    }


def write_audit(root):
    root = Path(root)
    read = lambda p: json.loads((root / p).read_text())
    recruitment = read('content/recruitment-evidence.json') if (root / 'content/recruitment-evidence.json').exists() else {}
    result = audit(read('content/catalog.json'), read('web/data/graduate-outcomes.json'), recruitment)
    (root / 'web/data/evidence-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    cn = result['regions']['CN']
    text = ['# 大陆数据准备审计', '', '这是维护记录，不是推荐分数。', '',
            f"已提取 {cn['sampleGroups']} 组大陆样本、{cn['reportedNumericCells']} 个数值单元格；{cn['missingCells']} 个未披露单元格保留为空。",
            f"专业关联覆盖 {len(cn['coveredMajorIds'])}/{len(read('content/catalog.json')['majors'])} 个目录类别；关联不等于全国代表性。",
            f"已结构化官方文档 {cn['structuredSourceDocuments']} 份；各学校、专业和学历分母分别保留。",
            f"招聘条件样本 {len(recruitment.get('records', []))} 条；可用于录用难度、院校优势评分的结果样本仍为 0。", '',
            '## 尚不能进入综合推荐的字段', '',
            '- 应届具体岗位薪酬、真实工时与加班、离职与裁撤、有效申请人数、最终录用人数。',
            '- 985/211/双非及海外背景的同岗位同届别招聘漏斗，专业热度的明确定义和同口径时间序列。',
            '- 未测量字段不从文字、学校声誉、公司品牌、问卷印象或编辑分数中补值。', '',
            '## 覆盖缺口', '', ', '.join(cn['missingMajorIds']), '',
            '完整机器记录见 web/data/evidence-audit.json；分层设计见 docs/DATA_FOUNDATION.md。', '']
    (root / 'reports/evidence-audit.md').write_text('\n'.join(text))
    return result
