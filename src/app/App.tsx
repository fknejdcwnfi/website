import { lazy, Suspense } from 'react'
import { site } from '../features/profile/content/site'
import PersonalSections from '../features/profile/components/PersonalSections'
import SiteShell from '../features/profile/components/SiteShell'
import ReferenceScene from '../features/referenceScene/ReferenceScene'
import { faithfulPixelDefinition as referenceSceneDefinition } from '../features/faithfulPixel/definition'
import { createFaithfulPixelRenderer as createSourceRenderer } from '../features/faithfulPixel/renderer'

const ArchivedPortrait=lazy(()=>import('./ArchivedPortrait'))
export default function App() {
  const params=new URLSearchParams(location.search)
  if(params.get('view')==='portrait'||['voxel','legacy'].includes(params.get('style')??''))return <Suspense fallback={<p>正在載入肖像…</p>}><ArchivedPortrait /></Suspense>
  const time=params.get('t')
  const timeMs=time!==null&&time.trim()!==''&&Number.isFinite(Number(time))?Math.max(-120000,Math.min(120000,Number(time))):null
  const scene=<ReferenceScene definition={referenceSceneDefinition} createRenderer={createSourceRenderer} timeMs={timeMs} />
  if(params.get('view')==='scene')return <main className="reference-scene-page">{scene}</main>
  return (
    <SiteShell>
      <section className="hero" id="home" aria-labelledby="hero-title" tabIndex={-1}>
        <div className="hero__copy">
          <p className="eyebrow">{site.intro}</p>
          <h1 id="hero-title"><span aria-hidden="true">👋</span> 歡迎來到我的像素小世界</h1>
          <p className="hero__intro">你好，我是 <strong>{site.name}</strong>。{site.tagline}</p>
        </div>
        <figure className="hero__visual hero__visual--reference">
          {scene}
          <figcaption><span>VERMOUTH</span><span>Minecraft · 像素肖像</span></figcaption>
        </figure>
        <aside className="welcome-note" aria-labelledby="welcome-note-title">
          <div className="welcome-note__title" id="welcome-note-title"><span aria-hidden="true">✦</span> 歡迎，隨意逛逛</div>
          <p>這裡記錄我的作品與探索。你可以從下方了解我，瀏覽公開專案，或透過 GitHub 與 Email 聯絡我。</p>
        </aside>
      </section>
      <PersonalSections />
    </SiteShell>
  )
}
