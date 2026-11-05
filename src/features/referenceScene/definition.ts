import { SCENE_HEIGHT, SCENE_WIDTH, type SceneDefinition } from './types'
import { sourceAssetManifest, smoothAssetManifest } from './sourceAssets'
const base=`${import.meta.env.BASE_URL}assets/reference-scene/`
export const selectedSourceManifest=new URLSearchParams(location.search).get('motion')==='original'?sourceAssetManifest:smoothAssetManifest
export const referenceSceneDefinition:SceneDefinition={
  version:1,width:SCENE_WIDTH,height:SCENE_HEIGHT,
  canonical:{src:`${base}canonical.png?v=${sourceAssetManifest.canonicalSha256}`,width:SCENE_WIDTH,height:SCENE_HEIGHT},
  layers:{},
  description:'Vermouth 在富士山與櫻花間的像素風景，長髮隨風飄動，眼睛與耳飾跟隨原動畫。',
  motionSource:'source-timing',
}
