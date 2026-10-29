import { site } from '../content/site'
import '../styles/sections.css'

const Arrow = () => <span aria-hidden="true">↗</span>

export default function PersonalSections() {
  return (
    <>
      <section className="personal-section site-container" id="about" aria-labelledby="about-title">
        <div className="personal-section__label">
          <span className="personal-section__index">01 / ABOUT</span>
          <h2 id="about-title">關於我</h2>
        </div>
        <div className="personal-about">
          {site.about.map((paragraph, index) => (
            <p className={index === 0 ? 'personal-about__lead' : undefined} key={paragraph}>
              {paragraph}
            </p>
          ))}
          <a className="personal-text-link" href={site.github} target="_blank" rel="noopener noreferrer">
            了解我的 GitHub <Arrow />
          </a>
        </div>
      </section>

      <section className="personal-section site-container" id="work" aria-labelledby="work-title">
        <div className="personal-section__label">
          <span className="personal-section__index">02 / SELECTED WORK</span>
          <h2 id="work-title">作品與實驗</h2>
        </div>
        <div className="personal-work">
          <div className="personal-work__intro">
            <p>做過的，與正在做的。</p>
            <a className="personal-text-link" href={`${site.github}?tab=repositories`} target="_blank" rel="noopener noreferrer">
              所有公開專案 <Arrow />
            </a>
          </div>
          <div className="personal-projects">
            {site.projects.map((project, index) => (
              <article className="personal-project" key={project.id}>
                <a className="personal-project__link" href={project.href} target="_blank" rel="noopener noreferrer"
                  aria-label={`${project.title} — ${project.subtitle}，開啟專案（另開分頁）`}>
                  <div className="personal-project__top">
                    <span className="personal-project__number">{String(index + 1).padStart(2, '0')}</span>
                    <span className={`personal-project__status personal-project__status--${project.status}`}>
                      <span aria-hidden="true" />
                      {project.status === 'active' ? '持續製作中' : '已封存'}
                    </span>
                  </div>
                  <div className="personal-project__heading">
                    <h3>{project.title}</h3>
                    <Arrow />
                  </div>
                  <p className="personal-project__subtitle">{project.subtitle}</p>
                  <p className="personal-project__description">{project.description}</p>
                  <ul className="personal-project__tags" aria-label="專案技術">
                    {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="personal-section personal-section--contact site-container" id="contact" aria-labelledby="contact-title">
        <div className="personal-section__label">
          <span className="personal-section__index">03 / GET IN TOUCH</span>
          <h2 id="contact-title">聯絡我</h2>
        </div>
        <div className="personal-contact">
          <p className="personal-contact__heading">有想聊的？<br />來打個招呼。</p>
          <p className="personal-contact__description">關於作品、想法，或只是說聲你好。</p>
          <div className="personal-contact__links">
            {site.email ? (
              <a className="personal-contact__button" href={`mailto:${site.email}`}>
                {site.email} <Arrow />
              </a>
            ) : null}
            <a className={site.email ? 'personal-text-link' : 'personal-contact__button'} href={site.github}
              target="_blank" rel="noopener noreferrer">
              在 GitHub 找我 <Arrow />
            </a>
          </div>
          <span className="personal-contact__handle">@{site.handle}</span>
        </div>
      </section>
    </>
  )
}
