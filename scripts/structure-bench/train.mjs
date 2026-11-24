// Fit the section-name scorer on the dev split, cross-validated; report dev-CV and test accuracy.
import fs from 'node:fs'; import path from 'node:path'; import * as lib from './data/build/lib.mjs';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(HERE, 'data');
const meta = Object.fromEntries(fs.readFileSync(path.join(DIR,'SongFormBench.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l)).map(r=>[r.id,r]));
const audio=fs.readdirSync(path.join(DIR,'audio')).sort(); const hx=audio.filter(f=>f.startsWith('BHX'));
const CL=['intro','verse','chorus','bridge','outro']; const MAP7={'pre-chorus':'verse',hook:'chorus'}; const to7=l=>MAP7[l]??l;
function load(files){ return files.map(f=>{ const id=f.replace(/\.(wav|mp3)$/,''); const b=fs.readFileSync(path.join(DIR,'pcm',f+'.f32'));
  const pcm=new Float32Array(b.buffer,b.byteOffset,b.length/4); const dur=pcm.length/44100; const prep=lib.prepareStructure(pcm,44100);
  const r=lib.sectionsFromPrepared(prep,{debug:true}); const L=meta[id].labels; const gt=[]; for(let i=0;i<L.length-1;i++) if(L[i+1].start>L[i].start) gt.push({start:L[i].start,end:L[i+1].start,label:to7(L[i].label)});
  // per-segment GT label share
  const segs=r.sections.map((s,i)=>{ const c={}; for(let t=s.startTimeSec+0.05;t<s.endTimeSec;t+=0.1){const g=gt.find(x=>t>=x.start&&t<x.end); if(g) c[g.label]=(c[g.label]||0)+1;} return {x:r.debug?.features?.[i], counts:c}; });
  return {id,prep,gt,dur,segs}; }); }
const dev=load(hx.slice(0,40)), test=load(hx.slice(40,80)), cnS=load(audio.filter(f=>f.startsWith('BC')));
console.log('loaded');
function fit(songs, lambda, iters=3000, lr=0.1){
  const rows=[]; for(const s of songs) for(const g of s.segs){ if(!g.x) continue; for(let k=0;k<CL.length;k++){ const w=(g.counts[CL[k]]||0); if(w>0) rows.push({x:g.x,y:k,w:w/10}); } }
  const D=rows[0].x.length; const mean=new Array(D).fill(0), sd=new Array(D).fill(0); let W0=0; for(const r of rows){W0+=r.w; r.x.forEach((v,d)=>mean[d]+=v*r.w);} mean.forEach((_,d)=>mean[d]/=W0); for(const r of rows) r.x.forEach((v,d)=>sd[d]+=r.w*(v-mean[d])**2); sd.forEach((_,d)=>sd[d]=Math.sqrt(sd[d]/W0)||1);
  const X=rows.map(r=>r.x.map((v,d)=>(v-mean[d])/sd[d]));
  const W=CL.map(()=>new Array(D+1).fill(0));
  for(let it=0;it<iters;it++){ const G=CL.map(()=>new Array(D+1).fill(0));
    rows.forEach((r,n)=>{ const z=W.map(w=>w[D]+X[n].reduce((s,v,d)=>s+w[d]*v,0)); const m=Math.max(...z); const e=z.map(v=>Math.exp(v-m)); const S=e.reduce((a,b)=>a+b,0);
      for(let k=0;k<CL.length;k++){ const g=(e[k]/S-(k===r.y?1:0))*r.w; for(let d=0;d<D;d++) G[k][d]+=g*X[n][d]; G[k][D]+=g; } });
    for(let k=0;k<CL.length;k++) for(let d=0;d<=D;d++){ const reg=d<D?lambda*W[k][d]:0; W[k][d]-=lr*(G[k][d]/W0+reg); } }
  // fold standardisation into raw weights
  return W.map(w=>{ const raw=w.slice(0,D).map((v,d)=>v/sd[d]); const b=w[D]-w.slice(0,D).reduce((s,v,d)=>s+v*mean[d]/sd[d],0); return [...raw,b]; });
}
function acc(songs, opts){ let ok=0,n=0; for(const s of songs){ const r=lib.sectionsFromPrepared(s.prep,opts); for(let t=0.05;t<s.dur;t+=0.1){ const g=s.gt.find(x=>t>=x.start&&t<x.end); if(!g||g.label==='silence'||g.label==='end')continue; const e=r.sections.find(x=>t>=x.startTimeSec&&t<x.endTimeSec)??r.sections[r.sections.length-1]; n++; if(to7(e.type)===g.label) ok++; } } return ok/n; }
const lambdas=[0.003,0.01,0.03,0.1,0.3];
const folds=5; let bestL=null,bestA=-1;
for(const lam of lambdas){ let a=0; for(let f=0;f<folds;f++){ const tr=dev.filter((_,i)=>i%folds!==f), va=dev.filter((_,i)=>i%folds===f); const W=fit(tr,lam,800); a+=acc(va,{labelWeights:W}); } a/=folds; console.log('lambda',lam,'devCV acc',a.toFixed(3)); if(a>bestA){bestA=a;bestL=lam;} }
const W=fit(dev,bestL,3000);
console.log('rules: dev',acc(dev,{labelWith:'rules'}).toFixed(3),'test',acc(test,{labelWith:'rules'}).toFixed(3),'cn',acc(cnS,{labelWith:'rules'}).toFixed(3));
console.log('model: dev',acc(dev,{labelWeights:W}).toFixed(3),'test',acc(test,{labelWeights:W}).toFixed(3),'cn',acc(cnS,{labelWeights:W}).toFixed(3));
fs.writeFileSync(path.join(DIR,'weights.json'), JSON.stringify(W.map(r=>r.map(v=>Math.round(v*1000)/1000))));
console.log('lambda',bestL,'saved weights.json');
