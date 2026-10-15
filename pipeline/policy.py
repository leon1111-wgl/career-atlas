"""Verified policy cards plus bounded official discovery; no inferred policy scoring."""
import concurrent.futures,copy,datetime as dt,hashlib,html,json,pathlib,re,subprocess,urllib.parse
from html.parser import HTMLParser
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'web/data/policies.json'
class Markup(HTMLParser):
 def __init__(self):super().__init__();self.metas=[];self.links=[];self.current=None
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='meta':self.metas.append(a)
  if tag=='a' and a.get('href'):self.current={'href':a['href'],'title':a.get('title',''),'text':''}
 def handle_data(self,data):
  if self.current is not None:self.current['text']+=data
 def handle_endtag(self,tag):
  if tag=='a' and self.current is not None:self.links.append(self.current);self.current=None

def official(url):
 p=urllib.parse.urlsplit(url);host=(p.hostname or '').lower()
 return p.scheme=='https' and not p.username and (host=='gov.cn' or host.endswith('.gov.cn') or host.endswith('.gov'))
def plain(raw):
 raw=re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>','',raw,flags=re.I)
 return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',raw))).strip()
def compact(text):return re.sub(r'\s+','',html.unescape(str(text))).casefold()
def iso_date(value):
 m=re.search(r'(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})',value)
 if m:return dt.date(*map(int,m.groups())).isoformat()
 m=re.search(r'\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})',value,re.I)
 if m:
  month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].index(m.group(1)[:3].lower())+1
  return dt.date(int(m.group(3)),month,int(m.group(2))).isoformat()
 raise ValueError('Unrecognized original publication date')
def parse_document(raw,url,today=None):
 if not official(url):raise ValueError('Official HTTPS source required')
 today=str(today or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date())[:10]
 parser=Markup();parser.feed(raw);title=re.search(r'<title[^>]*>(.*?)</title>',raw,re.S|re.I)
 if not title:raise ValueError('Document title missing')
 text=plain(raw);date=None
 for key in ['firstpublishedtime','article:published_time','pubdate','parsely-pub-date','dcterms.date']:
  for meta in parser.metas:
   if (meta.get('name') or meta.get('property') or '').lower()==key:
    date=iso_date(meta.get('content',''));break
  if date:break
 if not date:
  for pattern in [r'"datePublished"\s*:\s*"([^"]+)"',r'(?:发布时间[：:]?|发布日期[：:]?)\s*((?:20\d{2})[^<]{0,35})',r'(?:Press Releases|Published:)\s*((?:[A-Z][a-z]{2,8})\s+\d{1,2},\s+20\d{2})',r'(20\d{2}年\d{2}月\d{2}日)\s+\d{2}:\d{2}']:
   m=re.search(pattern,raw if 'datePublished' in pattern else text)
   if m:date=iso_date(m.group(1));break
 if not date:raise ValueError('Original publication date missing; do not use crawl date')
 if date>today:raise ValueError('Future publication rejected')
 return {'title':plain(title.group(1)),'publishedAt':date,'text':text,'url':url}
def verify_seed(raw,seed,now):
 doc=parse_document(raw,seed['url'],dt.datetime.fromisoformat(now.replace('Z','+00:00')).astimezone(dt.timezone(dt.timedelta(hours=8))).date())
 if doc['publishedAt']!=seed['publishedAt']:raise ValueError('Publication changed; editorial review required')
 if compact(seed.get('sourceTitle',seed['title'])) not in compact(doc['title']):raise ValueError('Title differs from reviewed source')
 if not seed.get('evidenceQuote') or compact(seed['evidenceQuote']) not in compact(doc['text']):raise ValueError('Reviewed evidence quote missing')
 row=copy.deepcopy(seed);row.update(verifiedAt=now,verificationStatus='http-verified',bodySha256=hashlib.sha256(raw.encode()).hexdigest());return row

def fetch(url):
 if not official(url):raise ValueError('Official HTTPS source required')
 result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--connect-timeout','5','--max-time','20',url],capture_output=True,timeout=25)
 if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace').strip()[:180])
 if not result.stdout:raise ValueError('Empty response')
 return result.stdout.decode('utf-8-sig',errors='replace')

def discover_links(raw,base,region):
 parser=Markup();parser.feed(raw);rows=[];seen=set()
 terms=r'artificial intelligence|\bAI\b|semiconductor|manufactur|energy|health|workforce|apprentice|education|就业|人工智能|智能体|制造|能源|医疗|教育|半导体'
 for link in parser.links:
  url=urllib.parse.urljoin(base,link['href']).split('#')[0];title=plain(link['title'] or link['text'])
  if url in seen or not official(url) or len(title)<10 or not re.search(terms,title,re.I):continue
  if not re.search(r'20\d{2}|/newsroom/press-releases/[^/?]+|/news-events/news/[^/?]+',urllib.parse.urlsplit(url).path):continue
  seen.add(url);rows.append({'title':title[:240],'url':url,'region':region})
 return rows[:8]

def refresh(previous=None,now=None):
 """Return policy JSON; callers may persist it. Never modifies observations or scoring."""
 now=now or dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
 seed=json.loads((ROOT/'content/policy-seeds.json').read_text());previous=previous or {}
 today=dt.datetime.fromisoformat(now.replace('Z','+00:00')).astimezone(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
 old_items={x['id']:x for x in previous.get('items',[])};old_sources={x['id']:x for x in previous.get('sources',[])}
 items=[];sources=[];discovered=[];jobs=[('item',x) for x in seed['items']]+[('feed',x) for x in seed['feeds']]
 def run(kind,row):return kind,row,fetch(row['url'])
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  futures={pool.submit(run,kind,row):(kind,row) for kind,row in jobs}
  for future in concurrent.futures.as_completed(futures):
   kind,row=futures[future];old=old_sources.get(row['id'],{});record={'id':row['id'],'title':row['title'],'url':row['url'],'lastAttempt':now,'lastSuccess':old.get('lastSuccess')}
   try:
    _,_,raw=future.result()
    if kind=='item':items.append(verify_seed(raw,row,now))
    else:discovered.extend(discover_links(raw,row['url'],row['region']))
    record.update(status='ok',lastSuccess=now)
   except Exception as exc:
    fallback=old_items.get(row['id'],row) if kind=='item' else None
    if fallback and fallback.get('publishedAt','9999')<=today:
     kept=copy.deepcopy(fallback);kept['verificationStatus']='cached' if row['id'] in old_items else 'reviewed-cache';items.append(kept)
     record.update(status='cached' if row['id'] in old_items else 'reviewed',lastSuccess=old.get('lastSuccess') or kept['verifiedAt'])
    else:record['status']='unavailable'
    record['error']=str(exc)[:250]
   sources.append(record)
 known={x['url'] for x in items};unique={x['url']:x for x in discovered if x['url'] not in known};candidates=list(unique.values())[:6];pending=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(fetch,row['url']):row for row in candidates}
  for future in concurrent.futures.as_completed(futures):
   row=futures[future];record={'id':'discovery-'+hashlib.sha256(row['url'].encode()).hexdigest()[:12],'title':row['title'],'url':row['url'],'lastAttempt':now,'lastSuccess':None}
   try:
    parsed=parse_document(future.result(),row['url'],today)
    pending.append({'title':parsed['title'],'url':row['url'],'region':row['region'],'publishedAt':parsed['publishedAt'],'status':'待核实','note':'官方标题与发布日期已读取；政策效力、行业机制与适用范围尚待人工复核，不纳入政策卡片或评分。','discoveredAt':now})
    record.update(status='ok',lastSuccess=now)
   except Exception as exc:record.update(status='unavailable',error=str(exc)[:250])
   sources.append(record)
 return {'checkedAt':now,'items':sorted(items,key=lambda x:(x['publishedAt'],x['id']),reverse=True),'sources':sorted(sources,key=lambda x:x['id']),'discovered':sorted(pending,key=lambda x:(x['publishedAt'],x['url']),reverse=True),'scope':'已核验政策与实施进展的编辑选集；非完整实时政策库。发现候选不自动发布或加分。'}

def main():
 previous=json.loads(OUT.read_text()) if OUT.exists() else None;result=refresh(previous);OUT.parent.mkdir(exist_ok=True);temp=OUT.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');temp.replace(OUT)
 print(json.dumps({'items':len(result['items']),'discoveredPending':len(result['discovered']),'sourceStatus':{s:sum(x['status']==s for x in result['sources']) for s in ['ok','cached','reviewed','unavailable']}},ensure_ascii=False))
if __name__=='__main__':main()
