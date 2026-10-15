import unittest
from pipeline.outcomes import attach_occupations

class OutcomeJoinTests(unittest.TestCase):
    def test_only_unique_exact_detailed_names_join(self):
        obs={'sources':{'bls':{'url':'https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm','value':{'period':'2025–2035','occupations':{'1':{'name':'Software developers','type':'Line item'},'2':{'name':'Managers','type':'Summary'},'3':{'name':'Duplicate','type':'Line item'},'4':{'name':'Duplicate','type':'Line item'}}}}}}
        raw={'groups':[{'region':'US','dataKind':'occupation_distribution','rows':[{'occupation':x,'share':10,'soc':None} for x in ['Software developers','software developers','Managers','Duplicate']]}]}
        out=attach_occupations(raw,obs,{'Software developers':'软件开发人员'})
        self.assertEqual([r['soc'] for r in out['groups'][0]['rows']],['1',None,None,None])
        self.assertEqual(out['groups'][0]['rows'][0]['occupationZh'],'软件开发人员')
        self.assertIsNone(raw['groups'][0]['rows'][0]['soc'])
    def test_chinese_destination_rates_do_not_become_occupation_evidence(self):
        raw={'groups':[{'region':'CN','dataKind':'destination_status','rows':[{'occupation':'Software developers','share':100,'soc':None}]}]}
        self.assertIsNone(attach_occupations(raw,{'sources':{}})['groups'][0]['rows'][0]['soc'])
