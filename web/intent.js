/** Locally trained intent routing only. Scores are margins, never career predictions. */
export const intentLabels=Object.freeze({compare:'比较岗位',entry:'入门与资格',salary:'薪酬口径',prospects:'趋势与前景',fit:'个人探索',work:'日常任务',company:'机构与雇主',public:'公共部门招录',general:'综合检索'});
export function classifyIntent(question,model){
 const fallback={intent:'general',score:0,matched:0};
 if(!model||model.version!==1||!Array.isArray(model.features)||!Array.isArray(model.weights)||!Array.isArray(model.labels)||model.labels.length!==8)return fallback;
 const text=String(question??'').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]/g,'').slice(0,model.maxInput||500);
 const terms=new Set();for(const n of model.ngrams||[2,3])for(let i=0;i<=text.length-n;i++)terms.add(text.slice(i,i+n));
 const scores=model.labels.map(()=>0);let matched=0;
 for(let i=0;i<model.features.length;i++)if(terms.has(model.features[i])){
  const weights=model.weights[i];if(!Array.isArray(weights)||weights.length!==scores.length||weights.some(w=>!Number.isFinite(w)))return fallback;
  matched++;weights.forEach((w,j)=>scores[j]+=w/model.weightScale);
 }
 const ranked=scores.map((value,index)=>({value,index})).sort((a,b)=>b.value-a.value||a.index-b.index);
 const margin=(ranked[0].value-ranked[1].value)/Math.max(1,matched);
 if(!Number.isFinite(margin))return fallback;
 const score=Math.round(margin/(1+margin)*10000)/10000;
 const intent=matched>=model.minMatched&&margin>=model.minMargin?model.labels[ranked[0].index]:'general';
 return {intent:Object.hasOwn(intentLabels,intent)?intent:'general',score,matched};
}
