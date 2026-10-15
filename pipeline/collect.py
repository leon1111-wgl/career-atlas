"""Fetch official public data with bounded HTTP requests and explicit stale fallback."""
import argparse, concurrent.futures, datetime as dt, gzip, hashlib, json, pathlib, subprocess, sys, re
from pipeline.sources import parse_bls, parse_nbs, parse_worldbank, parse_fred, parse_news, with_failure
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'web/data/observations.json'
BLS='https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm'
NBS='https://www.stats.gov.cn/sj/zxfb/202605/t20260515_1963707.html'
INDICATORS={'gdpGrowth':('NY.GDP.MKTP.KD.ZG','实际 GDP 增长','%'), 'unemployment':('SL.UEM.TOTL.ZS','失业率（ILO 模型估计）','%'), 'inflation':('FP.CPI.TOTL.ZG','居民消费价格涨幅','%'), 'manufacturing':('NV.IND.MANF.ZS','制造业增加值占 GDP','%')}
FRED={'UNRATE':'美国失业率（季调）','PAYEMS':'美国非农就业（季调）','USINFO':'美国信息业就业（季调）','MANEMP':'美国制造业就业（季调）','USEHS':'美国教育与卫生服务就业（季调）','USFIRE':'美国金融活动就业（季调）','USPBS':'美国专业与商业服务就业（季调）','USCONS':'美国建筑业就业（季调）','USLAH':'美国休闲与酒店就业（季调）','USGOVT':'美国政府就业（季调）'}

def fetch(url):
    result=subprocess.run(['curl','--fail','--location','--silent','--show-error','--connect-timeout','12','--max-time','45','--retry','1','--retry-max-time','50',url],capture_output=True,timeout=105)
    if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace').strip()[:200])
    if not result.stdout:raise ValueError('Empty HTTP response')
    return result.stdout

def save_raw(key,body):
    path=ROOT/'content/raw'/f'{key}.gz';path.parent.mkdir(exist_ok=True)
    path.write_bytes(gzip.compress(body,mtime=0));return hashlib.sha256(body).hexdigest()

def collect_one(key,title,url,parser,previous,now,unit='',frequency='年度'):
    try:
        raw=fetch(url);value=parser(raw.decode('utf-8-sig'))
        if not value:raise ValueError('Parsed response empty')
        if key.startswith('wb-') and not all(value.get(r) for r in ('CN','US')):raise ValueError('Incomplete country coverage; retain previous complete snapshot')
        return key,{'id':key,'title':title,'url':url,'status':'ok','attemptedAt':now,'lastSuccess':now,'sha256':save_raw(key,raw),'unit':unit,'frequency':frequency,'value':value}
    except Exception as exc:
        old=previous.get(key)
        fallback=with_failure(old,now,exc)
        fallback.update(id=key,title=title,url=url,unit=unit,frequency=frequency)
        return key,fallback

def seed_bls():
    raw=(ROOT/'content/bls-extract.txt').read_bytes()
    return {'id':'bls','title':'BLS 职业就业预测与劳动者特征','url':BLS,'status':'reviewed','lastSuccess':json.loads((ROOT/'content/bls-seed-meta.json').read_text())['verifiedAt'],'verifiedAt':'2026-10-15','retrieval':'官方网页经研究浏览器读取并核验的初始快照；自动 HTTP 采集未成功时沿用','sha256':hashlib.sha256(raw).hexdigest(),'value':parse_bls(raw.decode())}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--offline',action='store_true');args=ap.parse_args()
    previous=json.loads(OUT.read_text()) if OUT.exists() else {'sources':{}}
    sources=previous['sources'];sources.setdefault('bls',seed_bls())
    if args.offline:
        if not OUT.exists():raise SystemExit('No existing snapshot for offline mode')
        print('Offline: existing timestamps retained');return
    now=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    year=dt.datetime.now(dt.timezone.utc).year
    tasks=[('bls','BLS 职业就业预测与劳动者特征',BLS,parse_bls,'美元/年；就业人数','年度'),('nbs-wages','国家统计局：城镇单位行业工资',sources.get('nbs-wages',{}).get('url',NBS),parse_nbs,'人民币/年','年度'),('nbs-news','国家统计局最新发布','https://www.stats.gov.cn/sj/zxfb/',parse_news,'','按官方发布')]
    for key,(code,title,unit) in INDICATORS.items():
        url=f'https://api.worldbank.org/v2/country/CHN;USA/indicator/{code}?format=json&date=2014:{year}&per_page=500'
        tasks.append((f'wb-{key}',f'世界银行：{title}',url,lambda s:parse_worldbank(json.loads(s)),unit,'年度'))
    for code,title in FRED.items():
        tasks.append((f'fred-{code}',f'FRED / BLS：{title}',f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={code}&cosd=2014-01-01',parse_fred,'%' if code=='UNRATE' else '千人','月度'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures=[pool.submit(collect_one,k,t,u,p,sources,now,unit,freq) for k,t,u,p,unit,freq in tasks]
        for f in concurrent.futures.as_completed(futures):
            key,record=f.result();sources[key]=record;print(key,record['status'],record.get('error',''),flush=True)
    # Discover an annual wage release as soon as it appears on the official latest page.
    for item in sources.get('nbs-news',{}).get('value',[]):
        m=re.match(r'(20\d{2})年城镇单位就业人员年平均工资情况',item['title'])
        if m and int(m.group(1))>sources.get('nbs-wages',{}).get('value',{}).get('year',0):
            _,record=collect_one('nbs-wages','国家统计局：城镇单位行业工资',item['url'],parse_nbs,sources,now,'人民币/年','年度')
            sources['nbs-wages']=record
    result={'schemaVersion':1,'attemptedAt':now,'sources':sources}
    OUT.parent.mkdir(exist_ok=True);temporary=OUT.with_suffix('.tmp');temporary.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');temporary.replace(OUT)
    summary={s:sum(r['status']==s for r in sources.values()) for s in ('ok','cached','unavailable')}
    print(json.dumps(summary,ensure_ascii=False));
    if not any(r['status']=='ok' for r in sources.values()):raise SystemExit('No source refreshed; retained snapshots')

if __name__=='__main__':main()
