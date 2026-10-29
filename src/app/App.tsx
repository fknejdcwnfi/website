import CharacterStage from '../features/portrait/components/CharacterStage'
import { readStageOptions } from '../features/portrait/animation/stageOptions'
import { site } from '../features/profile/content/site'
import PersonalSections from '../features/profile/components/PersonalSections'
import PortraitBoundary from '../features/portrait/components/PortraitBoundary'
import SiteShell from '../features/profile/components/SiteShell'
import PortraitViewport from '../features/profile/components/PortraitViewport'

export default function App() {
  const options = readStageOptions(window.location.search)
  const portraitOnly = new URLSearchParams(window.location.search).get('view') === 'portrait'
  const portrait = (
    <PortraitBoundary fallbackSrc={`${import.meta.env.BASE_URL}portrait-rest.png`}>
      <CharacterStage />
    </PortraitBoundary>
  )
  if (portraitOnly) return (
    <main className={`page page--${options.style}`} data-theme={options.theme}>
      <div className="aura" aria-hidden="true" />
      {options.style === 'portrait' ? <PortraitViewport logicalSize={options.pixel}>{portrait}</PortraitViewport> : portrait}
    </main>
  )
  return (
    <SiteShell>
      <section className="hero" id="home" aria-labelledby="hero-title" tabIndex={-1}>
        <div className="hero__copy">
          <p className="eyebrow">{site.intro}</p>
          <h1 id="hero-title"><span aria-hidden="true">👋</span> 歡迎來到我的像素小世界</h1>
          <p className="hero__intro">你好，我是 <strong>{site.name}</strong>。{site.tagline}</p>
        </div>
        <figure className="hero__visual">
          <div className={`hero-portrait hero-portrait--${options.style}`} data-theme={options.theme}>
            <PortraitViewport logicalSize={options.pixel}>{portrait}</PortraitViewport>
          </div>
          <figcaption><span>VERMOUTH</span><span>像素肖像 · 微風常在</span></figcaption>
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
