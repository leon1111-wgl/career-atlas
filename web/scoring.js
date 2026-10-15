/** Transparent decision rubric, not a probability or empirical career predictor. */
export const DIMENSIONS=[['growth','就业增长',20],['openings','职业开放',15],['pay','当地薪酬',15],['payGrowth','工资增长',10],['profit','盈利质量',10],['moat','职业壁垒',10],['ai','AI 互补',10],['access','入门可行',10]];
export const clamp=(x,min=0,max=100)=>Math.max(min,Math.min(max,x));
const valid=x=>typeof x==='number'&&Number.isFinite(x);
const scale=(x,a,b)=>valid(x)?clamp((x-a)/(b-a)*100):null;
export function roleObservation(role,industry,region,data){
  if(region==='US'){const s=data.sources.bls;return {kind:'美国职业统计代理',source:s,record:s?.value?.occupations?.[role.soc]??null,baseline:s?.value?.occupations?.['00-0000']?.medianWage,period:s?.value?.period};}
  const s=data.sources['nbs-wages'];const sector=s?.value?.sectors?.[industry.cnWageIndustry];
  // Private and nonprivate populations remain separate: no opportunistic fallback between them.
  return {kind:'中国私营单位行业均薪代理',source:s,record:sector?.private??null,nonprivate:sector?.nonprivate??null,baseline:s?.value?.sectors?.['合计']?.private?.wage,period:String(s?.value?.year??'暂无')};
}
export function scoreRole(role,industry,region,data){
 const obs=roleObservation(role,industry,region,data),r=obs.record;
 const values={growth:null,openings:null,pay:null,payGrowth:null,profit:null};
 if(region==='US'&&r){values.growth=scale(r.growth,-10,20);values.openings=valid(r.openings)&&r.employment>0?scale(r.openings/r.employment*100,0,15):null;values.pay=r.wageCensored?null:scale(valid(r.medianWage)&&obs.baseline>0?r.medianWage/obs.baseline:null,.5,3);}
 if(region==='CN'&&r){values.pay=scale(valid(r.wage)&&obs.baseline>0?r.wage/obs.baseline:null,.5,3);values.payGrowth=scale(r.growth,-5,15);}
 for(const key of ['moat','ai','access']){const v=role.rubric?.[key]?.value;values[key]=valid(v)&&v>=1&&v<=5?v*20:null;}
 const dimensions=DIMENSIONS.map(([key,name,weight])=>({key,name,weight,value:values[key],kind:['moat','ai','access'].includes(key)?'编辑判断':'统计指标',reason:role.rubric?.[key]?.reason??''}));
 const coverage=dimensions.reduce((a,d)=>a+(d.value===null?0:d.weight),0);
 const weighted=dimensions.reduce((a,d)=>a+(d.value??0)*d.weight/100,0);
 return {score:coverage>=50?Math.round(weighted/coverage*100):null,coverage,observedCoverage:dimensions.filter(d=>d.kind==='统计指标'&&d.value!==null).reduce((a,d)=>a+d.weight,0),lower:Math.round(weighted),upper:Math.round(weighted+100-coverage),dimensions,observation:obs};
}
export function industryScore(industry,catalog,region,data){
 const roles=catalog.roles.filter(r=>r.industryId===industry.id),scores=roles.map(r=>scoreRole(r,industry,region,data));
 const ready=scores.filter(s=>s.score!==null);const mean=(arr,k)=>arr.length?Math.round(arr.reduce((a,s)=>a+s[k],0)/arr.length):0;
 return {score:ready.length?mean(ready,'score'):null,coverage:mean(scores,'coverage'),roleCount:roles.length,scoredRoles:ready.length,lower:mean(ready,'lower'),upper:mean(ready,'upper')};
}
export function fitScore(role,prefs={}){
 const major=prefs.major;const match=!major?40:role.majors.includes(major)?60:25;
 const value=prefs.priority==='balanced'?Object.values(role.rubric).reduce((a,r)=>a+r.value,0)/3:role.rubric[prefs.priority||'access']?.value??3;
 return Math.round(clamp(match+value*8));
}
export function freshness(source,now=Date.now()){
 if(!source?.value)return {label:'暂无数据',tone:'warn'};
 const days=(now-Date.parse(source.lastSuccess))/86400000;
 if(source.status==='cached'||days>8)return {label:source.status==='cached'?'沿用快照':'待刷新',tone:'warn'};
 return {label:'采集正常',tone:'ok'};
}
