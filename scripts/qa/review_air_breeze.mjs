#!/usr/bin/env node
/** Compare physical node motion against the rejected PR12 model, with original bindings. */
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baselineRef='7041010aa178d6661762a722162dc9494baf73f1';
const output=resolve(root,process.argv[2]??'artifacts/air-breeze/motion-review.json');
const cacheOutput=process.argv[3]?resolve(root,process.argv[3]):null;
const scratch=mkdtempSync(resolve(tmpdir(),'vermouth-baseline-'));
try {
 let source=execFileSync('git',['show',`${baselineRef}:src/features/portrait/renderer/hairPhysics.ts`],{cwd:root,encoding:'utf8'});
 source=source.replace("'../animation/portraitTimeline.ts'",JSON.stringify(pathToFileURL(resolve(root,'src/features/portrait/animation/portraitTimeline.ts')).href))
  .replace("'./hairTypes.ts'",JSON.stringify(pathToFileURL(resolve(root,'src/features/portrait/renderer/hairTypes.ts')).href));
 const baselinePath=resolve(scratch,'baseline.ts');writeFileSync(baselinePath,source);
 const baseline=await import(pathToFileURL(baselinePath));
 const current=await import(pathToFileURL(resolve(root,'src/features/portrait/renderer/hairPhysics.ts')));
 const meta=JSON.parse(readFileSync(resolve(root,'public/assets/portrait-rig/rig-256.json'),'utf8'));
 const locks=meta.locks.map(lock=>({...lock,pixels:new Uint32Array(),spine:Float32Array.from(lock.spine)}));
 const config={direction:1,gust:.35,stiffness:18,damping:5};
 const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
 const rms=a=>Math.sqrt(mean(a.map(v=>v*v)));
 const range=a=>Math.max(...a)-Math.min(...a);
 const correlation=(a,b)=>{let ma=mean(a),mb=mean(b),x=a.map(v=>v-ma),y=b.map(v=>v-mb);return mean(x.map((v,i)=>v*y[i]))/Math.max(1e-9,rms(x)*rms(y));};
 function scan(module){
  const engine=new module.HairPhysics(locks,config,256),poses=locks.map(l=>new Float32Array(l.spine.length));
  const selected=locks.map(l=>Array.from({length:10},(_,i)=>i+4).filter(n=>(l.spine[n*2]-128)**2+(l.spine[n*2+1]-128)**2<126**2));
  const trajectories=locks.map(()=>({x:[],y:[],tipX:[],tipY:[]}));
  for(let frame=0;frame<720;frame++){
   engine.sample(frame*1000/60,1,poses);
   for(let l=0;l<locks.length;l++){
    const set=selected[l],p=poses[l],r=locks[l].spine,t=trajectories[l];
    t.x.push(mean(set.map(n=>p[n*2]-r[n*2])));t.y.push(mean(set.map(n=>p[n*2+1]-r[n*2+1])));
    t.tipX.push(p[30]-r[30]);t.tipY.push(p[31]-r[31]);
   }
  }
  const velocities=trajectories.map(t=>({x:t.x.map((v,i)=>t.x[(i+1)%720]-v),y:t.y.map((v,i)=>t.y[(i+1)%720]-v)}));
  const pairs=[];for(let a=0;a<locks.length;a++)for(let b=a+1;b<locks.length;b++)pairs.push(correlation(velocities[a].y,velocities[b].y));
  const all=trajectories.flatMap(t=>t.x.map((x,i)=>({x,y:t.y[i]})));
  return {diagnostics:engine.diagnostics,allVisibleMiddle:{xRms:rms(all.map(v=>v.x)),yRms:rms(all.map(v=>v.y)),meanY:mean(all.map(v=>v.y)),verticalVelocityPairCorrelation:mean(pairs),absoluteVerticalVelocityPairCorrelation:mean(pairs.map(Math.abs))},locks:trajectories.map((t,l)=>({id:locks[l].id,nodes:selected[l],meanX:mean(t.x),meanY:mean(t.y),xRange:range(t.x),yRange:range(t.y),maxRise:-Math.min(...t.y),maxDrop:Math.max(...t.y),tipXRange:range(t.tipX),tipYRange:range(t.tipY),rmsXVelocity:rms(velocities[l].x),rmsYVelocity:rms(velocities[l].y),maxAcceleration:Math.max(...velocities[l].x.map((x,i)=>Math.hypot(velocities[l].x[(i+1)%720]-x,velocities[l].y[(i+1)%720]-velocities[l].y[i])))}))};
 }
 const report={baselineRef,currentSourceSha256:createHash('sha256').update(readFileSync(resolve(root,'src/features/portrait/renderer/hairPhysics.ts'))).digest('hex'),source:'Same canonical bindings;60Hz,720samples;mean displacement of rest-visible nodes4..13 within true radius126 circle. Units:256-grid pixels. This is not an aesthetic score or physical display measurement.',baseline:scan(baseline),current:scan(current)};
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 if(cacheOutput){const cache=new baseline.HairPhysics(locks,config,256).exportCache();mkdirSync(dirname(cacheOutput),{recursive:true});writeFileSync(cacheOutput,JSON.stringify({...cache,rest:cache.rest.map(a=>Array.from(a)),poses:cache.poses.map(a=>Array.from(a))}));}
 console.log(JSON.stringify({output,baseline:report.baseline.allVisibleMiddle,current:report.current.allVisibleMiddle}));
} finally {rmSync(scratch,{recursive:true,force:true});}
