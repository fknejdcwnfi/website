import CharacterStage from './components/CharacterStage'
import { readStageOptions } from './animation/stageOptions'
import { site } from './content/site'
import PersonalSections from './components/PersonalSections'
import PortraitBoundary from './components/PortraitBoundary'
import SiteShell from './components/SiteShell'

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
      {portrait}
    </main>
  )
  return (
    <SiteShell>
        <section className="hero site-container" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow"><span className="small-spark" aria-hidden="true" /> {site.intro}</p>
            <h1 id="hero-title"><span className="hero__greeting">你好，我是</span><span className="hero__name" lang="en">{site.name}<span className="hero__dot">.</span></span></h1>
            <p className="hero__intro">{site.tagline}</p>
            <div className="hero__actions">
              <a className="button-primary" href="#work">看看我的作品 <span aria-hidden="true">↘</span></a>
              <a className="text-link" href={site.github} target="_blank" rel="noreferrer">在 GitHub 找我 <span aria-hidden="true">↗</span></a>
            </div>
            <p className="hero__footnote">程式、像素，和一點自己的樣子。</p>
          </div>
          <figure className="hero__visual">
            <div className="hero__ambient" aria-hidden="true" />
            <div className={`hero-portrait hero-portrait--${options.style}`} data-theme={options.theme}>{portrait}</div>
            <figcaption><span>VERMOUTH</span><span>像素肖像 · 隨風而動</span></figcaption>
          </figure>
        </section>
      <PersonalSections />
    </SiteShell>
  )
}
