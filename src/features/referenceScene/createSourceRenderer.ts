import type { SceneRendererFactory } from './types'
import { validateSourceTiming, sampleSourceTime } from './sourceTiming'
import { sourceAssetManifest, smoothAssetManifest } from './sourceAssets'

/** Playback of the owner's exact source trajectory, with source-timed blink and ornaments. */
export const createSourceRenderer:SceneRendererFactory=async(assets,signal)=>{
  const useOriginal=new URLSearchParams(location.search).get('motion')==='original'
  const prefix=useOriginal?'source':'smooth'
  const selectedSourceManifest=useOriginal?sourceAssetManifest:smoothAssetManifest
  const response=await fetch(`${import.meta.env.BASE_URL}assets/reference-scene/${prefix}-manifest.json?v=${selectedSourceManifest.atlasSha256}`,{signal,cache:'no-cache'})
  if(!response.ok)throw Error('Reference animation timing could not be loaded.')
  const data=await response.json() as {version:number;width:number;height:number;frameCount:number;frameDurationsMs:number[];durationMs:number;atlasColumns:number;atlasRows:number;tileWidth:number;tileHeight:number}
  if(data.version!==1||data.width!==320||data.height!==240||!Number.isInteger(data.atlasColumns)||data.atlasColumns<1||data.atlasColumns>32||!Number.isInteger(data.atlasRows)||data.atlasRows<1||data.atlasRows>32||data.tileWidth!==160||data.tileHeight!==120||data.atlasColumns*data.atlasRows<data.frameCount)throw Error('Invalid reference animation atlas.')
  const atlas=await new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image()
    const cancel=():void=>{image.onload=null;image.onerror=null;image.removeAttribute('src');reject(new DOMException('Cancelled','AbortError'))}
    const finish=():void=>{image.onload=null;image.onerror=null;signal.removeEventListener('abort',cancel)}
    if(signal.aborted){cancel();return}
    signal.addEventListener('abort',cancel,{once:true})
    image.onload=()=>{finish();resolve(image)}
    image.onerror=()=>{finish();reject(new Error('Reference animation atlas unavailable.'))}
    image.src=`${import.meta.env.BASE_URL}assets/reference-scene/${selectedSourceManifest.atlas}?v=${selectedSourceManifest.atlasSha256}`
  })
  if(!atlas||atlas.naturalWidth!==data.atlasColumns*data.tileWidth||atlas.naturalHeight!==data.atlasRows*data.tileHeight)throw Error('Reference animation atlas does not match its timing.')
  const timing=validateSourceTiming(data)
  let destroyed=false
  return {
    paint(context,sample){
      if(destroyed)return
      context.imageSmoothingEnabled=false
      if(sample.static){context.drawImage(assets.canonical,0,0,320,240);context.canvas.dataset.sourceFrame='0';return}
      const frame=sampleSourceTime(sample.elapsedMs,timing).index
      context.drawImage(atlas,frame%data.atlasColumns*data.tileWidth,Math.floor(frame/data.atlasColumns)*data.tileHeight,data.tileWidth,data.tileHeight,0,0,320,240)
      context.canvas.dataset.sourceFrame=String(frame)
      context.canvas.dataset.sourceDuration=String(data.durationMs)
      context.canvas.dataset.motionSource=useOriginal?'source-anchors':'motion-compensated-source'
    },
    destroy(){destroyed=true},
  }
}
