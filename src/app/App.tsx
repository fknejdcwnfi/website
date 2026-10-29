import CharacterStage from '../features/portrait/components/CharacterStage'
import { readStageOptions } from '../features/portrait/animation/stageOptions'
import { site } from '../features/profile/content/site'
import PersonalSections from '../features/profile/components/PersonalSections'
import PortraitBoundary from '../features/portrait/components/PortraitBoundary'
import SiteShell from '../features/profile/components/SiteShell'
import PixelIcon from '../features/profile/components/PixelIcon'
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
      <section className="hero site-container" aria-labelledby="hero-title">
        <figure className="hero__visual">
          <div className={`hero-portrait hero-portrait--${options.style}`} data-theme={options.theme}>
            <PortraitViewport logicalSize={options.pixel}>{portrait}</PortraitViewport>
          </div>
          <figcaption><span>VERMOUTH</span><span>像素肖像 · 微風常在</span></figcaption>
        </figure>
        <div className="hero__copy">
          <p className="eyebrow"><span className="small-spark" aria-hidden="true" /> {site.intro}</p>
          <h1 id="hero-title"><span className="hero__greeting">你好，我是</span><span className="hero__name" lang="en">{site.name}<span className="hero__dot">.</span></span></h1>
          <p className="hero__intro">{site.tagline}</p>
          <div className="hero__actions">
            <a className="button-primary" href="#work">看看我的作品 <PixelIcon name="arrow-down" /></a>
            <a className="text-link" href={site.github} target="_blank" rel="noreferrer">在 GitHub 找我 <PixelIcon name="arrow-up-right" /></a>
          </div>
        </div>
      </section>
      <PersonalSections />
    </SiteShell>
  )
}
