"""Current NBS indicators: exact periods, source dates, monotonic snapshot merging."""
import copy,datetime as dt,html,json,pathlib,re,concurrent.futures
from pipeline.sources import Tables
ROOT=pathlib.Path(__file__).resolve().parents[1]
INDEX='https://www.stats.gov.cn/sj/zxfb/'
LABELS={'gdp':('实际 GDP 增长','季度（累计）','累计同比（不变价）'),'unemployment':('城镇调查失业率','月度','当月水平'),'industrial':('规模以上工业增加值','月度','当月同比（实际增长）'),'retail':('社会消费品零售总额','月度','当月同比'),'cpi':('居民消费价格 CPI','月度','当月同比')}
def clean(text):
    text=re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>','',text,flags=re.I)
    return re.sub(r'\s+','',html.unescape(re.sub('<[^>]+>','',text))).replace('\u200b','')
def parse_current(raw,url,today=None):
    if not url.startswith('https://www.stats.gov.cn/'):raise ValueError('NBS national source required')
    today=today or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    stamp=re.search(r'(20\d{2})[/-](\d{2})[/-](\d{2})\s+\d{2}:\d{2}',raw)
    if not stamp:raise ValueError('Publication timestamp missing')
    published='-'.join(stamp.groups());publication=dt.date.fromisoformat(published)
    if publication>today:raise ValueError('Future publication rejected')
    title=re.search(r'<title[^>]*>(.*?)</title>',raw,re.S|re.I)
    title_text=clean(title.group(1)) if title else ''
    title_year=re.search(r'(20\d{2})年',title_text)
    year=int(title_year.group(1)) if title_year else publication.year;text=clean(raw);out=[]
    def add(key,value,month,period=None):
        observation_year=year if title_year or month<=publication.month else year-1
        dt.date(observation_year,month,1)
        date=f'{observation_year}-{month:02d}'
        if date>today.isoformat()[:7]:raise ValueError('Future observation rejected')
        label,freq,change=LABELS[key]
        out.append({'id':key,'label':label,'value':value,'unit':'%','period':period or date,'observationDate':date,'frequency':freq,'publishedAt':published,'url':url,'changeLabel':change,'series':[]})
    # Negative lookbehind excludes the trailing month in 1—8月份 cumulative expressions.
    prefix=r'(?<![\d—–\-至])(?:20\d{2}年)?(\d{1,2})月份?[，,]'
    specs={
      'industrial':r'(?:全国)?规模以上工业增加值同比(?:实际)?(增长|下降|上涨)(-?\d+(?:\.\d+)?)%',
      'retail':r'社会消费品零售总额\d+(?:\.\d+)?亿元[，,]同比(增长|下降|上涨)(-?\d+(?:\.\d+)?)%',
      'cpi':r'全国居民消费价格(?:[（(]CPI[）)])?同比(增长|下降|上涨)(-?\d+(?:\.\d+)?)%',
    }
    for key,pattern in specs.items():
        for m in re.finditer(prefix+pattern,text):
            month=int(m.group(1));number=float(m.group(3));add(key,-abs(number) if m.group(2)=='下降' else number,month)
    for m in re.finditer(prefix+r'全国城镇调查失业率为(\d+(?:\.\d+)?)%',text):add('unemployment',float(m.group(2)),int(m.group(1)))
    # GDP is explicitly cumulative. Never substitute the single-quarter YoY or QoQ number.
    gdp=re.search(r'(一季度|上半年|前三季度|全年)国内生产总值\d+(?:\.\d+)?亿元[，,]按不变价格计算[，,](?:比上年|同比)增长(\d+(?:\.\d+)?)%',text)
    if gdp:
        phase=gdp.group(1);add('gdp',float(gdp.group(2)),{'一季度':3,'上半年':6,'前三季度':9,'全年':12}[phase],f'{year}年{phase}')
    # Dedicated preliminary GDP release has current-price levels then real YoY in a table.
    title=re.search(r'<title[^>]*>(.*?)</title>',raw,re.S|re.I)
    if title and re.search(r'国内生产总值初步核算结果',clean(title.group(1))):
        phase=next((p for p in ['上半年','前三季度','全年','一季度'] if p in clean(title.group(1))),None)
        if phase:
            tables=Tables();tables.feed(raw)
            for table in tables.tables:
                for row in table:
                    if len(row) in (3,5) and clean(row[0])=='GDP':
                        try:add('gdp',float(row[-1]),{'一季度':3,'上半年':6,'前三季度':9,'全年':12}[phase],f'{year}年{phase}')
                        except ValueError:pass
    unique={(x['id'],x['observationDate']):x for x in out}
    return list(unique.values())
def merge_indicators(previous,incoming):
    grouped={}
    for row in [*previous,*incoming]:
        key=row['id'];current=grouped.get(key)
        if current is None:
            current=copy.deepcopy(row);current['series']=list(row.get('series',[]));grouped[key]=current
        history={p['date']:copy.deepcopy(p) for p in current.get('history',current.get('series',[]))}
        for point in row.get('history',row.get('series',[])):
            date=point['date']
            if (point.get('publishedAt',''),point.get('url',''))>=(history.get(date,{}).get('publishedAt',''),history.get(date,{}).get('url','')):history[date]=copy.deepcopy(point)
        for point in [current,row]:
            date=point['observationDate']; candidate={'date':date,'value':point['value'],'url':point['url'],'publishedAt':point['publishedAt']}
            if (candidate['publishedAt'],candidate['url'])>=(history.get(date,{}).get('publishedAt',''),history.get(date,{}).get('url','')):history[date]=candidate
        if (row['observationDate'],row['publishedAt'],row['url'])>=(current['observationDate'],current['publishedAt'],current['url']):
            saved=copy.deepcopy(row);grouped[key]=saved;current=saved
        current['series']=sorted(history.values(),key=lambda p:p['date'])[-36:]
        if key=='gdp':
            current['history']=copy.deepcopy(current['series'])
            if len(current['series'])<3:current['series']=[]
    return [grouped[k] for k in LABELS if k in grouped]
def collect_current(fetch,previous,now,news,save_raw=None):
    seed=json.loads((ROOT/'content/cn-current-seed.json').read_text());old=copy.deepcopy(previous or seed)
    today=dt.datetime.fromisoformat(now).astimezone(dt.timezone(dt.timedelta(hours=8))).date()
    urls=list(seed['sourceURLs'])
    for row in news or []:
        if row.get('date','9999')<=today.isoformat() and re.search('国民经济|经济运行|居民消费价格|国内生产总值初步核算|社会消费品零售总额|规模以上工业增加值',row.get('title','')) and row['url'].startswith('https://www.stats.gov.cn/'):
            urls.append(row['url'])
    urls=list(dict.fromkeys(urls))[:20];incoming=[];raws={};errors=[]
    def retrieve(url):
        body=fetch(url);text=body.decode('utf-8-sig');rows=parse_current(text,url,today)
        if not rows:raise ValueError('No supported exact current-indicator observations')
        return url,text,rows
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        future_urls={pool.submit(retrieve,url):url for url in urls}
        for future in concurrent.futures.as_completed(future_urls):
            try:
                url,text,rows=future.result();raws[url]=text;incoming.extend(rows)
            except Exception as exc:errors.append({'url':future_urls[future],'error':str(exc)[:180]})
    old.update(id='cn-current',title='国家统计局：中国最新月度与季度指标',url=INDEX,attemptedAt=now,frequency='月度 / 季度',unit='%',retrieval='国家统计局原始发布；逐项保留统计期、发布日期与同比/水平口径')
    if incoming:
        prior=old.get('value',{}).get('indicators',[]);old['value']={'indicators':merge_indicators(prior,incoming)}
        current_urls={x['url'] for x in old['value']['indicators']};covered=all(u in raws for u in current_urls)
        old.update(status='ok' if covered else 'cached')
        if covered:old['lastSuccess']=now
        if save_raw:old['sha256']=save_raw('cn-current',json.dumps(raws,ensure_ascii=False,sort_keys=True).encode())
        old['refreshedIndicators']=sorted({x['id'] for x in incoming})
    else:old['status']='cached' if previous else 'reviewed'
    if errors:old['error']=f'{len(errors)} official article requests failed or unsupported; retained previous periods';old['requestErrors']=errors
    else:old.pop('error',None);old.pop('requestErrors',None)
    return old
