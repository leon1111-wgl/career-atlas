"""Official-source parsers. Numbers retain their original statistical scope."""
from html.parser import HTMLParser
from html import unescape
import re, math, copy, csv, io

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.tables=[]; self.table=None; self.row=None; self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='table': self.table=[]
        elif tag=='tr' and self.table is not None:self.row=[]
        elif tag in ('td','th') and self.row is not None:self.cell=[]
    def handle_data(self,data):
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(re.sub(r'\s+',' ',''.join(self.cell)).strip());self.cell=None
        elif tag=='tr' and self.row is not None:
            self.table.append(self.row);self.row=None
        elif tag=='table' and self.table is not None:
            self.tables.append(self.table);self.table=None

def numeric(s):
    s=str(s).replace(',','').replace('$','').strip()
    if not re.fullmatch(r'-?\d+(?:\.\d+)?\+?',s):return None
    x=float(s.rstrip('+'));return x if math.isfinite(x) else None

def parse_bls(text):
    if '<table' in text:
        p=Tables();p.feed(text);rows=[r for t in p.tables for r in t]
        plain=unescape(re.sub('<[^>]+>',' ',text))
    else:
        rows=[re.split(r'\s*\|\s*',re.sub(r'^L\d+:\s*','',line)) for line in text.splitlines()]
        rows=[[c.strip() for c in row] for row in rows];plain=text
    years=re.findall(r'Employment,\s*(20\d{2})',plain)
    if len(set(years))<2:raise ValueError('BLS period headers missing')
    base,end=sorted(set(map(int,years)))[:2]
    if end-base!=10:raise ValueError('Unexpected BLS projection horizon')
    out={}
    for r in rows:
        if len(r)<15 or not re.fullmatch(r'\d{2}-\d{4}',r[1]):continue
        employment=numeric(r[3]);wage=numeric(r[11]);openings=numeric(r[10])
        out[r[1]]={'name':r[0], 'soc':r[1], 'type':r[2], 'employment':round(employment*1000) if employment is not None else None,'growth':numeric(r[8]),'openings':round(openings*1000) if openings is not None else None,'medianWage':wage,'wageCensored':'+' in r[11], 'education':r[12], 'experience':r[13], 'training':r[14]}
    if not out:raise ValueError('BLS has no occupational rows')
    return {'period':f'{base}–{end}','baseYear':base,'projectionYear':end,'wageYear':base,'occupations':out}

def parse_nbs(text):
    title=re.search(r'(20\d{2})年城镇单位就业人员年平均工资',text)
    if not title:raise ValueError('NBS wage publication title missing')
    year=int(title.group(1));p=Tables();p.feed(text)
    industry_tables=[]
    for table in p.tables:
        if any(len(r)==4 and re.sub(r'\s','',r[0])=='行业' for r in table) and any(r and '制造业'==r[0] for r in table) and table not in industry_tables:industry_tables.append(table)
    if len(industry_tables)!=2:raise ValueError(f'Expected two NBS industry wage tables, got {len(industry_tables)}')
    sectors={}
    for kind,table in zip(('nonprivate','private'),industry_tables):
        for r in table:
            if len(r)!=4 or numeric(r[1]) is None:continue
            name=re.sub(r'\s','',r[0]);wage=numeric(r[1]);previous=numeric(r[2]);growth=numeric(r[3])
            if not (wage>0 and previous and previous>0):raise ValueError('Invalid NBS wage row')
            sectors.setdefault(name,{})[kind]={'wage':wage,'previous':previous,'growth':growth,'year':year}
    if len(sectors)<15:raise ValueError('Incomplete NBS wage table')
    return {'year':year,'sectors':sectors,'period':str(year)}

def parse_worldbank(payload):
    if not isinstance(payload,list) or len(payload)!=2 or not isinstance(payload[1],list):raise ValueError('Invalid World Bank response')
    out={'CN':[],'US':[]}
    for r in payload[1]:
        country={'CHN':'CN','USA':'US'}.get(r.get('countryiso3code'))
        value=r.get('value')
        if country and isinstance(value,(int,float)) and math.isfinite(value):out[country].append({'year':int(r['date']),'value':value})
    for rows in out.values():rows.sort(key=lambda r:r['year'])
    if not any(out.values()):raise ValueError('No World Bank observations')
    return out

def parse_fred(text):
    rows=[]
    for r in csv.DictReader(io.StringIO(text)):
        vals=list(r.values())
        if len(vals)>1 and re.fullmatch(r'20\d{2}-\d{2}-\d{2}',vals[0]) and numeric(vals[1]) is not None:rows.append({'date':vals[0], 'value':numeric(vals[1])})
    if not rows:raise ValueError('FRED series empty')
    return rows

def parse_news(text):
    rows=[];seen=set()
    for path,date,title in re.findall(r'href="(\./\d{6}/t(\d{8})_\d+\.html)"[^>]*title=[\'\"]([^\'\"]+)',text):
        if path in seen:continue
        seen.add(path);rows.append({'title':unescape(title),'date':f'{date[:4]}-{date[4:6]}-{date[6:8]}','url':'https://www.stats.gov.cn/sj/zxfb/'+path[2:]})
    return rows

def with_failure(previous,attempted_at,error):
    result=copy.deepcopy(previous or {})
    result.update(status='cached' if previous else 'unavailable',attemptedAt=attempted_at,error=str(error)[:250])
    return result
