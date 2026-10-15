import datetime as dt,json,pathlib,unittest
from pipeline.current import parse_current,merge_indicators,collect_current
ROOT=pathlib.Path(__file__).resolve().parents[1]
class CurrentTests(unittest.TestCase):
 def test_monthly_not_cumulative_or_mom(self):
  raw='<title>2026年8月经济</title>2026/09/15 10:00<p>1—8月份，全国规模以上工业增加值同比增长5.3%。8月份，全国规模以上工业增加值同比增长5.2%，环比增长0.54%。1—8月份，社会消费品零售总额327569亿元，同比增长1.1%。8月份，社会消费品零售总额39824亿元，同比增长0.4%。1—8月份，全国城镇调查失业率平均值为5.2%。8月份，全国城镇调查失业率为5.3%。</p>'
  values={r['id']:r for r in parse_current(raw,'https://www.stats.gov.cn/a',dt.date(2026,10,16))}
  self.assertEqual(values['industrial']['value'],5.2);self.assertEqual(values['retail']['value'],.4);self.assertEqual(values['unemployment']['value'],5.3)
  self.assertEqual(values['retail']['period'],'2026-08');self.assertEqual(values['retail']['changeLabel'],'当月同比')
 def test_cpi_negative_and_future_rejected(self):
  raw='<title>2026年9月份居民消费价格</title>2026/10/14 09:30<p>2026年9月份，全国居民消费价格同比下降0.9%。9月份，全国居民消费价格环比上涨0.2%。</p>'
  values=parse_current(raw,'https://www.stats.gov.cn/a',dt.date(2026,10,16));self.assertEqual(values[0]['value'],-.9)
  with self.assertRaises(ValueError):parse_current(raw,'https://www.stats.gov.cn/a',dt.date(2026,10,1))
 def test_old_period_never_overwrites_new_or_shrinks_series(self):
  newer={'id':'cpi','value':.9,'period':'2026-09','observationDate':'2026-09','publishedAt':'2026-10-14','url':'https://www.stats.gov.cn/a','series':[{'date':'2026-09','value':.9}]}
  older={**newer,'value':.8,'period':'2026-08','observationDate':'2026-08','publishedAt':'2026-09-09','series':[]}
  merged=merge_indicators([newer],[older]);self.assertEqual(merged[0]['value'],.9);self.assertEqual(len(merged[0]['series']),2)
 def test_year_boundary_and_gdp_table(self):
  raw='<title>2026年12月份居民消费价格</title>2027/01/10 09:30<p>2026年12月份，全国居民消费价格同比上涨1.1%。</p>'
  value=parse_current(raw,'https://www.stats.gov.cn/a',dt.date(2027,1,10))[0];self.assertEqual(value['period'],'2026-12')
  raw='<title>2026年二季度和上半年国内生产总值初步核算结果</title>2026/07/16 09:30<table><tr><td>GDP</td><td>361511</td><td>695704</td><td>4.3</td><td>4.7</td></tr></table>'
  value=parse_current(raw,'https://www.stats.gov.cn/a',dt.date(2026,10,16))[0];self.assertEqual(value['value'],4.7);self.assertEqual(value['changeLabel'],'累计同比（不变价）')
 def test_seed_is_traceable_and_has_expected_current_periods(self):
  seed=json.loads((ROOT/'content/cn-current-seed.json').read_text());rows={x['id']:x for x in seed['value']['indicators']}
  self.assertEqual(set(rows),{'gdp','unemployment','industrial','retail','cpi'});self.assertEqual(rows['cpi']['period'],'2026-09');self.assertEqual(rows['gdp']['period'],'2026年上半年')
  for row in rows.values():self.assertTrue(row['url'].startswith('https://www.stats.gov.cn/'));self.assertLessEqual(row['publishedAt'],'2026-10-16')
 def test_failure_keeps_original_success_date(self):
  seed=json.loads((ROOT/'content/cn-current-seed.json').read_text())
  def fail(url):raise RuntimeError('offline')
  value=collect_current(fail,seed,'2026-10-16T00:00:00+00:00',[])
  self.assertEqual(value['status'],'cached');self.assertEqual(value['lastSuccess'],seed['lastSuccess']);self.assertEqual(value['value'],seed['value'])
if __name__=='__main__':unittest.main()
