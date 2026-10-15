import unittest
from pipeline.sources import parse_bls, parse_nbs, parse_worldbank, with_failure

class SourcesTests(unittest.TestCase):
 def test_bls_period_and_units(self):
  text='<p>Employment, 2025 | Employment, 2035</p><table><tr>'+''.join('<td>'+x+'</td>' for x in ['Software developers','15-1252','Line item','1693.8','1950.0','1','1','256.2','15.1','2','115.2','135,000',"Bachelor degree",'None','None'])+'</tr></table>'
  x=parse_bls(text);self.assertEqual(x['period'],'2025–2035');self.assertEqual(x['occupations']['15-1252']['openings'],115200);self.assertEqual(x['occupations']['15-1252']['medianWage'],135000)
 def test_worldbank_null_not_zero_and_country_isolation(self):
  x=parse_worldbank([{},[{'countryiso3code':'CHN','date':'2024','value':None},{'countryiso3code':'USA','date':'2024','value':2.4}]])
  self.assertEqual(x['CN'],[]);self.assertEqual(x['US'],[{'year':2024,'value':2.4}])
 def test_failure_retains_success_date(self):
  x=with_failure({'status':'ok','lastSuccess':'2025-01-01','value':42},'2026-10-15','HTTP 403')
  self.assertEqual(x['value'],42);self.assertEqual(x['lastSuccess'],'2025-01-01');self.assertEqual(x['status'],'cached');self.assertEqual(x['attemptedAt'],'2026-10-15')
 def test_reject_bls_error_page(self):
  with self.assertRaises(ValueError):parse_bls('<html>Access denied</html>')
 def test_reject_nbs_missing_tables(self):
  with self.assertRaises(ValueError):parse_nbs('<p>2025年城镇单位就业人员年平均工资</p>')
 def test_duplicate_mobile_nbs_tables_do_not_double_count(self):
  sectors=['制造业']+[f'行业{i}' for i in range(15)]
  table='<table><tr><td>行业</td><td>2025年</td><td>2024年</td><td>名义增长率</td></tr>'+''.join(f'<tr><td>{s}</td><td>100</td><td>90</td><td>11.1</td></tr>' for s in sectors)+'</table>'
  other=table.replace('<td>100</td>','<td>80</td>')
  x=parse_nbs('<h1>2025年城镇单位就业人员年平均工资</h1>'+table+other+table+other)
  self.assertEqual(len(x['sectors']),16);self.assertEqual(x['sectors']['制造业']['private']['wage'],80)
 def test_partial_country_refresh_preserves_previous_complete_snapshot(self):
  from unittest.mock import patch
  from pipeline.collect import collect_one
  previous={'wb-test':{'status':'ok','lastSuccess':'2026-01-01','value':{'CN':[{'year':2024,'value':5}], 'US':[{'year':2024,'value':2}]}}}
  with patch('pipeline.collect.fetch',return_value=b'partial'):
   _,record=collect_one('wb-test','test','https://example.test',lambda _: {'CN':[],'US':[{'year':2025,'value':3}]},previous,'2026-10-15')
  self.assertEqual(record['status'],'cached');self.assertEqual(record['value'],previous['wb-test']['value'])
