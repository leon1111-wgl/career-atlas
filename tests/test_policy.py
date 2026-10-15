import datetime as dt,json,pathlib,unittest
from unittest.mock import patch
from pipeline.policy import parse_document,verify_seed,refresh,discover_links
ROOT=pathlib.Path(__file__).resolve().parents[1]
class PolicyTests(unittest.TestCase):
 def test_published_metadata_not_modified(self):
  raw='<title>Policy A</title><meta property="article:modified_time" content="2026-10-16"><meta property="article:published_time" content="2026-07-29T00:00:00Z"><p>Further diligence before final awards.</p>'
  parsed=parse_document(raw,'https://www.nist.gov/a','2026-10-16');self.assertEqual(parsed['publishedAt'],'2026-07-29')
 def test_future_missing_and_nonofficial_rejected(self):
  with self.assertRaises(ValueError):parse_document('<title>A</title><meta name="PubDate" content="2026.10.17">','https://www.gov.cn/a','2026-10-16')
  with self.assertRaises(ValueError):parse_document('<title>A</title>','https://www.gov.cn/a','2026-10-16')
  with self.assertRaises(ValueError):parse_document('<title>A</title>','https://evil.gov.cn.example/a','2026-10-16')
 def test_quote_and_original_publication_required(self):
  seed={'title':'Policy A','sourceTitle':'Policy A','publishedAt':'2026-07-29','url':'https://www.nist.gov/a','evidenceQuote':'Further diligence','verifiedAt':'2026-10-15T00:00:00Z'}
  raw='<title>Policy A</title><meta name="PubDate" content="2026.07.29"><p>Further diligence before final awards.</p>'
  verified=verify_seed(raw,seed,'2026-10-16T00:00:00Z');self.assertEqual(verified['publishedAt'],seed['publishedAt'])
  with self.assertRaises(ValueError):verify_seed(raw.replace('Further diligence','Unrelated text'),seed,'2026-10-16T00:00:00Z')
 def test_all_failures_preserve_verified_dates_and_cache(self):
  seeds=json.loads((ROOT/'content/policy-seeds.json').read_text());previous={'checkedAt':'2026-10-15T00:00:00Z','items':seeds['items'],'sources':[]}
  with patch('pipeline.policy.fetch',side_effect=RuntimeError('offline')):result=refresh(previous, '2026-10-16T00:00:00Z')
  self.assertEqual(len(result['items']),len(previous['items']))
  self.assertEqual([x['verifiedAt'] for x in result['items']],[x['verifiedAt'] for x in sorted(previous['items'],key=lambda x:(x['publishedAt'],x['id']),reverse=True)])
  self.assertTrue(all(x['status'] in ['cached','unavailable'] for x in result['sources']))
 def test_catalog_mappings_and_no_future_seed(self):
  seeds=json.loads((ROOT/'content/policy-seeds.json').read_text());valid={x['id'] for x in json.loads((ROOT/'content/catalog.json').read_text())['industries']}
  self.assertEqual({x['region'] for x in seeds['items']},{'CN','US'})
  for x in seeds['items']:
   self.assertLessEqual(x['publishedAt'],'2026-10-16');self.assertTrue(set(x['industryIds'])<=valid);self.assertTrue(x['constraints']);self.assertTrue(x['opportunities'])
   if x['region']=='US':self.assertLessEqual(len(x['evidenceQuote'].split()),25)
 def test_discovery_is_official_and_bound(self):
  raw='<a href="/news/2026/10/manufacturing-plan">Manufacturing workforce plan</a><a href="https://evil.example/x">AI jobs</a>'
  rows=discover_links(raw,'https://www.nist.gov/news','US');self.assertEqual(len(rows),1);self.assertEqual(rows[0]['url'],'https://www.nist.gov/news/2026/10/manufacturing-plan')
if __name__=='__main__':unittest.main()
