#!/usr/bin/env python3
"""Deterministic character n-gram multinomial NB training; standard library only."""
import argparse, collections, hashlib, json, math, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
SEED=20261015
LABELS=['compare','entry','salary','prospects','fit','work','company','public']
def grams(text):
    text=re.sub(r'[^a-z0-9\u3400-\u9fff]','',text.lower())[:500]
    return {text[i:i+n] for n in (2,3) for i in range(len(text)-n+1)}
def train(rows):
    counts={label:collections.Counter() for label in LABELS};documents=collections.Counter()
    for row in rows:
        terms=grams(row['text']);counts[row['intent']].update(terms);documents[row['intent']]+=1
    total=sum(counts.values(),collections.Counter());size=len(rows)
    # Per-class chi-square ranking; round-robin union preserves minority intent features.
    rankings={}
    for label in LABELS:
        def chi(term):
            a=counts[label][term];b=total[term]-a;c=documents[label]-a;d=size-documents[label]-b
            den=(a+b)*(c+d)*(a+c)*(b+d)
            return size*(a*d-b*c)**2/den if den else 0
        rankings[label]=sorted((t for t in total if counts[label][t]>=2),key=lambda t:(-chi(t),t))
    selected=set();cursor=0
    while len(selected)<600 and any(cursor<len(v) for v in rankings.values()):
        for label in LABELS:
            if cursor<len(rankings[label]) and len(selected)<600:selected.add(rankings[label][cursor])
        cursor+=1
    features=sorted(selected);alpha=.5
    denominators={label:sum(counts[label][t] for t in features)+alpha*len(features) for label in LABELS}
    weights=[]
    for term in features:
        logs=[math.log((counts[label][term]+alpha)/denominators[label]) for label in LABELS]
        mean=sum(logs)/len(logs);weights.append([round((x-mean)*1000) for x in logs])
    return {'version':1,'algorithm':'character-ngram-multinomial-naive-bayes','seed':SEED,'labels':LABELS,'ngrams':[2,3],'features':features,'weights':weights,'weightScale':1000,'minMatched':2,'minMargin':.12,'maxInput':500,'trainingExamples':len(rows),'note':'Margin-based routing score, not a calibrated probability. Missing/uncertain evidence falls back to general.'}
def classify(text,model):
    terms=grams(text);scores=[0.]*len(LABELS);matched=0
    for term,weights in zip(model['features'],model['weights']):
        if term in terms:
            matched+=1
            for i,w in enumerate(weights):scores[i]+=w/model['weightScale']
    ranking=sorted(range(len(scores)),key=lambda i:(-scores[i],i));margin=(scores[ranking[0]]-scores[ranking[1]])/max(matched,1)
    intent=LABELS[ranking[0]] if matched>=model['minMatched'] and margin>=model['minMargin'] else 'general'
    return intent,round(margin/(1+margin),4),matched

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
    train_path=ROOT/'content/intent-training.json';eval_path=ROOT/'content/intent-eval.json'
    training=json.loads(train_path.read_text());evaluation=json.loads(eval_path.read_text());rows=training['examples'];held=evaluation['examples']
    assert len({r['text'] for r in rows})==len(rows)
    assert not ({r['text'] for r in rows}&{r['text'] for r in held})
    assert all(sum(r['intent']==k for r in rows)>=24 and sum(r['intent']==k for r in held)>=8 for k in LABELS)
    model=train(rows);model['trainingSha256']=hashlib.sha256(train_path.read_bytes()).hexdigest()
    matrix={label:{pred:0 for pred in LABELS+['general']} for label in LABELS};correct=accepted=accepted_correct=0;details=[]
    for row in held:
        pred,score,matched=classify(row['text'],model);matrix[row['intent']][pred]+=1;correct+=pred==row['intent'];accepted+=pred!='general';accepted_correct+=pred==row['intent'] and pred!='general'
        details.append({**row,'predicted':pred,'score':score,'matched':matched})
    metrics={'count':len(held),'correct':correct,'accuracy':round(correct/len(held),4),'accepted':accepted,'acceptedAccuracy':round(accepted_correct/accepted,4) if accepted else None,'fallback':len(held)-accepted,'confusionMatrix':matrix,'results':details,'evaluationSha256':hashlib.sha256(json.dumps(held,ensure_ascii=False,sort_keys=True).encode()).hexdigest()}
    model['evaluation']={k:v for k,v in metrics.items() if k not in ('results','confusionMatrix')}
    output=json.dumps(model,ensure_ascii=False,separators=(',',':'))+'\n';assert len(output.encode())<100000
    evaluation['evaluation']=metrics;eval_output=json.dumps(evaluation,ensure_ascii=False,indent=2)+'\n'
    if args.check:
        assert (ROOT/'web/intent-model.json').read_text()==output,'Model is not reproducible'
        assert eval_path.read_text()==eval_output,'Evaluation is not reproducible'
    else:
        (ROOT/'web/intent-model.json').write_text(output);eval_path.write_text(eval_output)
    print(json.dumps({'bytes':len(output.encode()),**{k:v for k,v in metrics.items() if k not in ('results','confusionMatrix')}},ensure_ascii=False))
if __name__=='__main__':main()
