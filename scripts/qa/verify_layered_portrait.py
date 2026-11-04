"""Validate the rebuilt cutout/mesh portrait against a running Vite dev server.

This probes actual materials, physical nodes, rendered pixels and the real player.
It is not a physical high-refresh display or video optical-flow benchmark.
"""
from __future__ import annotations

import argparse
import atexit
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.sync_api import sync_playwright


def portrait_url(url: str, **parameters: object) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.update({"view": "portrait", **{key: str(value) for key, value in parameters.items()}})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", default="http://127.0.0.1:5173/")
parser.add_argument("--output", type=Path, default=Path("artifacts/video-layered/qa.json"))
parser.add_argument("--chromium", default="/usr/bin/chromium")
args = parser.parse_args()
result = {"url": args.url, "status": "failed", "checks": [], "failures": [], "errors": [],
          "contract": "independent canonical hair cutouts, arc-bound meshes and fixed-step physical nodes; approved eyes and identity; circular crisp presentation",
          "motion_acceptance": {"visible_region": "actual circle centered at (128,128), radius126; no artificial y cutoff",
                                "each_side_long_lock": {"visible_middle_from_rest_px": 6, "visible_middle_travel_px": 5, "curvature_change_rad": .025, "complete_free_tip_from_rest_px": 9},
                                "at_least_one_long_lock": {"visible_middle_from_rest_px": 10, "visible_middle_travel_px": 8, "curvature_change_rad": .05, "complete_free_tip_from_rest_px": 18},
                                "free_tip_visibility": "Recorded separately; ends may leave the circular crop as in the registered video reference.",
                                "historical_gate_correction": "The first-pass artifact used an incorrect y<229 cutoff and required visible tips18px. The final gate uses the actual circle and visible middle travel plus complete free tip displacement; original failure evidence is retained."}}


def save() -> None:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")


atexit.register(save)


def check(name: str, condition: bool, detail=None) -> None:
    if detail is not None:
        result[name] = detail
    if not condition:
        failure = {"check": name, "detail": detail}
        result["failures"].append(failure)
        result.setdefault("failure", failure)
    else:
        result["checks"].append(name)


BAKED_EQUIVALENCE = r"""async({loaderModule,base})=>{
  const {loadBakedMaterials}=await import(loaderModule);
  const {createHairMaterials}=await import('/src/features/portrait/renderer/hairMaterials.ts');
  const {PortraitRig}=await import('/src/features/portrait/renderer/portraitRig.ts');
  const {loadImage}=await import('/src/features/portrait/renderer/portraitAsset.ts');
  const {createMotionTable,sampleBlink}=await import('/src/features/portrait/animation/portraitTimeline.ts');
  const compare=(expected,actual)=>{
    const report={arrayCount:0,arrayValuesCompared:0,metadataValuesCompared:0,mismatchedValues:0,arrays:[],examples:[]};
    const fail=(path,reason,wanted,received)=>{
      report.mismatchedValues++;
      if(report.examples.length<24)report.examples.push({path,reason,expected:wanted,actual:received});
    };
    const visit=(a,b,path)=>{
      if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){
        if(!ArrayBuffer.isView(a)||!ArrayBuffer.isView(b)){fail(path,'typed-array type',a?.constructor?.name,b?.constructor?.name);return;}
        report.arrayCount++;const detail={path,type:a.constructor.name,length:a.length,mismatches:0};report.arrays.push(detail);
        if(a.constructor.name!==b.constructor.name)fail(path,'typed-array constructor',a.constructor.name,b.constructor.name);
        if(a.length!==b.length)fail(path,'typed-array length',a.length,b.length);
        for(let index=0;index<Math.min(a.length,b.length);index++){
          report.arrayValuesCompared++;
          if(!Object.is(a[index],b[index])){detail.mismatches++;fail(path+'['+index+']','array value',a[index],b[index]);}
        }
        return;
      }
      if(Array.isArray(a)||Array.isArray(b)){
        if(!Array.isArray(a)||!Array.isArray(b)){fail(path,'array shape',Array.isArray(a),Array.isArray(b));return;}
        if(a.length!==b.length)fail(path,'array length',a.length,b.length);
        for(let index=0;index<Math.min(a.length,b.length);index++)visit(a[index],b[index],path+'['+index+']');
        return;
      }
      if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){
        const aKeys=Object.keys(a).sort(),bKeys=Object.keys(b).sort();
        if(JSON.stringify(aKeys)!==JSON.stringify(bKeys))fail(path,'object keys',aKeys,bKeys);
        for(const key of aKeys)if(Object.hasOwn(b,key))visit(a[key],b[key],path+'.'+key);
        return;
      }
      report.metadataValuesCompared++;
      if(!Object.is(a,b))fail(path,'metadata value',a,b);
    };
    visit(expected,actual,'materials');return report;
  };
  const grids=[];
  for(const size of [192,256,320]){
    const suffix=size===256?'':'-'+size;
    const [open,closed,underpaint,matte]=await Promise.all([
      ...['base','eyelids','underpaint'].map(name=>loadImage('/assets/portrait-natural/'+name+suffix+'.png')),
      loadImage('/assets/portrait-rig/hair-matte'+suffix+'.png'),
    ]);
    const source=createHairMaterials(open,closed,underpaint,size,matte),baked=await loadBakedMaterials(base,size);
    const equality=compare(source,baked),entry={size,...equality,phaseComparisons:[]};
    if(size===256&&equality.mismatchedValues===0){
      const authoringRig=new PortraitRig(open,closed,size,underpaint,matte),bakedRig=new PortraitRig(baked);
      const config={direction:1,gust:.35,stiffness:18,damping:5},table=createMotionTable(config);
      const context=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;return canvas.getContext('2d',{willReadFrequently:true});};
      const sourceContext=context(),bakedContext=context();
      try{
        await Promise.all([authoringRig.prepare(config),bakedRig.prepare(config)]);
        for(const time of [0,2000,2791.6666666666665,4510,6000,11300,11999])for(const gain of [0,.35,1]){
          const eyeOpen=sampleBlink(time);
          authoringRig.paint(sourceContext,table,time,gain,eyeOpen);bakedRig.paint(bakedContext,table,time,gain,eyeOpen);
          const expected=new Uint32Array(sourceContext.getImageData(0,0,size,size).data.buffer),actual=new Uint32Array(bakedContext.getImageData(0,0,size,size).data.buffer);
          let mismatchedPixels=0;for(let pixel=0;pixel<expected.length;pixel++)if(expected[pixel]!==actual[pixel])mismatchedPixels++;
          entry.phaseComparisons.push({time,gain,eyeOpen,mismatchedPixels});
        }
        entry.sharedDecodedMaterialsAfterRendering=compare(source,baked);
      }finally{authoringRig.destroy();bakedRig.destroy();}
    }
    grids.push(entry);
  }
  return grids;
}"""


PROBE = r"""async()=>{
  const {PortraitRig,EYES,inside}=await import('/src/features/portrait/renderer/portraitRig.ts');
  const {HairMesh}=await import('/src/features/portrait/renderer/hairMesh.ts');
  const {HAIR_NODES}=await import('/src/features/portrait/renderer/hairTypes.ts');
  const {loadImage,PALETTE}=await import('/src/features/portrait/renderer/portraitAsset.ts');
  const {createMotionTable,LOOP_MS,BLINK_CYCLE_MS,BLINK_STARTS,BLINK_DURATION_MS,sampleBlink}=await import('/src/features/portrait/animation/portraitTimeline.ts');
  const config={direction:1,gust:.35,stiffness:18,damping:5};
  const table=createMotionTable(config);
  const [open,closed,underpaint,matte]=await Promise.all([
    ...['base','eyelids','underpaint'].map(name=>loadImage(`/assets/portrait-natural/${name}.png`)),
    loadImage('/assets/portrait-rig/hair-matte.png'),
  ]);
  const size=256,rig=new PortraitRig(open,closed,size,underpaint,matte);
  await rig.prepare(config);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  const render=(time,gain=1,eye=1)=>{
    rig.paint(ctx,table,time,gain,eye);
    return new Uint32Array(ctx.getImageData(0,0,size,size).data.buffer);
  };
  const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
  const changed=(a,b,mask=null)=>a.reduce((n,value,index)=>n+((!mask||mask[index])&&value!==b[index]),0);
  const pixels=image=>{
    const c=document.createElement('canvas');c.width=c.height=size;const context=c.getContext('2d',{willReadFrequently:true});
    context.imageSmoothingEnabled=false;context.drawImage(image,0,0,size,size);
    return new Uint32Array(context.getImageData(0,0,size,size).data.buffer);
  };
  const canonical=pixels(open),rest=render(0,0),m=rig.materials;
  if(!m||!Array.isArray(m.locks)||!Array.isArray(rig.poses))throw Error('The rebuilt rig must expose materials and world-space poses for independent QA');
  const eyeMask=Uint8Array.from(canonical,(_,index)=>EYES.some(eye=>inside(index%size+.5,Math.floor(index/size)+.5,eye.polygon))?1:0);
  const circle=Uint8Array.from(canonical,(_,index)=>{
    const x=index%size+.5,y=Math.floor(index/size)+.5;
    return (x-128)**2+(y-128)**2<128**2&&!eyeMask[index]?1:0;
  });
  // Genuine foreground hair may occlude temples and shoulders. Identity is
  // tested at fixed central facial features, not by pinning all destination skin.
  const identityCore=[[108,87],[163,83],[175,102],[167,130],[144,156],[128,156],[108,137],[99,116]];
  const faceMask=Uint8Array.from(canonical,(value,index)=>value>>>24===255&&!eyeMask[index]&&inside(index%size+.5,Math.floor(index/size)+.5,identityCore)?1:0);
  const identityMaskMissing=faceMask.reduce((count,value,index)=>count+(value&&!m.faceMask[index]?1:0),0);
  const faceSurface=[[109,20],[160,20],[169,42],[185,65],[181,96],[167,124],[141,154],[128,155],[109,141],[91,119],[76,95],[66,78],[84,66],[104,60]];
  const surfaceMask=Uint8Array.from(canonical,(value,index)=>value>>>24===255&&inside(index%size+.5,Math.floor(index/size)+.5,faceSurface)?1:0);
  const palette=PALETTE.map(hex=>{
    const n=parseInt(hex.slice(1),16);return (0xff000000|(n&255)<<16|(n&0xff00)|n>>>16)>>>0;
  });
  const colors=new Set(palette),skinColors=new Set(palette.slice(17,27));
  const repairPixels=pixels(underpaint);
  const bodyPolygon=[[0,169],[18,161],[46,160],[69,165],[91,158],[101,145],[108,137],[159,137],[170,155],[187,152],[206,143],[223,131],[242,123],[256,121],[256,256],[0,256]];
  const fixedFacePolygon=[[89,87],[110,83],[174,82],[177,103],[168,130],[144,157],[128,158],[107,138],[98,122]];
  const necklace=[[98,166],[105,194],[116,218],[128,238],[136,243],[149,232],[162,210],[171,174]];
  const onNecklace=(x,y)=>{
    if(x>=128&&x<=143&&y>=237)return true;
    return necklace.slice(1).some((b,index)=>{
      const a=necklace[index],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
      return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)<2.5;
    });
  };
  let bodyMaskPixels=0,bodyMaskProtectedViolations=0;
  for(let pixel=0;pixel<canonical.length;pixel++)if(m.bodyMask[pixel]){
    bodyMaskPixels++;const x=pixel%size+.5,y=Math.floor(pixel/size)+.5;
    if(canonical[pixel]>>>24!==255||!inside(x,y,bodyPolygon)||inside(x,y,fixedFacePolygon)||onNecklace(x,y))bodyMaskProtectedViolations++;
  }
  const reviewedShadowRegions=[{side:-1,bounds:[[49,197,59,216],[82,203,92,212]]},{side:1,bounds:[[164,188,180,220],[195,228,202,242]]}];
  const shadowSources=m.shadows.map(item=>{
    const hair=m.locks[item.lock];let opaque=0,sourceMismatch=0,outsideReviewed=0,hairContamination=0,unclearedSource=0,repairMismatch=0,protectedFaceOverlap=0;
    for(let pixel=0;pixel<canonical.length;pixel++){
      const value=item.material.pixels[pixel];if(!(value>>>24))continue;opaque++;
      const x=pixel%size,y=Math.floor(pixel/size),regions=reviewedShadowRegions.find(region=>region.side===item.material.side)?.bounds??[];
      if(!regions.some(([x0,y0,x1,y1])=>x>=x0&&x<=x1&&y>=y0&&y<=y1))outsideReviewed++;
      if(value!==canonical[pixel]||!skinColors.has(value)||value===repairPixels[pixel])sourceMismatch++;
      if(m.ownership[pixel]>=0)hairContamination++;
      if(m.clean[pixel]===value)unclearedSource++;
      if(m.clean[pixel]!==repairPixels[pixel])repairMismatch++;
      if(m.faceMask[pixel])protectedFaceOverlap++;
    }
    return{id:item.id,lock:hair?.id,opaque,sourceMismatch,outsideReviewed,hairContamination,unclearedSource,repairMismatch,protectedFaceOverlap,
      correctCurl:hair?.id===(item.material.side===-1?'curl-left':'curl-right'),sameSpine:!!hair&&equal(item.material.spine,hair.spine),
      poseVertexMismatch:0,movingPixels:0,maximumVisiblePixels:0,minimumCentroidX:Infinity,maximumCentroidX:-Infinity,minimumCentroidY:Infinity,maximumCentroidY:-Infinity};
  });
  const expectedShadowMeshes=m.shadows.map(item=>new HairMesh(item.material,size)),shadowReference=[];
  const shadowFrames=[];
  // The static fast path intentionally bypasses decomposition. Independently
  // compose the actual rest meshes as well, so it cannot conceal missing art
  // in the clean/hair/shadow/jewelry separation.
  const decomposedRest=new Uint32Array(canonical.length),orderedLocks=m.locks.toSorted((a,b)=>a.z-b.z);
  for(const lock of orderedLocks)if(lock.z<0)new HairMesh(lock,size).draw(decomposedRest);
  for(let pixel=0;pixel<canonical.length;pixel++)if(m.clean[pixel]>>>24===255)decomposedRest[pixel]=m.clean[pixel];
  const restShadows=new Uint32Array(canonical.length);
  for(const shadow of m.shadows)new HairMesh(shadow.material,size).draw(restShadows);
  for(let pixel=0;pixel<canonical.length;pixel++)if(m.bodyMask[pixel]&&restShadows[pixel]>>>24===255)decomposedRest[pixel]=restShadows[pixel];
  for(const item of rig.jewelry)new HairMesh(item.mesh.material,size).draw(decomposedRest);
  for(const lock of orderedLocks)if(lock.z>=0)new HairMesh(lock,size).draw(decomposedRest);
  const restCompositeMismatch=changed(canonical,decomposedRest);
  let owned=0,ownershipMissing=0,unclearedOwned=0,ownedBackgroundClear=0,canonicalMaterialMismatch=0;
  for(let index=0;index<canonical.length;index++){
    const owner=m.ownership[index];
    if(owner<0)continue;
    owned++;
    const lock=m.locks[owner];
    if(!lock||!(lock.pixels[index]>>>24))ownershipMissing++;
    else if(lock.pixels[index]!==canonical[index])canonicalMaterialMismatch++;
    if((m.clean[index]>>>24)===0)ownedBackgroundClear++;
    if(m.clean[index]===canonical[index])unclearedOwned++;
  }
  // A blonde highlight may legitimately equal reconstructed skin. Detect
  // preserved *texture*, not isolated same-color pixels: a multi-color 3x3
  // owned patch needs at least five exact source pixels and an exact non-skin
  // color before it is evidence of an unmoved hair copy in the clean plate.
  const retainedTexture=[],ambiguousSkinTexture=[],unownedEdgeTexture=[];
  for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){
    const index=y*size+x,owner=m.ownership[index];if(owner<0)continue;
    let ownedPatch=0,exact=0,nonSkinExact=0;const patchColors=new Set();
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const pixel=(y+dy)*size+x+dx;if(m.ownership[pixel]!==owner)continue;
      ownedPatch++;
      if(canonical[pixel]===m.clean[pixel]){
        exact++;patchColors.add(canonical[pixel]);
        if(!skinColors.has(canonical[pixel]))nonSkinExact++;
      }
    }
    if(ownedPatch>=6&&exact>=5&&patchColors.size>=2){
      const evidence={x,y,index,id:m.locks[owner]?.id,exact,colors:Array.from(patchColors,value=>'#'+(value&255).toString(16).padStart(2,'0')+(value>>>8&255).toString(16).padStart(2,'0')+(value>>>16&255).toString(16).padStart(2,'0')),nonSkinExact};
      if(nonSkinExact>0)retainedTexture.push(evidence);else ambiguousSkinTexture.push(evidence);
    }
  }
  for(let y=10;y<size-1;y++)for(let x=1;x<size-1;x++){
    const index=y*size+x;
    if(m.ownership[index]>=0||m.faceMask[index]||canonical[index]!==m.clean[index]||canonical[index]>>>24!==255)continue;
    let adjacentHair=0,exact=0;const patchColors=new Set();
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const pixel=(y+dy)*size+x+dx;
      if(m.ownership[pixel]>=0)adjacentHair++;
      if(canonical[pixel]===m.clean[pixel]&&canonical[pixel]>>>24===255){exact++;patchColors.add(canonical[pixel]);}
    }
    if(adjacentHair>=2&&exact>=4&&patchColors.size>=2)unownedEdgeTexture.push({x,y,index,adjacentHair,exact,source:canonical[index]});
  }
  const locks=m.locks.map((lock,group)=>{
    let opaque=0,partial=0,unexpected=0,orphanPixels=0,underlapPixels=0,underlapSourceMismatch=0,underlapDepthError=0,arc=0,turn=0;
    for(let index=0;index<lock.pixels.length;index++){
      const value=lock.pixels[index],alpha=value>>>24;
      if(alpha===255)opaque++;else if(alpha!==0)partial++;
      if(alpha&&!colors.has(value))unexpected++;
      if(alpha&&m.ownership[index]<0)orphanPixels++;
      if(alpha&&m.ownership[index]>=0&&m.ownership[index]!==group){
        underlapPixels++;if(value!==canonical[index])underlapSourceMismatch++;
        if(m.locks[m.ownership[index]].z<=lock.z)underlapDepthError++;
      }
    }
    for(let node=1;node<HAIR_NODES;node++)arc+=Math.hypot(lock.spine[node*2]-lock.spine[node*2-2],lock.spine[node*2+1]-lock.spine[node*2-1]);
    for(let node=2;node<HAIR_NODES;node++){
      const ax=lock.spine[node*2-2]-lock.spine[node*2-4],ay=lock.spine[node*2-1]-lock.spine[node*2-3];
      const bx=lock.spine[node*2]-lock.spine[node*2-2],by=lock.spine[node*2+1]-lock.spine[node*2-1];
      turn+=Math.abs(Math.atan2(ax*by-ay*bx,ax*bx+ay*by));
    }
    return{id:lock.id,z:lock.z,side:lock.side,opaque,partial,unexpected,orphanPixels,underlapPixels,underlapSourceMismatch,underlapDepthError,arc,turn,nodes:lock.spine.length/2};
  });
  const phases=[],poses=[],times=Array.from({length:48},(_,i)=>i*250);
  const blueColors=new Set(['#0a1b2e','#113954','#155a7e','#1b75a6','#2d95c3','#56b9d7','#a4e2e6'].map(hex=>{
    const n=parseInt(hex.slice(1),16);return (0xff000000|(n&255)<<16|(n&0xff00)|n>>>16)>>>0;
  }));
  const jewelry=rig.jewelry.map(item=>{
    let opaque=0,blue=0,chain=0,sourceMismatch=0,blueStaticCopies=0;
    for(let pixel=0;pixel<canonical.length;pixel++){
      const value=item.mesh.material.pixels[pixel];if(!(value>>>24))continue;
      opaque++;if(value!==canonical[pixel])sourceMismatch++;
      if(blueColors.has(value)){blue++;if(m.clean[pixel]===value)blueStaticCopies++;}
      if(Math.floor(pixel/size)<item.root[1]+20)chain++;
    }
    return{id:item.mesh.material.id,opaque,blue,chain,sourceMismatch,blueStaticCopies,rootDrift:0,rigidLengthError:0};
  });
  const meshPeaks=rig.meshes.map(mesh=>({id:mesh.material.id,vertices:mesh.diagnostics.vertices,triangles:mesh.diagnostics.triangles,foldedTriangles:0,foldTime:null,minimumArea:Infinity,degenerateTriangles:0,nonfiniteVertices:0,rasterCandidates:0,paintedPixels:0}));
  const shadowMeshPeaks=rig.shadowMeshes.map(mesh=>({id:mesh.material.id,vertices:mesh.diagnostics.vertices,triangles:mesh.diagnostics.triangles,foldedTriangles:0,foldTime:null,minimumArea:Infinity,degenerateTriangles:0,nonfiniteVertices:0}));
  for(const time of times){
    phases.push(render(time));poses.push(rig.poses.map(pose=>new Float32Array(pose)));
    const shadowStats={time,...rig.shadowDiagnostics};
    for(let shadow=0;shadow<rig.shadowMeshes.length;shadow++){
      const mesh=rig.shadowMeshes[shadow],stats=shadowSources[shadow],reference=expectedShadowMeshes[shadow];
      reference.update(rig.poses[m.shadows[shadow].lock]);
      for(let vertex=0;vertex<mesh.positions.length;vertex++)stats.poseVertexMismatch=Math.max(stats.poseVertexMismatch,Math.abs(mesh.positions[vertex]-reference.positions[vertex]));
      const raw=new Uint32Array(canonical.length);mesh.draw(raw);
      let visible=0,sumX=0,sumY=0;
      for(let pixel=0;pixel<raw.length;pixel++)if(raw[pixel]>>>24&&m.bodyMask[pixel]){visible++;sumX+=pixel%size+.5;sumY+=Math.floor(pixel/size)+.5;}
      stats.maximumVisiblePixels=Math.max(stats.maximumVisiblePixels,visible);
      if(visible){stats.minimumCentroidX=Math.min(stats.minimumCentroidX,sumX/visible);stats.maximumCentroidX=Math.max(stats.maximumCentroidX,sumX/visible);stats.minimumCentroidY=Math.min(stats.minimumCentroidY,sumY/visible);stats.maximumCentroidY=Math.max(stats.maximumCentroidY,sumY/visible);}
      if(!shadowReference[shadow])shadowReference[shadow]=raw;else stats.movingPixels=Math.max(stats.movingPixels,changed(raw,shadowReference[shadow]));
    }
    rig.meshes.forEach((mesh,index)=>{
      const peak=meshPeaks[index];
      if(mesh.diagnostics.foldedTriangles>peak.foldedTriangles){peak.foldedTriangles=mesh.diagnostics.foldedTriangles;peak.foldTime=time;}
      peak.rasterCandidates=Math.max(peak.rasterCandidates,mesh.diagnostics.rasterCandidates);
      peak.paintedPixels=Math.max(peak.paintedPixels,mesh.diagnostics.paintedPixels);
      for(const value of mesh.positions)if(!Number.isFinite(value))peak.nonfiniteVertices++;
    });
    rig.jewelry.forEach((item,index)=>{
      const stats=jewelry[index],spine=item.mesh.material.spine;
      stats.rootDrift=Math.max(stats.rootDrift,Math.hypot(item.pose[0]-item.root[0],item.pose[1]-item.root[1]));
      for(let node=1;node<HAIR_NODES;node++){
        const length=Math.hypot(item.pose[node*2]-item.root[0],item.pose[node*2+1]-item.root[1]);
        const restLength=Math.hypot(spine[node*2]-item.root[0],spine[node*2+1]-item.root[1]);
        stats.rigidLengthError=Math.max(stats.rigidLengthError,Math.abs(length-restLength));
      }
    });
    // Compare the actual compositor with these same shadow layers omitted.
    // Only body-mask destinations may differ; hair is still allowed to occlude
    // moving shadows and shadows may pass through their former coordinates.
    const drawFunctions=rig.shadowMeshes.map(mesh=>mesh.draw);
    rig.shadowMeshes.forEach(mesh=>{mesh.draw=()=>{}});
    let withoutShadows;
    try{withoutShadows=render(time);}finally{rig.shadowMeshes.forEach((mesh,index)=>{mesh.draw=drawFunctions[index]});}
    let outsideBodyChanges=0,visibleChanges=0;
    for(let pixel=0;pixel<canonical.length;pixel++)if(withoutShadows[pixel]!==phases[phases.length-1][pixel]){visibleChanges++;if(!m.bodyMask[pixel])outsideBodyChanges++;}
    shadowFrames.push({...shadowStats,visibleChanges,outsideBodyChanges});
  }
  // Independently inspect every cached phase's geometric winding. This is
  // denser than the captured color frames and does not trust draw() counters.
  const topologyPhases=Math.round(LOOP_MS*120/1000);
  for(let phase=0;phase<topologyPhases;phase++){
    const time=phase*1000/120;rig.physics.sample(time,1,rig.poses);
    const topology=[...rig.meshes.map((mesh,index)=>({mesh,pose:rig.poses[index],peak:meshPeaks[index]})),
      ...rig.shadowMeshes.map((mesh,index)=>({mesh,pose:rig.poses[m.shadows[index].lock],peak:shadowMeshPeaks[index]}))];
    topology.forEach(({mesh,pose,peak})=>{
      mesh.update(pose);const p=mesh.positions;
      peak.maximumAreaProjections=Math.max(peak.maximumAreaProjections??0,mesh.diagnostics.areaProjections??0);
      peak.maximumCorrectedVertices=Math.max(peak.maximumCorrectedVertices??0,mesh.diagnostics.correctedVertices??0);
      peak.maximumVertexCorrection=Math.max(peak.maximumVertexCorrection??0,mesh.diagnostics.maxVertexCorrection??0);
      peak.minimumAreaRatio=Math.min(peak.minimumAreaRatio??1,mesh.diagnostics.minimumAreaRatio??1);
      let folded=0,degenerate=0;
      for(const value of p)if(!Number.isFinite(value))peak.nonfiniteVertices++;
      for(let triangle=0;triangle<mesh.triangles.length;triangle+=3){
        const a=mesh.triangles[triangle]*2,b=mesh.triangles[triangle+1]*2,c=mesh.triangles[triangle+2]*2;
        const area=(p[b+1]-p[c+1])*(p[a]-p[c])+(p[c]-p[b])*(p[a+1]-p[c+1]);
        if(!Number.isFinite(area)||Math.abs(area)<1e-7)degenerate++;
        if(area<0)folded++;
        if(area<0&&area<peak.minimumArea){
          peak.foldDetails={time,triangle:triangle/3,source:[a,b,c].map(vertex=>[mesh.rest[vertex],mesh.rest[vertex+1]]),positions:[a,b,c].map(vertex=>[p[vertex],p[vertex+1]])};
        }
        peak.minimumArea=Math.min(peak.minimumArea,area);
      }
      peak.degenerateTriangles=Math.max(peak.degenerateTriangles,degenerate);
      if(folded>peak.foldedTriangles){peak.foldedTriangles=folded;peak.foldTime=time;}
    });
  }
  const perLock=m.locks.map((lock,group)=>{
    let root=0,lengthError=0,middle=0,tip=0,visibleMiddle=0,visibleTip=0,visibleMiddleTravel=0,visibleTipTravel=0,angleChange=0,peakFrame=0;
    const spine=lock.spine;
    const bend=pose=>{
      const a=3,b=7,c=11;
      const ax=pose[b*2]-pose[a*2],ay=pose[b*2+1]-pose[a*2+1];
      const bx=pose[c*2]-pose[b*2],by=pose[c*2+1]-pose[b*2+1];
      return Math.atan2(ax*by-ay*bx,ax*bx+ay*by);
    };
    for(let frame=0;frame<poses.length;frame++){
      const pose=poses[frame][group];
      for(let node=0;node<HAIR_NODES;node++){
        const x=pose[node*2],y=pose[node*2+1],distance=Math.hypot(x-spine[node*2],y-spine[node*2+1]);
        if(node<2)root=Math.max(root,distance);
        const visible=(x-128)**2+(y-128)**2<126**2;
        if(node>=4&&node<=11){middle=Math.max(middle,distance);if(visible&&distance>visibleMiddle){visibleMiddle=distance;peakFrame=frame;}}
        if(node>=12){tip=Math.max(tip,distance);if(visible)visibleTip=Math.max(visibleTip,distance);}
        if(node){
          const restLength=Math.hypot(spine[node*2]-spine[node*2-2],spine[node*2+1]-spine[node*2-1]);
          const length=Math.hypot(x-pose[node*2-2],y-pose[node*2-1]);
          if(restLength>1e-6)lengthError=Math.max(lengthError,Math.abs(length/restLength-1));
        }
      }
      let turn=bend(pose)-bend(spine);turn=Math.atan2(Math.sin(turn),Math.cos(turn));angleChange=Math.max(angleChange,Math.abs(turn));
    }
    // Actual within-cycle travel distinguishes flowing movement from a large
    // but nearly static offset introduced by a warmed physical equilibrium.
    for(let node=4;node<HAIR_NODES;node++)for(let a=0;a<poses.length;a++)for(let b=a+1;b<poses.length;b++){
      const p=poses[a][group],q=poses[b][group],x=p[node*2],y=p[node*2+1],u=q[node*2],v=q[node*2+1];
      if((x-128)**2+(y-128)**2>=126**2||(u-128)**2+(v-128)**2>=126**2)continue;
      const distance=Math.hypot(x-u,y-v);
      if(node<=11)visibleMiddleTravel=Math.max(visibleMiddleTravel,distance);else visibleTipTravel=Math.max(visibleTipTravel,distance);
    }
    return{id:lock.id,side:lock.side,arc:locks[group].arc,root,lengthError,middle,tip,visibleMiddle,visibleTip,visibleMiddleTravel,visibleTipTravel,angleChange,peakTime:times[peakFrame]};
  });
  let partialAlpha=0,unexpectedColor=0,opaqueCleanHoles=0,faceSurfaceHoles=0,faceChanged=0,clearAtRest=0,solidAtRest=0;
  for(let index=0;index<canonical.length;index++){
    const alpha=rest[index]>>>24;if(alpha===0)clearAtRest++;else if(alpha===255)solidAtRest++;
    for(const frame of phases){
      const alpha=frame[index]>>>24;
      if(alpha!==0&&alpha!==255)partialAlpha++;
      if(alpha&&!colors.has(frame[index]))unexpectedColor++;
      if((m.clean[index]>>>24)===255&&alpha!==255)opaqueCleanHoles++;
      if(surfaceMask[index]&&alpha!==255)faceSurfaceHoles++;
      if(faceMask[index]&&frame[index]!==canonical[index])faceChanged++;
    }
  }
  const circleWindows=phases.map((frame,index)=>({start:times[index],changed500ms:changed(frame,phases[(index+2)%phases.length],circle)}));
  const markStatic=evidence=>evidence.map(item=>({...item,unchangedFrames:phases.reduce((n,frame)=>n+(frame[item.index]===canonical[item.index]?1:0),0)}));
  const bodyShadowRegions=[[164,188,180,220],[49,197,59,216],[195,228,202,242],[82,203,92,212]];
  const staticBodyShadows=bodyShadowRegions.map(bounds=>{
    const samples=[];
    for(let y=bounds[1];y<=bounds[3];y++)for(let x=bounds[0];x<=bounds[2];x++){
      const index=y*size+x,source=canonical[index],repair=repairPixels[index];
      if(m.ownership[index]>=0||source!==m.clean[index]||source===repair||!skinColors.has(source)||!skinColors.has(repair))continue;
      const unchangedFrames=phases.reduce((n,frame)=>n+(frame[index]===source?1:0),0);
      if(unchangedFrames>=36)samples.push({x,y,source,repair,unchangedFrames});
    }
    return{bounds,count:samples.length,samples:samples.filter((_,index)=>index%Math.max(1,Math.floor(samples.length/12))===0).slice(0,12)};
  });
  const silhouette=phases.map((frame,index)=>{
    let opened=0,closed=0;
    for(let pixel=0;pixel<frame.length;pixel++)if(circle[pixel]&&((m.clean[pixel]>>>24)===0)){
      const was=rest[pixel]>>>24,now=frame[pixel]>>>24;
      if(was===255&&now===0)opened++;
      if(was===0&&now===255)closed++;
    }
    return{time:times[index],opened,closed};
  });
  const openEyes=render(4510,1,1),shutEyes=render(4510,1,0);
  let eyeChanged=0,outsideEyes=0;
  for(let i=0;i<openEyes.length;i++)if(openEyes[i]!==shutEyes[i]){eyeChanged++;if(!eyeMask[i])outsideEyes++;}
  const snapshots=time=>{render(time);return rig.poses.map(p=>new Float32Array(p));};
  const minus=snapshots(-1),center=snapshots(0),plus=snapshots(1),seam={positionStep:0,velocityDifference:0};
  for(let group=0;group<m.locks.length;group++)for(let i=0;i<center[group].length;i++){
    seam.positionStep=Math.max(seam.positionStep,Math.abs(plus[group][i]-minus[group][i]));
    seam.velocityDifference=Math.max(seam.velocityDifference,Math.abs(plus[group][i]-2*center[group][i]+minus[group][i]));
  }
  const repeatTimes=[0,500,1200,2000,2700,3400,4400,4500,5200,6000,8400,11300,11999];
  const reference=repeatTimes.map(time=>render(time));let repeatMismatches=0;
  for(const cycle of [1,2,10,50,100])for(let i=0;i<repeatTimes.length;i++)if(!equal(reference[i],render(repeatTimes[i]+cycle*LOOP_MS)))repeatMismatches++;
  const blinkEvents=BLINK_STARTS.map(start=>({start,closed:sampleBlink(start+100),otherWindCycleEye:sampleBlink(start+100+LOOP_MS),windChanges:changed(render(start),render(start+BLINK_DURATION_MS),circle)}));
  const meshDiagnostics=rig.meshes?.map(mesh=>mesh.diagnostics??null)??null;
  return{size,sourceSize:[open.naturalWidth,open.naturalHeight],canonicalRest:equal(rest,canonical),zeroWind:equal(rest,render(5000,0)),
    windLoop:LOOP_MS,blinkCycle:BLINK_CYCLE_MS,locks,owned,ownershipMissing,canonicalMaterialMismatch,restCompositeMismatch,unclearedOwned,ownedBackgroundClear,retainedTexture:markStatic(retainedTexture),ambiguousSkinTexture:markStatic(ambiguousSkinTexture),unownedEdgeTexture:markStatic(unownedEdgeTexture),staticBodyShadows,
    facePixels:faceMask.reduce((n,v)=>n+(v?1:0),0),identityMaskMissing,faceChanged,partialAlpha,unexpectedColor,opaqueCleanHoles,faceSurfaceHoles,clearAtRest,solidAtRest,
    perLock,circleWindows,silhouette,eyeChanged,outsideEyes,seam,repeatMismatches,blinkEvents,jewelry,bodyMaskPixels,bodyMaskProtectedViolations,shadowSources,shadowFrames,
    physics:rig.physics?.diagnostics??null,meshDiagnostics,meshPeaks,shadowMeshPeaks,topologyPhases};
}"""


REFRESH = r"""async()=>{
  const {PortraitPlayer}=await import('/src/features/portrait/animation/portraitPlayer.ts');
  const {readStageOptions}=await import('/src/features/portrait/animation/stageOptions.ts');
  const nativeRAF=window.requestAnimationFrame,nativeCancel=window.cancelAnimationFrame;
  const startElapsed=20100,checkpoints=[100,200,250,300,320,400,480,800,1200,2000],duration=2000;
  const run=async hz=>{
    let id=0;const queue=new Map();
    window.requestAnimationFrame=callback=>{queue.set(++id,callback);return id;};
    window.cancelAnimationFrame=id=>queue.delete(id);
    const canvas=document.createElement('canvas'),player=new PortraitPlayer(canvas,readStageOptions(''));
    try{
      for(let i=0;canvas.dataset.ready!=='true'&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));
      if(canvas.dataset.ready!=='true')throw Error('Controlled player did not load');
      player.elapsed=startElapsed;player.last=null;
      const times=new Set(checkpoints);for(let frame=0;frame<=Math.ceil(duration*hz/1000);frame++){const time=frame*1000/hz;if(time<duration)times.add(time);}
      const samples=[];let maxQueued=0,callbacks=0;
      for(const time of [...times].sort((a,b)=>a-b)){
        const pending=[...queue.values()];queue.clear();maxQueued=Math.max(maxQueued,pending.length);
        for(const callback of pending){callbacks++;callback(1000+time);}
        if(checkpoints.includes(time))samples.push({time,elapsed:player.elapsed,pixels:canvas.toDataURL()});
      }
      return{hz,maxQueued,callbacks,samples};
    }finally{player.destroy();}
  };
  try{
    const runs=[];for(const hz of [60,120,144,240])runs.push(await run(hz));
    const baseline=runs[0];
    return{kind:'Controlled rAF timestamps with real PortraitPlayer pixels; not a physical-display FPS measurement',runs:runs.map(run=>({hz:run.hz,maxQueued:run.maxQueued,callbacks:run.callbacks,
      maxTimeError:Math.max(...run.samples.map(sample=>Math.abs(sample.elapsed-startElapsed-sample.time))),
      identicalPixels:run.samples.every((sample,index)=>sample.pixels===baseline.samples[index].pixels)}))};
  }finally{window.requestAnimationFrame=nativeRAF;window.cancelAnimationFrame=nativeCancel;}
}"""


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=args.chromium, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1200, "height": 1000})
    page.set_default_timeout(120000)
    page.on("pageerror", lambda error: result["errors"].append(str(error)))
    page.on("response", lambda response: result["errors"].append(f"HTTP{response.status}: {response.url}") if response.status >= 400 else None)
    page.goto(portrait_url(args.url, pose=1))
    page.wait_for_selector("canvas[data-ready=true][data-painted=true]")
    check("default_is_pixel_portrait", page.locator("canvas").get_attribute("data-style") == "portrait")
    check("normal_portrait_has_no_developer_controls", page.locator("button,summary,input,.hud").count() == 0)
    check("nearest_neighbor_logical_grid", page.locator("canvas").evaluate('(c)=>c.width===256&&c.height===256&&getComputedStyle(c).imageRendering==="pixelated"'))
    canonical = page.locator("canvas").evaluate("c=>c.toDataURL()")
    for grid in [192, 256, 320]:
        page.goto(portrait_url(args.url, t=2000, pixel=grid))
        page.wait_for_selector("canvas[data-ready=true][data-painted=true]")
        check(f"reviewed_grid_{grid}", page.locator("canvas").evaluate("c=>[c.width,c.height]") == [grid, grid])
    page.goto(portrait_url(args.url, pose=10))
    page.wait_for_selector("canvas[data-ready=true][data-painted=true]")
    check("canonical_pose1_pose10_are_identical", canonical == page.locator("canvas").evaluate("c=>c.toDataURL()"))
    baked_equivalence = page.evaluate(BAKED_EQUIVALENCE, {
        "loaderModule": "/src/features/portrait/renderer/bakedMaterials.ts",
        "base": "/assets/portrait-rig/",
    })
    result["baked_equivalence"] = baked_equivalence
    for grid in baked_equivalence:
        check(f"baked_materials_{grid['size']}_match_all_authoring_arrays_and_metadata", grid["mismatchedValues"] == 0 and grid["arrayCount"] >= 27 and grid["metadataValuesCompared"] > 100, grid)
    baked_default = next(grid for grid in baked_equivalence if grid["size"] == 256)
    check("baked_and_authoring_constructors_render_identical_phases", len(baked_default["phaseComparisons"]) == 21 and all(phase["mismatchedPixels"] == 0 for phase in baked_default["phaseComparisons"]), baked_default["phaseComparisons"])
    immutable = baked_default.get("sharedDecodedMaterialsAfterRendering")
    check("constructing_and_rendering_rigs_keeps_shared_baked_materials_immutable", immutable is not None and immutable["mismatchedValues"] == 0 and immutable["arrayCount"] >= 27, immutable)
    metrics = page.evaluate(PROBE)
    result["rig"] = metrics
    check("canonical_identity_and_zero_wind_are_exact", metrics["canonicalRest"] and metrics["zeroWind"])
    check("decomposed_rest_meshes_reconstruct_canonical_exactly", metrics["restCompositeMismatch"] == 0, {"mismatchedPixels":metrics["restCompositeMismatch"]})
    check("independent_complete_cutout_materials", len(metrics["locks"]) >= 8 and len({lock["id"] for lock in metrics["locks"]}) == len(metrics["locks"]) and all(lock["opaque"] > 15 and lock["nodes"] == 16 for lock in metrics["locks"]), metrics["locks"])
    check("cutouts_keep_canonical_pixels_and_explicit_ownership", metrics["owned"] > 5000 and metrics["ownershipMissing"] == 0 and metrics["canonicalMaterialMismatch"] == 0 and all(lock["orphanPixels"] == 0 and lock["underlapSourceMismatch"] == 0 for lock in metrics["locks"]), {key: metrics[key] for key in ["owned", "ownershipMissing", "canonicalMaterialMismatch"]})
    check("movable_hair_texture_is_removed_from_static_plate", metrics["ownedBackgroundClear"] > 1000 and not metrics["retainedTexture"], {key: metrics[key] for key in ["ownedBackgroundClear", "unclearedOwned", "owned", "retainedTexture"]})
    check("hidden_underlaps_only_use_original_hair_behind_its_owner", all(lock["underlapDepthError"] == 0 for lock in metrics["locks"]), [{"id":lock["id"],"underlapPixels":lock["underlapPixels"],"depthErrors":lock["underlapDepthError"]} for lock in metrics["locks"]])
    check("reviewed_cast_shadows_are_separate_original_skin_materials", len(metrics["shadowSources"]) == 2 and all(shadow["opaque"] > 50 and shadow["sourceMismatch"] == 0 and shadow["outsideReviewed"] == 0 and shadow["hairContamination"] == 0 and shadow["protectedFaceOverlap"] == 0 for shadow in metrics["shadowSources"]), metrics["shadowSources"])
    check("static_clean_plate_removes_reviewed_old_cast_shadow_texture", all(shadow["unclearedSource"] == 0 and shadow["repairMismatch"] == 0 for shadow in metrics["shadowSources"]), metrics["shadowSources"])
    check("moving_cast_shadows_bind_to_their_own_curl_pose", all(shadow["correctCurl"] and shadow["sameSpine"] and shadow["poseVertexMismatch"] < .0001 and shadow["movingPixels"] > 50 and shadow["maximumVisiblePixels"] > 20 and max(shadow["maximumCentroidX"]-shadow["minimumCentroidX"],shadow["maximumCentroidY"]-shadow["minimumCentroidY"]) > 3 for shadow in metrics["shadowSources"]), metrics["shadowSources"])
    check("cast_shadow_composition_cannot_paint_face_necklace_or_background", metrics["bodyMaskPixels"] > 1000 and metrics["bodyMaskProtectedViolations"] == 0 and all(frame["outsideBodyChanges"] == 0 for frame in metrics["shadowFrames"]) and max(frame["visibleChanges"] for frame in metrics["shadowFrames"]) > 20, {"bodyMaskPixels":metrics["bodyMaskPixels"],"protectedViolations":metrics["bodyMaskProtectedViolations"],"frames":metrics["shadowFrames"]})
    check("cutouts_bind_curved_arc_length_spines", sum(lock["turn"] > .25 and lock["arc"] > 50 for lock in metrics["locks"]) >= 4)
    check("fixed_canonical_face_features", metrics["facePixels"] > 3000 and metrics["identityMaskMissing"] == 0 and metrics["faceChanged"] == 0, {key: metrics[key] for key in ["facePixels", "identityMaskMissing", "faceChanged"]})
    check("anchored_proximal_nodes_do_not_drift", all(lock["root"] < .0001 for lock in metrics["perLock"]), metrics["perLock"])
    check("material_length_is_constrained", all(lock["lengthError"] <= .035 for lock in metrics["perLock"]), [{"id": lock["id"], "maximum_relative_error": lock["lengthError"]} for lock in metrics["perLock"]])
    long_locks = [lock for lock in metrics["perLock"] if lock["id"] in ("curl-left", "curl-right")]
    visible = [lock for lock in long_locks if lock["visibleMiddle"] >= 6 and lock["visibleMiddleTravel"] >= 5 and lock["tip"] >= 9 and lock["angleChange"] >= .025]
    strong = [lock for lock in long_locks if lock["visibleMiddle"] >= 10 and lock["visibleMiddleTravel"] >= 8 and lock["tip"] >= 18 and lock["angleChange"] >= .05]
    check("both_sides_have_visible_bending_and_free_tip_motion", {lock["side"] for lock in visible} == {-1, 1} and len(strong) >= 1, metrics["perLock"])
    check("changing_visible_silhouette_opens_and_closes_real_gaps", max(item["opened"] for item in metrics["silhouette"]) > 50 and max(item["closed"] for item in metrics["silhouette"]) > 50, metrics["silhouette"])
    check("hair_continues_through_the_entire_wind_period", all(window["changed500ms"] > 0 for window in metrics["circleWindows"]), metrics["circleWindows"])
    check("opaque_face_and_static_surface_never_develop_holes", metrics["opaqueCleanHoles"] == 0 and metrics["faceSurfaceHoles"] == 0, {key:metrics[key] for key in ["opaqueCleanHoles", "faceSurfaceHoles"]})
    check("palette_and_binary_alpha_survive_mesh_raster", metrics["partialAlpha"] == 0 and metrics["unexpectedColor"] == 0 and all(lock["partial"] == 0 and lock["unexpected"] == 0 for lock in metrics["locks"]))
    check("mesh_vertices_and_rendered_cutouts_remain_valid", all(mesh["vertices"] > 0 and mesh["triangles"] > 0 and mesh["nonfiniteVertices"] == 0 and mesh["degenerateTriangles"] == 0 and mesh["paintedPixels"] > 0 for mesh in metrics["meshPeaks"]), metrics["meshPeaks"])
    check("default_wind_meshes_do_not_flip_triangles", all(mesh["foldedTriangles"] == 0 for mesh in metrics["meshPeaks"]), metrics["meshPeaks"])
    check("moving_cast_shadow_meshes_keep_positive_finite_geometry", all(mesh["vertices"] > 0 and mesh["triangles"] > 0 and mesh["foldedTriangles"] == 0 and mesh["degenerateTriangles"] == 0 and mesh["nonfiniteVertices"] == 0 for mesh in metrics["shadowMeshPeaks"]), metrics["shadowMeshPeaks"])
    check("transparent_closeup_has_no_rectangular_background", metrics["clearAtRest"] > 1000 and metrics["solidAtRest"] > 30000)
    check("approved_blink_only_changes_original_eye_masks", metrics["eyeChanged"] > 0 and metrics["outsideEyes"] == 0, {key: metrics[key] for key in ["eyeChanged", "outsideEyes"]})
    check("complete_chain_and_gem_share_fixed_earring_pivot", len(metrics["jewelry"]) == 2 and all(item["opaque"] >= 100 and item["blue"] > 20 and item["chain"] > 10 and item["sourceMismatch"] == 0 and item["blueStaticCopies"] == 0 and item["rootDrift"] < .0001 and item["rigidLengthError"] < .0001 for item in metrics["jewelry"]), metrics["jewelry"])
    check("independent_blink_clock_keeps_hair_moving", metrics["windLoop"] == 12000 and metrics["blinkCycle"] == 24000 and all(event["closed"] == 0 and event["otherWindCycleEye"] == 1 and event["windChanges"] > 0 for event in metrics["blinkEvents"]), metrics["blinkEvents"])
    check("physical_loop_has_no_node_reset_or_velocity_snap", metrics["seam"]["positionStep"] < .15 and metrics["seam"]["velocityDifference"] < .03, metrics["seam"])
    check("one_hundred_periods_keep_exact_same_rendered_phase", metrics["repeatMismatches"] == 0)
    diagnostics = metrics["physics"]
    check("fixed_step_physics_is_warmed_and_cached", diagnostics is not None and diagnostics["stepsPerSecond"] == 240 and diagnostics["cacheHz"] >= 120 and diagnostics["warmupCycles"] >= 3, diagnostics)

    page.goto(portrait_url(args.url, t=4510))
    page.wait_for_selector("canvas[data-ready=true][data-painted=true]")
    frozen = page.locator("canvas").evaluate("c=>c.toDataURL()")
    page.wait_for_timeout(180)
    check("explicit_seek_has_no_continuous_redraw", frozen == page.locator("canvas").evaluate("c=>c.toDataURL()") and page.locator("canvas").get_attribute("data-playback") == "static")
    refresh = page.evaluate(REFRESH)
    result["refresh_simulation"] = refresh
    for run in refresh["runs"]:
        check(f"refresh_{run['hz']}_uses_same_clock_and_pixels", run["maxTimeError"] < .00001 and run["identicalPixels"] and run["maxQueued"] == 1, run)
    reduced = browser.new_context(viewport={"width": 1200, "height": 1000}, reduced_motion="reduce")
    reduced.add_init_script("""window.__paints=0;window.__workerStarts=0;
      const put=CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData=function(...args){window.__paints++;return put.apply(this,args)};
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.__workerStarts++}};""")
    reduced_page = reduced.new_page()
    reduced_page.goto(portrait_url(args.url))
    reduced_page.wait_for_selector("canvas[data-ready=true][data-painted=true]")
    reduced_page.wait_for_timeout(100)
    before = reduced_page.evaluate("window.__paints")
    reduced_page.wait_for_timeout(250)
    check("reduced_motion_is_canonical_and_unscheduled", reduced_page.locator("canvas").get_attribute("data-playback") == "static" and before == reduced_page.evaluate("window.__paints") and canonical == reduced_page.locator("canvas").evaluate("c=>c.toDataURL()"))
    check("initial_reduced_motion_constructs_no_physics_worker", reduced_page.evaluate("window.__workerStarts") == 0)
    reduced_page.emulate_media(reduced_motion="no-preference")
    reduced_page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback="looping"]')
    resumed_pixels = reduced_page.locator("canvas").evaluate("c=>c.toDataURL()")
    reduced_page.wait_for_timeout(500)
    worker_starts = reduced_page.evaluate("window.__workerStarts")
    check("removing_reduced_motion_prepares_and_animates", worker_starts == 1 and resumed_pixels != reduced_page.locator("canvas").evaluate("c=>c.toDataURL()"), {"workers": worker_starts})
    reduced_page.emulate_media(reduced_motion="reduce")
    reduced_page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback="static"]')
    check("return_to_reduced_motion_restores_exact_canonical", canonical == reduced_page.locator("canvas").evaluate("c=>c.toDataURL()"))
    reduced_page.emulate_media(reduced_motion="no-preference")
    reduced_page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback="looping"]')
    check("preference_round_trip_reuses_prepared_cache", reduced_page.evaluate("window.__workerStarts") == worker_starts)
    reduced.close()
    windless = browser.new_context(viewport={"width": 1200, "height": 1000})
    windless.add_init_script("window.__workerStarts=0;const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.__workerStarts++}}")
    windless_page = windless.new_page()
    windless_page.goto(portrait_url(args.url, wind=0))
    windless_page.wait_for_selector('canvas[data-ready=true][data-painted=true][data-playback="looping"]')
    check("wind_zero_constructs_no_physics_worker", windless_page.evaluate("window.__workerStarts") == 0)
    windless_transition = windless_page.evaluate(r"""async()=>{
      const {PortraitPlayer}=await import('/src/features/portrait/animation/portraitPlayer.ts');
      const {readStageOptions}=await import('/src/features/portrait/animation/stageOptions.ts');
      const canvas=document.createElement('canvas'),options=readStageOptions('?wind=0'),player=new PortraitPlayer(canvas,options);
      const ready=async()=>{
        for(let i=0;canvas.dataset.ready!=='true'&&i<2500;i++)await new Promise(resolve=>setTimeout(resolve,10));
        if(canvas.dataset.ready!=='true')throw Error('Wind transition player did not prepare');
      };
      try{
        await ready();const initialWorkers=window.__workerStarts;
        player.elapsed=4500;player.last=null;player.paint();const closed=canvas.toDataURL();
        player.elapsed=5000;player.paint();const open=canvas.toDataURL();
        player.update({...options,wind:1});await ready();
        await new Promise(resolve=>setTimeout(resolve,500));const flowing=canvas.toDataURL(),preparedWorkers=window.__workerStarts;
        player.update(options);const returned=canvas.toDataURL();
        player.update({...options,wind:1});await ready();
        return{initialWorkers,blinkWithoutWind:closed!==open,preparedWorkers,flowing:flowing!==open,returnedCanonical:returned===open,reusedWorkers:window.__workerStarts};
      }finally{player.destroy();}
    }""")
    check("wind_zero_keeps_blink_and_lazily_prepares_on_resume", windless_transition["initialWorkers"] == 0 and windless_transition["blinkWithoutWind"] and windless_transition["preparedWorkers"] == 1 and windless_transition["flowing"] and windless_transition["returnedCanonical"] and windless_transition["reusedWorkers"] == 1, windless_transition)
    windless.close()
    for failure_mode in ["constructor", "error-event"]:
        failed_context = browser.new_context(viewport={"width": 1200, "height": 1000})
        if failure_mode == "constructor":
            failed_context.add_init_script("window.__workerAttempts=0;window.__workerTerminations=0;window.Worker=class{constructor(){window.__workerAttempts++;throw new Error('QA worker constructor failure')}}")
        else:
            failed_context.add_init_script("""window.__workerAttempts=0;window.__workerTerminations=0;
              const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{
                constructor(...args){super(...args);window.__workerAttempts++}
                terminate(){window.__workerTerminations++;super.terminate()}
              };""")
        failed_page = failed_context.new_page()
        if failure_mode == "error-event":
            failed_page.route("**/hairPhysics.worker.ts*", lambda route: route.abort())
        failed_errors = []
        failed_page.on("pageerror", lambda error: failed_errors.append(str(error)))
        parts = urlsplit(args.url)
        failed_page.goto(urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")))
        failed_page.wait_for_selector(".stage__fallback", state="visible")
        failure_state = failed_page.evaluate("""()=>({attempts:window.__workerAttempts,terminations:window.__workerTerminations,
          fallback:[...document.querySelectorAll('.stage__fallback')].some(image=>image.complete&&image.naturalWidth>0),
          content:['main','#about','#work','#contact','footer'].every(selector=>!!document.querySelector(selector)),
          email:!!document.querySelector('a[href="mailto:fknejdcwnfi@gmail.com"]'),
          github:!!document.querySelector('a[href="https://github.com/fknejdcwnfi"]'),
          failed:document.querySelector('canvas')?.dataset.playback==='failed'})""")
        failure_state["errors"] = failed_errors
        check(f"worker_{failure_mode}_failure_preserves_site_and_static_portrait", failure_state["attempts"] > 0 and failure_state["fallback"] and failure_state["content"] and failure_state["email"] and failure_state["github"] and failure_state["failed"] and not failed_errors and (failure_mode != "error-event" or failure_state["terminations"] > 0), failure_state)
        failed_context.close()
    # A transient startup error must not leave a working connection on the poster forever.
    for failure_mode in ["atlas", "worker"]:
        recovery_context = browser.new_context(viewport={"width": 1200, "height": 1000})
        if failure_mode == "worker":
            recovery_context.add_init_script("""window.__workerAttempts=0;window.__failWorker=true;const NativeWorker=window.Worker;
              window.Worker=class extends NativeWorker{constructor(...args){
                window.__workerAttempts++;if(window.__failWorker)throw new Error('temporary worker failure');super(...args)
              }}""")
        recovery = recovery_context.new_page()
        errors, requests = [], []
        unavailable = [True]
        recovery.on("pageerror", lambda error: errors.append(str(error)))
        if failure_mode == "atlas":
            def fail_once(route):
                requests.append(route.request.url)
                if unavailable[0]: route.fulfill(status=503, body="Temporarily unavailable")
                else: route.continue_()
            recovery.route("**/assets/portrait-rig/rig-256.png*", fail_once)
        recovery.goto(args.url)
        recovery.wait_for_selector(".stage__fallback", state="visible")
        unavailable[0] = False
        if failure_mode == "worker": recovery.evaluate("window.__failWorker=false")
        recovery.wait_for_function("""() => document.querySelector('canvas')?.dataset.playback === 'looping'
          && !document.querySelector('.stage__fallback')""", timeout=30000)
        detail = {"requests": len(requests), "worker_attempts": recovery.evaluate("window.__workerAttempts || 0"), "errors": errors}
        check(f"transient_{failure_mode}_failure_automatically_recovers", not errors and
              (detail["requests"] >= 2 if failure_mode == "atlas" else detail["worker_attempts"] >= 2), detail)
        recovery_context.close()
    bounded_context = browser.new_context(viewport={"width": 1200, "height": 1000})
    bounded_context.add_init_script("""window.__workerAttempts=0;window.__failWorker=true;
      const NativeWorker=window.Worker, nativeTimeout=window.setTimeout;
      window.setTimeout=(fn,delay,...args)=>nativeTimeout(fn,delay===2000||delay===5000?25:delay,...args);
      window.Worker=class extends NativeWorker{constructor(...args){window.__workerAttempts++;
        if(window.__failWorker)throw new Error('temporary worker failure');super(...args)}}""")
    bounded = bounded_context.new_page()
    bounded.goto(args.url)
    bounded.wait_for_function("window.__workerAttempts === 3 && document.querySelector('canvas')?.dataset.playback === 'failed'", timeout=30000)
    bounded.wait_for_timeout(500)
    attempts = bounded.evaluate("window.__workerAttempts")
    bounded.evaluate("window.__failWorker=false;window.dispatchEvent(new Event('online'))")
    bounded.wait_for_function("""() => document.querySelector('canvas')?.dataset.playback === 'looping'
      && !document.querySelector('.stage__fallback')""", timeout=30000)
    check("retry_limit_and_online_recovery", attempts == 3 and bounded.evaluate("window.__workerAttempts") == 4,
          {"attempts_before_online": attempts, "attempts_after_online": bounded.evaluate("window.__workerAttempts")})
    bounded_context.close()
    for failure_mode in ["invalid-schema", "atlas-dimensions"]:
        failed_context = browser.new_context(viewport={"width": 1200, "height": 1000})
        failed_page = failed_context.new_page()
        failed_errors, rejected_requests = [], []
        failed_page.on("pageerror", lambda error: failed_errors.append(str(error)))
        if failure_mode == "invalid-schema":
            def reject_schema(route):
                rejected_requests.append(route.request.url)
                response = route.fetch()
                metadata = response.json()
                metadata["version"] = 999
                route.fulfill(response=response, json=metadata)
            failed_page.route("**/assets/portrait-rig/rig-256.json", reject_schema)
        else:
            poster = Path(__file__).resolve().parents[2] / "public/portrait-rest.png"
            def replace_atlas_dimensions(route):
                rejected_requests.append(route.request.url)
                route.fulfill(status=200, content_type="image/png", body=poster.read_bytes())
            failed_page.route("**/assets/portrait-rig/rig-256.png*", replace_atlas_dimensions)
        parts = urlsplit(args.url)
        failed_page.goto(urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")))
        failed_page.wait_for_selector(".stage__fallback", state="visible")
        failed_page.wait_for_function("[...document.querySelectorAll('.stage__fallback')].some(image=>image.complete&&image.naturalWidth===768)")
        failure_state = failed_page.evaluate("""()=>({
          fallback:[...document.querySelectorAll('.stage__fallback')].some(image=>image.complete&&image.naturalWidth===768&&image.naturalHeight===768),
          content:['main','#about','#work','#contact','footer'].every(selector=>!!document.querySelector(selector)),
          failed:document.querySelector('canvas')?.dataset.playback==='failed'})""")
        failure_state.update(requests=rejected_requests, errors=failed_errors)
        check(f"baked_{failure_mode}_failure_preserves_site_and_static_portrait", bool(rejected_requests) and failure_state["fallback"] and failure_state["content"] and failure_state["failed"] and not failed_errors, failure_state)
        failed_context.close()
    lifecycle = page.evaluate(r"""async()=>{
      const {PortraitPlayer}=await import('/src/features/portrait/animation/portraitPlayer.ts');
      const {readStageOptions}=await import('/src/features/portrait/animation/stageOptions.ts');
      const canvas=document.createElement('canvas');let count=0;
      const player=new PortraitPlayer(canvas,readStageOptions(''),()=>count++);
      for(let i=0;canvas.dataset.ready!=='true'&&i<1000;i++)await new Promise(resolve=>setTimeout(resolve,10));
      if(canvas.dataset.ready!=='true')throw Error('Lifecycle player did not prepare');
      player.elapsed=6100;
      await new Promise(resolve=>setTimeout(resolve,180));const running=count,runningTime=player.elapsed;
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(resolve=>setTimeout(resolve,200));const hidden=count,hiddenTime=player.elapsed;
      Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(resolve=>setTimeout(resolve,200));const resumed=count,resumedTime=player.elapsed;
      player.setViewportVisible(false);const offscreen=count,offscreenTime=player.elapsed;
      await new Promise(resolve=>setTimeout(resolve,180));const offscreenAfter=count,offscreenAfterTime=player.elapsed;
      player.setViewportVisible(true);await new Promise(resolve=>setTimeout(resolve,200));const onscreen=count,onscreenTime=player.elapsed;
      player.destroy();const stopped=count,stoppedTime=player.elapsed;
      await new Promise(resolve=>setTimeout(resolve,180));const destroyed=count,destroyedTime=player.elapsed;
      delete document.hidden;return{running,hidden,resumed,offscreen,offscreenAfter,onscreen,stopped,destroyed,runningTime,hiddenTime,resumedTime,offscreenTime,offscreenAfterTime,onscreenTime,stoppedTime,destroyedTime};
    }""")
    check("hidden_offscreen_resume_destroy_lifecycle", lifecycle["running"] > 0 and lifecycle["hidden"] == lifecycle["running"] and lifecycle["resumed"] > lifecycle["hidden"] and lifecycle["offscreen"] == lifecycle["offscreenAfter"] and lifecycle["onscreen"] > lifecycle["offscreenAfter"] and lifecycle["stopped"] == lifecycle["destroyed"], lifecycle)
    check("visibility_suspension_preserves_phase_without_wall_clock_jump", lifecycle["hiddenTime"] == lifecycle["runningTime"] and 0 < lifecycle["resumedTime"] - lifecycle["hiddenTime"] < 350 and lifecycle["offscreenTime"] == lifecycle["offscreenAfterTime"] and 0 < lifecycle["onscreenTime"] - lifecycle["offscreenAfterTime"] < 350 and lifecycle["stoppedTime"] == lifecycle["destroyedTime"], lifecycle)
    mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
    mobile.goto(portrait_url(args.url, t=2200))
    mobile.wait_for_selector("canvas[data-ready=true][data-painted=true]")
    box = mobile.locator(".stage").bounding_box()
    check("mobile_circle_remains_inside_viewport", mobile.evaluate("document.documentElement.scrollWidth<=innerWidth") and box["x"] >= 0 and box["y"] >= 0 and box["x"] + box["width"] <= 390 and box["y"] + box["height"] <= 844, box)
    mobile.close()
    check("no_browser_or_resource_errors", not result["errors"], result["errors"])
    browser.close()
result["status"] = "failed" if result["failures"] else "passed"
save()
print(json.dumps({"status": result["status"], "checks": len(result["checks"]), "failures": [item["check"] for item in result["failures"]], "output": str(args.output)}, ensure_ascii=False))
raise SystemExit(bool(result["failures"]))
