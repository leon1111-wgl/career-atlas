import copy
import json
import pathlib
import unittest
from pipeline.evidence import audit

ROOT = pathlib.Path(__file__).resolve().parents[1]
read = lambda p: json.loads((ROOT / p).read_text())

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.catalog = read('content/catalog.json')
        self.data = read('content/graduate-outcomes.json')
        for p in ('graduate-supplement.json', 'graduate-cn-additions.json'):
            self.data['groups'].extend(read('content/' + p)['groups'])
        self.jobs = read('content/recruitment-evidence.json')

    def test_actual_corpus_and_unmeasured_features(self):
        result = audit(self.catalog, self.data, self.jobs)
        self.assertGreaterEqual(result['regions']['CN']['reportedNumericCells'], 200)
        self.assertEqual(result['regions']['CN']['missingCells'], 5)
        self.assertEqual(result['recruitment']['eligibleForDifficultyOrSchoolScore'], 0)
        for k in ('actualWorkingHours', 'hiringDifficulty', 'schoolTierAdvantage', 'majorPopularity'):
            self.assertFalse(result['featureReadiness'][k]['scoringEnabled'])

    def test_recruitment_condition_cannot_become_hiring_probability(self):
        self.jobs['records'][0]['automaticScoringEligible'] = True
        with self.assertRaises(AssertionError): audit(self.catalog, self.data, self.jobs)

    def test_nonfinite_percentage_and_duplicate_samples_rejected(self):
        self.data['groups'][0]['rows'][0]['share'] = float('nan')
        with self.assertRaises(AssertionError): audit(self.catalog, self.data, self.jobs)

    def test_missing_data_are_not_filled_as_zero_or_summed(self):
        groups = read('content/graduate-cn-additions.json')['groups']
        hbnu = [g for g in groups if g['school']['domain'] == 'hbnu.edu.cn']
        self.assertEqual(len(hbnu), 57)
        self.assertEqual(sum(g['sampleSize'] for g in hbnu), 5465)
        self.assertTrue(all(g['dataKind'] == 'outcome_indicators' and not g['rowsMutuallyExclusive'] for g in hbnu))
        missing = [r for g in hbnu for r in g['rows'] if r['share'] is None]
        self.assertEqual(len(missing), 5)
        self.assertTrue(all(r['valueStatus'] == 'not-reported' for r in missing))
