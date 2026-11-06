import { lazy, Suspense } from 'react'
import { site } from '../features/profile/content/site'
import PersonalSections from '../features/profile/components/PersonalSections'
import SiteShell from '../features/profile/components/SiteShell'
import ReferenceScene from '../features/referenceScene/ReferenceScene'
import { poeticPixelDefinition as referenceSceneDefinition, poeticPreview } from '../features/poeticPixel/definition'
import { createPoeticPixelRenderer as createSourceRenderer } from '../features/poeticPixel/renderer'

const ArchivedPortrait=lazy(()=>import('./ArchivedPortrait'))
export default function App() {
  const params=new URLSearchParams(location.search)
  if(params.get('view')==='portrait'||['voxel','legacy'].includes(params.get('style')??''))return <Suspense fallback={<p>正在加载肖像…</p>}><ArchivedPortrait /></Suspense>
  const time=params.get('t')
  const timeMs=time!==null&&time.trim()!==''&&Number.isFinite(Number(time))?Math.max(-120000,Math.min(120000,Number(time))):null
  const scene=<ReferenceScene definition={referenceSceneDefinition} createRenderer={createSourceRenderer} timeMs={timeMs} adaptiveResolution
    preview={params.get('motion') === 'original' ? undefined : poeticPreview} />
  if(params.get('view')==='scene')return <main className="reference-scene-page">{scene}</main>
  return (
    <SiteShell>
      <section className="hero" id="home" aria-labelledby="hero-title" tabIndex={-1}>
        <div className="hero__copy">
          <p className="eyebrow">{site.intro}</p>
          <h1 id="hero-title"><span aria-hidden="true">👋</span> 欢迎来到我的像素小世界</h1>
          <p className="hero__intro">你好，我是 <strong>{site.name}</strong>。{site.tagline}</p>
        </div>
        <figure className="hero__visual hero__visual--reference">
          {scene}
          <figcaption><span>VERMOUTH</span><span>Minecraft · 像素肖像</span></figcaption>
        </figure>
        <aside className="welcome-note" aria-labelledby="welcome-note-title">
          <div className="welcome-note__title" id="welcome-note-title"><span aria-hidden="true">✦</span> 欢迎，随意逛逛</div>
          <p>这里记录我的作品、兴趣和游戏内容。你可以从下方了解我，浏览公开项目，或通过社交账号打个招呼。</p>
        </aside>
      </section>
      <PersonalSections />
    </SiteShell>
  )
}
