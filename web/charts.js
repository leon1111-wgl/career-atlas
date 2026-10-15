const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sparkline(points,color='#a5b596'){
 const vals=points.map(p=>p.value).filter(Number.isFinite);if(vals.length<2)return '';
 const min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
 const line=vals.map((v,i)=>`${i*88/(vals.length-1)},${26-(v-min)/range*22}`).join(' ');
 return `<svg class="spark" viewBox="0 0 90 28" aria-hidden="true"><polyline points="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export function lineChart(series,{unit='%',label='历史趋势',height=235}={}){
 const points=series.flatMap(s=>s.values.map(p=>({...p,x:typeof p.year==='number'?p.year:Date.parse(p.date)}))).filter(p=>Number.isFinite(p.value)&&Number.isFinite(p.x));
 if(points.length<2)return '<div class="empty-state">可用历史数据不足</div>';
 const w=670,h=height,left=38,right=15,top=16,bottom=32,minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 let minY=Math.min(0,...points.map(p=>p.value)),maxY=Math.max(...points.map(p=>p.value));const range=maxY-minY||1;minY-=range*.08;maxY+=range*.12;
 const x=v=>left+(v-minX)/(maxX-minX||1)*(w-left-right),y=v=>top+(maxY-v)/(maxY-minY)*(h-top-bottom);
 let content='';for(let i=0;i<5;i++){const v=minY+(maxY-minY)*i/4,py=y(v);content+=`<line class="gridline" x1="${left}" x2="${w-right}" y1="${py}" y2="${py}"/><text x="${left-8}" y="${py+3}" text-anchor="end">${Math.abs(v)>999?Math.round(v/1000)+'k':v.toFixed(1)}</text>`;}
 const xs=[...new Set(points.map(p=>p.x))].sort((a,b)=>a-b);const step=Math.max(1,Math.ceil(xs.length/6));
 xs.filter((v,i)=>i%step===0||i===xs.length-1).forEach(v=>{const text=v<3000?String(v):new Date(v).toISOString().slice(0,7);content+=`<text x="${x(v)}" y="${h-8}" text-anchor="middle">${text}</text>`;});
 series.forEach((s,index)=>{const color=s.color||['#526e4b','#967153'][index%2];const pts=s.values.filter(p=>Number.isFinite(p.value));const coords=pts.map(p=>[x(p.year??Date.parse(p.date)),y(p.value)]);
 content+=`<polyline points="${coords.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`;
 if(pts.length<40)pts.forEach((p,i)=>{content+=`<circle cx="${coords[i][0]}" cy="${coords[i][1]}" r="3" fill="#fff" stroke="${color}" stroke-width="1.5" tabindex="0" role="img" aria-label="${esc(s.name)} ${p.year??p.date}：${p.value.toFixed(2)}${esc(unit)}"><title>${esc(s.name)} · ${p.year??p.date} · ${p.value.toFixed(2)}${esc(unit)}</title></circle>`;});
 });
 return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${content}</svg><div class="chart-legend">${series.map((s,i)=>`<span><i class="legend-dot" style="background:${s.color||['#526e4b','#967153'][i%2]}"></i>${esc(s.name)}</span>`).join('')}</div>`;
}
