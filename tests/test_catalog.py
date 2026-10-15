"""职业内容契约与交叉引用验证；不把编辑文本测试当成招聘事实验证。"""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'content/catalog.json').read_text(encoding='utf-8'))

class CatalogTests(unittest.TestCase):
    def test_coverage(self):
        self.assertGreaterEqual(len(DATA['industries']), 26)
        self.assertGreaterEqual(len(DATA['roles']), 90)
        self.assertGreaterEqual(len(DATA['majors']), 35)
        self.assertEqual(DATA['version'], 1)
        self.assertEqual({x['region'] for x in DATA['publicPaths']}, {'CN', 'US'})

    def test_unique_ids(self):
        for key in ('industries', 'roles', 'majors', 'publicPaths', 'sources'):
            ids = [x['id'] for x in DATA[key]]
            self.assertEqual(len(ids), len(set(ids)), key)

    def test_relationships(self):
        roles = {x['id']: x for x in DATA['roles']}
        majors = {x['id']: x for x in DATA['majors']}
        industries = {x['id']: x for x in DATA['industries']}
        sources = {x['id'] for x in DATA['sources']}
        for role in roles.values():
            self.assertIn(role['industryId'], industries)
            self.assertIn(role['id'], industries[role['industryId']]['roleIds'])
            self.assertTrue(set(role['sourceIds']) <= sources)
            for mid in role['majors']:
                self.assertIn(role['id'], majors[mid]['roleIds'])
            for dest in role['transition']:
                self.assertIn(dest, roles)
                self.assertNotEqual(dest, role['id'])
        for major in majors.values():
            self.assertTrue(major['roleIds'], major['id'])
            for rid in major['roleIds']:
                self.assertIn(major['id'], roles[rid]['majors'])
        for industry in industries.values():
            self.assertGreaterEqual(len(industry['roleIds']), 3)
            self.assertTrue(set(industry['sourceIds']) <= sources)
            assigned = [r for stage in industry['chain'] for r in stage['roles']]
            self.assertEqual(set(assigned), set(industry['roleIds']))
            for rid in industry['roleIds']:
                self.assertEqual(roles[rid]['industryId'], industry['id'])

    def test_role_details_and_rubric(self):
        for role in DATA['roles']:
            for field in ('summary', 'education', 'entry', 'portfolio'):
                self.assertGreater(len(role[field]), 15, (role['id'], field))
            for field in ('daily', 'skills'):
                self.assertGreaterEqual(len(role[field]), 2)
            for dimension in ('moat', 'ai', 'access'):
                point = role['rubric'][dimension]
                self.assertIn(point['value'], range(1, 6))
                self.assertGreater(len(point['reason']), 12)
            self.assertTrue(role['ai']['automated'])
            self.assertTrue(role['ai']['complement'])
            if role['soc'] is not None:
                self.assertRegex(role['soc'], r'^\d{2}-\d{4}$')
                self.assertFalse(role['soc'].endswith('0'), 'Do not use aggregate SOC groups')
                self.assertIn('bls', role['sourceIds'])

    def test_nbs_sectors(self):
        valid = {'农、林、牧、渔业', '采矿业', '制造业', '电力、热力、燃气及水生产和供应业', '建筑业', '批发和零售业', '交通运输、仓储和邮政业', '住宿和餐饮业', '信息传输、软件和信息技术服务业', '金融业', '房地产业', '租赁和商务服务业', '科学研究和技术服务业', '水利、环境和公共设施管理业', '居民服务、修理和其他服务业', '教育', '卫生和社会工作', '文化、体育和娱乐业', '公共管理、社会保障和社会组织', '国际组织'}
        for industry in DATA['industries']:
            self.assertIn(industry['cnWageIndustry'], valid)
            for country in ('CN', 'US'):
                self.assertTrue(industry['companies'][country])
                for company in industry['companies'][country]:
                    self.assertTrue(company['url'].startswith('https://'))
                    self.assertTrue(company['note'])

    def test_soc_keys_in_verified_observations(self):
        snapshot = ROOT / 'web/data/observations.json'
        if not snapshot.exists():
            self.skipTest('BLS snapshot not yet generated')
        observations = json.loads(snapshot.read_text(encoding='utf-8'))
        occupations = observations['sources']['bls']['value']['occupations']
        for role in DATA['roles']:
            if role['soc'] is not None:
                self.assertIn(role['soc'], occupations, role['id'])
                self.assertEqual(occupations[role['soc']]['type'], 'Line item')

    def test_regional_qualification_notes(self):
        required = {'agent', 'mlresearch', 'mlengineer', 'dataengineer', 'backend', 'nurse', 'physician', 'lawyer', 'teacher', 'electrician', 'vet', 'pilot'}
        regional = {role['id']: role for role in DATA['roles'] if 'regions' in role}
        self.assertTrue(required <= regional.keys())
        for role in regional.values():
            self.assertEqual(set(role['regions']), {'CN', 'US'})
            for note in role['regions'].values():
                self.assertGreater(len(note['entry']), 15)
                self.assertGreater(len(note['credential']), 15)

    def test_job_reality_is_complete_and_originally_differentiated(self):
        deliveries = []
        for role in DATA['roles']:
            reality = role['jobReality']
            self.assertEqual(set(reality), {'deliverables', 'entryRoutes', 'interviewChecks', 'companyTypes'})
            self.assertIn(len(reality['deliverables']), (2, 3))
            self.assertEqual(len(reality['entryRoutes']), 2)
            self.assertEqual(len(reality['interviewChecks']), 2)
            for field in ('deliverables', 'entryRoutes', 'interviewChecks'):
                self.assertEqual(len(reality[field]), len(set(reality[field])))
                self.assertTrue(all(isinstance(text, str) and len(text) >= 7 for text in reality[field]))
            self.assertEqual(len(reality['companyTypes']), 3)
            self.assertEqual(len({x['type'] for x in reality['companyTypes']}), 3)
            for context in reality['companyTypes']:
                self.assertEqual(set(context), {'type', 'work', 'tradeoff'})
                self.assertTrue(all(isinstance(v, str) and len(v) >= 4 for v in context.values()))
            deliveries.append(tuple(reality['deliverables']))
        self.assertEqual(len(deliveries), len(set(deliveries)))

    def test_industry_decision_checklists(self):
        all_questions = []
        for industry in DATA['industries']:
            questions = industry['decisionChecklist']
            self.assertEqual(len(questions), 3)
            self.assertTrue(all(isinstance(q, str) and len(q) >= 20 and q.endswith('？') for q in questions))
            all_questions.extend(questions)
        self.assertEqual(len(all_questions), len(set(all_questions)))

    def test_no_invented_numeric_metrics(self):
        for role in DATA['roles']:
            self.assertFalse({'salary', 'wage', 'demand', 'growth', 'vacancies'} & set(role))
        for path in DATA['publicPaths']:
            self.assertGreaterEqual(len(path['checks']), 3)
            self.assertGreaterEqual(len(path['steps']), 3)
            self.assertTrue(path['url'].startswith('https://'))

if __name__ == '__main__':
    unittest.main()
