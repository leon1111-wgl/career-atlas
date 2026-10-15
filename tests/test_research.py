"""Content coverage and evidence semantics, not a claim that forecasts are verified.

The numerical anchors below were read from the cited official tables on 2026-10-16.
Future source refreshes must review period, population and anchors together.
"""
import json
import pathlib
import re
import unittest
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'content/catalog.json').read_text(encoding='utf-8'))
RESEARCH = json.loads((ROOT / 'content/research.json').read_text(encoding='utf-8'))
OUTCOMES = json.loads((ROOT / 'content/graduate-outcomes.json').read_text(encoding='utf-8'))


class ResearchContentTests(unittest.TestCase):
    def test_complete_catalog_coverage_without_duplicate_records(self):
        for key in ('majors', 'industries'):
            ids = [record['id'] for record in RESEARCH[key]]
            self.assertEqual(len(ids), len(set(ids)), key)
            self.assertEqual(set(ids), {record['id'] for record in CATALOG[key]}, key)
        self.assertEqual(RESEARCH['kind'], 'editorial_research')
        self.assertGreaterEqual(len(RESEARCH['methodology']), 3)

    def test_major_routes_contain_distinct_actionable_work(self):
        valid_roles = {role['id'] for role in CATALOG['roles']}
        summaries, proofs = [], []
        for major in RESEARCH['majors']:
            mid = major['id']
            self.assertGreaterEqual(len(major['summary']), 45, mid)
            summaries.append(major['summary'])
            self.assertIn(len(major['foundations']), range(3, 6), mid)
            self.assertIn(len(major['degreeDecisions']), (2, 3), mid)
            self.assertEqual(len(major['transferable']), 2, mid)
            self.assertEqual(len(major['pitfalls']), 2, mid)
            for key in ('foundations', 'degreeDecisions', 'transferable', 'pitfalls'):
                values = major[key]
                self.assertEqual(len(values), len(set(values)), (mid, key))
                self.assertTrue(all(isinstance(v, str) and len(v) >= 5 for v in values), (mid, key))
            routes = major['routes']
            self.assertGreaterEqual(len(routes), 3, mid)
            self.assertEqual(len(routes), len({route['title'] for route in routes}), mid)
            self.assertEqual(len(routes), len({route['proof'] for route in routes}), mid)
            for route in routes:
                self.assertTrue(route['roleIds'], (mid, route['title']))
                self.assertTrue(set(route['roleIds']) <= valid_roles, (mid, route['roleIds']))
                for key in ('entry', 'progression', 'proof', 'tradeoff'):
                    self.assertGreaterEqual(len(route[key]), 20, (mid, key))
                    self.assertNotRegex(route[key], r'TODO|待补充|待完善|填写内容')
                # A route must not recycle one generic sentence into four fields.
                self.assertEqual(len({route[key] for key in ('entry', 'progression', 'proof', 'tradeoff')}), 4)
                proofs.append(route['proof'])
            self.assertTrue(major['sources'], mid)
            for source in major['sources']:
                self.assertEqual(urlparse(source['url']).scheme, 'https', mid)
                self.assertGreater(len(source['scope']), 20, mid)
                self.assertTrue(source['title'], mid)
        self.assertEqual(len(summaries), len(set(summaries)))
        self.assertGreaterEqual(len(set(proofs)) / len(proofs), 0.95)

    def test_high_consequence_cross_major_boundaries_are_explicit(self):
        majors = {m['id']: json.dumps(m, ensure_ascii=False) for m in RESEARCH['majors']}
        required = {
            'aerospace': ('飞行', '独立'),
            'veterinary': ('动物科学', '执业'),
            'medicine': ('临床', '资格'),
            'nursing': ('注册', '照护'),
            'pharmacy': ('药师', '资格'),
            'rehab': ('影像', '权限'),
        }
        for mid, terms in required.items():
            for term in terms:
                self.assertIn(term, majors[mid], (mid, term))

    def test_industries_explain_business_mechanics_and_falsifiers(self):
        mechanisms, questions, signals = [], [], []
        for industry in RESEARCH['industries']:
            iid = industry['id']
            self.assertGreaterEqual(len(industry['profitPool']), 55, iid)
            mechanisms.append(industry['profitPool'])
            for key, minimum in [('companyChecks', 3), ('leadingSignals', 3), ('weakSignals', 2)]:
                values = industry[key]
                self.assertGreaterEqual(len(values), minimum, (iid, key))
                self.assertEqual(len(values), len(set(values)), (iid, key))
                self.assertTrue(all(len(v) >= 20 for v in values), (iid, key))
            self.assertTrue(all(q.endswith('？') for q in industry['companyChecks']), iid)
            self.assertNotEqual(set(industry['leadingSignals']), set(industry['weakSignals']), iid)
            questions.extend(industry['companyChecks'])
            signals.extend(industry['leadingSignals'] + industry['weakSignals'])
        self.assertEqual(len(mechanisms), len(set(mechanisms)))
        self.assertEqual(len(questions), len(set(questions)))
        self.assertEqual(len(signals), len(set(signals)))

    def test_editorial_research_does_not_masquerade_as_numeric_observations(self):
        text = json.dumps(RESEARCH, ensure_ascii=False)
        self.assertNotRegex(text, r'年薪\s*\d|月薪\s*\d|录用概率\s*\d|薪资\s*\d|保证就业|保证录用|保证晋升')
        for major in RESEARCH['majors']:
            self.assertFalse({'salary', 'wage', 'vacancies', 'growth', 'probability'} & set(major))


class GraduateEvidenceTests(unittest.TestCase):
    def test_group_identity_dates_sources_and_numeric_units(self):
        groups = OUTCOMES['groups']
        ids = [g['id'] for g in groups]
        self.assertEqual(len(ids), len(set(ids)))
        valid_majors = {m['id'] for m in CATALOG['majors']}
        for group in groups:
            gid = group['id']
            self.assertIn(group['region'], ('CN', 'US'))
            self.assertTrue(set(group['majorIds']) <= valid_majors, gid)
            self.assertEqual(len(group['majorIds']), len(set(group['majorIds'])), gid)
            self.assertGreater(len(group['population']), 20, gid)
            self.assertGreaterEqual(len(group['limitations']), 3, gid)
            self.assertTrue(group['metric'], gid)
            source = group['source']
            self.assertEqual(urlparse(source['url']).scheme, 'https', gid)
            self.assertIn('publishedAt', source)
            self.assertNotEqual(group['period'], OUTCOMES['reviewedAt'], gid)
            self.assertTrue(group['rows'], gid)
            for row in group['rows']:
                self.assertTrue(row['occupation'], gid)
                self.assertIsInstance(row['share'], (int, float), gid)
                self.assertNotIsInstance(row['share'], bool, gid)
                self.assertGreaterEqual(row['share'], 0, gid)
                self.assertLessEqual(row['share'], 100, gid)
                if row['soc'] is not None:
                    self.assertRegex(row['soc'], r'^\d{2}-\d{4}$')

    def test_us_snapshot_is_employed_degree_holders_not_new_graduates(self):
        groups = [g for g in OUTCOMES['groups'] if g['region'] == 'US']
        self.assertEqual(len(groups), 37)
        self.assertEqual(sum(len(g['rows']) for g in groups), 370)
        for group in groups:
            self.assertEqual(group['period'], '2023')
            self.assertEqual(group['dataKind'], 'occupation_distribution')
            self.assertEqual(len(group['rows']), 10)
            self.assertLessEqual(sum(row['share'] for row in group['rows']), 100)
            self.assertIn('在职', group['population'])
            self.assertIn('不是应届生', ' '.join(group['limitations']))
            self.assertIn('同一groupId', ' '.join(group['limitations']))
            self.assertEqual(urlparse(group['source']['url']).hostname, 'www.bls.gov')
            stats = group['degreeStats']
            self.assertEqual(stats['period'], group['period'])
            self.assertGreater(stats['employedCount'], 0)
            for key in ('advancedDegreeShare', 'bachelorsRequiredOccupationShare'):
                self.assertGreaterEqual(stats[key], 0)
                self.assertLessEqual(stats[key], 100)

    def test_official_us_table_anchors_and_denominators(self):
        groups = {g['id']: g for g in OUTCOMES['groups']}
        anchors = [
            ('computer-and-information-technology', 'Software developers', 24),
            ('agriculture', 'Farmers, ranchers, and other agricultural managers', 9),
            ('architecture', 'Architects, except landscape and naval', 26),
            ('business', 'Accountants and auditors', 8),
            ('healthcare-and-related', 'Registered nurses', 35),
            ('mathematics', 'Software developers', 8),
            ('public-policy-and-social-services', 'Social workers, all other', 16),
        ]
        for suffix, occupation, share in anchors:
            group = groups['bls-fod-' + suffix]
            row = next(r for r in group['rows'] if r['occupation'] == occupation)
            self.assertEqual(row['share'], share, suffix)
        cs = groups['bls-fod-computer-and-information-technology']['degreeStats']
        self.assertEqual(cs['employedCount'], 2991550)
        self.assertEqual(cs['advancedDegreeShare'], 30)
        self.assertEqual(cs['bachelorsRequiredOccupationShare'], 73)

    def test_cn_school_table_is_destination_status_with_its_own_sample(self):
        groups = [g for g in OUTCOMES['groups'] if g['id'].startswith('cn-sbs-2025-undergraduate-')]
        self.assertEqual(len(groups), 30)
        self.assertEqual(sum(g['sampleSize'] for g in groups), 1941)
        for group in groups:
            self.assertEqual(group['region'], 'CN')
            self.assertEqual(group['dataKind'], 'destination_status')
            self.assertIn('初次毕业去向落实率', group['metric'])
            self.assertIn('含升学', group['metric'])
            self.assertEqual(group['period'], '2025届；截至2025-08-28')
            self.assertEqual(len(group['rows']), 1)
            self.assertIsNone(group['rows'][0]['soc'])
            self.assertIn('上海商学院', group['population'])
            self.assertIn('不是全国', group['population'])
            self.assertGreater(group['sampleSize'], 0)
        keyed = {g['id'].rsplit('-', 1)[-1]: g for g in groups}
        for key, count, share in [('01', 63, 100), ('23', 93, 93.55), ('29', 121, 92.56), ('30', 80, 92.5)]:
            self.assertEqual(keyed[key]['sampleSize'], count)
            self.assertEqual(keyed[key]['rows'][0]['share'], share)

    def test_report_library_does_not_imply_unextracted_tables_exist(self):
        reports = OUTCOMES['reports']
        ids = [r['id'] for r in reports]
        self.assertEqual(len(ids), len(set(ids)))
        for report in reports:
            self.assertIn(report['kind'], ('统计表', '就业质量报告'))
            self.assertTrue(report['population'])
            self.assertTrue(report['coverage'])
            self.assertEqual(urlparse(report['url']).scheme, 'https')
            self.assertRegex(report['verifiedAt'], r'^\d{4}-\d{2}-\d{2}$')
        # A blocked attachment is a discoverable report, not an invented dataset.
        blocked = next(r for r in reports if r['id'] == 'cn-ncwu-2025')
        self.assertIn('未提取统计', blocked['coverage'])
        self.assertFalse(any(g['id'].startswith('cn-ncwu') for g in OUTCOMES['groups']))


if __name__ == '__main__':
    unittest.main()
