import { getGameProfiles, getSocialLinks, site } from '../content/site'
import PixelIcon from './PixelIcon'

const Arrow = () => <span aria-hidden="true">↗</span>

export default function PersonalSections() {
  const games = getGameProfiles(site)
  return (
    <>
      <section className="personal-section site-container" id="about" aria-labelledby="about-title">
        <div className="personal-section__label">
          <span className="personal-section__index">01 / ABOUT</span>
          <h2 id="about-title">關於我</h2>
        </div>
        <div className="personal-about">
          {site.about.map((paragraph, index) => (
            <p className={index === 0 ? 'personal-about__lead' : undefined} key={paragraph}>{paragraph}</p>
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
                    <span className="personal-project__slot" aria-hidden="true"><PixelIcon name={project.id === 'xiangqi-review' ? 'chess' : 'code'} /></span>
                    <span className={`personal-project__status personal-project__status--${project.status}`}>
                      <span aria-hidden="true" />{project.status === 'active' ? '持續製作中' : '已封存'}
                    </span>
                  </div>
                  <span className="personal-project__number">PROJECT / {String(index + 1).padStart(2, '0')}</span>
                  <div className="personal-project__heading"><h3>{project.title}</h3><Arrow /></div>
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

      {games.length ? (
        <section className="personal-section site-container" id="games" aria-labelledby="games-title">
          <div className="personal-section__label">
            <span className="personal-section__index">03 / GAME PROFILES</span>
            <h2 id="games-title">遊戲足跡</h2>
          </div>
          <div className="personal-games">
            {games.map((profile) => (
              <article className="personal-game" key={profile.id}>
                <div className="personal-game__heading"><span className="personal-game__icon"><PixelIcon name="gamepad" /></span><h3>{profile.label}</h3></div>
                <dl className="personal-game__details">
                  {profile.playerName ? <div><dt>玩家</dt><dd>{profile.playerName}</dd></div> : null}
                  {profile.playerId ? <div><dt>ID</dt><dd>{profile.playerId}</dd></div> : null}
                  {profile.region ? <div><dt>區服</dt><dd>{profile.region}</dd></div> : null}
                </dl>
                {profile.description ? <p>{profile.description}</p> : null}
                {profile.href ? <a className="personal-text-link" href={profile.href} target="_blank" rel="noopener noreferrer">查看遊戲檔案 <Arrow /></a> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="personal-section personal-section--contact site-container" id="contact" aria-labelledby="contact-title">
        <div className="personal-section__label">
          <span className="personal-section__index">{games.length ? '04' : '03'} / GET IN TOUCH</span>
          <h2 id="contact-title">社群與聯絡</h2>
        </div>
        <div className="personal-contact">
          <p className="personal-contact__heading">有想聊的？<br />來打個招呼。</p>
          <p className="personal-contact__description">關於作品、想法，或只是說聲你好。</p>
          <div className="social-links">
            {getSocialLinks(site).map((profile) => (
              <a className="social-link" key={profile.id} href={profile.href}
                {...(profile.platform !== 'email' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <span className="social-link__icon"><PixelIcon name={profile.platform} /></span>
                <span className="social-link__copy"><span className="social-link__label">{profile.label}</span>{profile.handle ? <span className="social-link__handle">{profile.handle}</span> : null}</span>
                <Arrow />
              </a>
            ))}
          </div>
          <span className="personal-contact__handle">@{site.handle}</span>
        </div>
      </section>
    </>
  )
}
