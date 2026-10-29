import { getGameProfiles, getSocialLinks, site } from '../content/site'
import PixelIcon from './PixelIcon'

const Arrow = () => <PixelIcon name="arrow-up-right" />

export default function PersonalSections() {
  const games = getGameProfiles(site)
  return (
    <>
      <section className="personal-section" id="about" aria-labelledby="about-title" tabIndex={-1}>
        <div className="personal-section__label"><h2 id="about-title"><span aria-hidden="true">📖</span> 關於我</h2></div>
        <div className="personal-about">
          {site.about.map((paragraph, index) => <p className={index === 0 ? 'personal-about__lead' : undefined} key={paragraph}>{paragraph}</p>)}
          <a className="personal-text-link" href={site.github} target="_blank" rel="noopener noreferrer">了解我的 GitHub <Arrow /></a>
        </div>
      </section>

      <section className="personal-section" id="work" aria-labelledby="work-title" tabIndex={-1}>
        <div className="personal-section__label"><h2 id="work-title"><span aria-hidden="true">🧩</span> 作品與實驗</h2></div>
        <div className="personal-work">
          <div className="personal-work__intro"><p>做過的，與正在做的。</p><a className="personal-text-link" href={`${site.github}?tab=repositories`} target="_blank" rel="noopener noreferrer">所有公開專案 <Arrow /></a></div>
          <div className="project-table-wrap">
            <table className="project-table">
              <caption className="visually-hidden">公開專案</caption>
              <thead><tr><th scope="col">專案</th><th scope="col">狀態</th><th scope="col">說明</th></tr></thead>
              <tbody>{site.projects.map((project) => <tr className="personal-project" id={`project-${project.id}`} tabIndex={-1} key={project.id}>
                <td><a className="personal-project__link" href={project.href} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} — ${project.subtitle}，開啟專案（另開分頁）`}><span className="personal-project__heading">{project.title} <Arrow /></span></a><span className="personal-project__subtitle">{project.subtitle}</span></td>
                <td><span className={`personal-project__status personal-project__status--${project.status}`}><span aria-hidden="true" />{project.status === 'active' ? '持續製作中' : '已封存'}</span></td>
                <td><p className="personal-project__description">{project.description}</p><ul className="personal-project__tags" aria-label="專案技術">{project.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul></td>
              </tr>)}</tbody>
            </table>
          </div>
          <blockquote className="document-note">每個作品都連結到真實的公開原始碼；已封存的專案保留當時的探索。</blockquote>
        </div>
      </section>

      {games.length ? <section className="personal-section" id="games" aria-labelledby="games-title" tabIndex={-1}>
        <div className="personal-section__label"><h2 id="games-title"><span aria-hidden="true">🎮</span> 遊戲足跡</h2></div>
        <div className="personal-games">{games.map((profile) => <article className="personal-game" key={profile.id}>
          <div className="personal-game__heading"><span className="personal-game__icon"><PixelIcon name="gamepad" /></span><h3>{profile.label}</h3></div>
          <dl className="personal-game__details">
            {profile.playerName ? <div><dt>玩家</dt><dd>{profile.playerName}</dd></div> : null}
            {profile.playerId ? <div><dt>ID</dt><dd>{profile.playerId}</dd></div> : null}
            {profile.region ? <div><dt>區服</dt><dd>{profile.region}</dd></div> : null}
          </dl>
          {profile.description ? <p>{profile.description}</p> : null}
          {profile.href ? <a className="personal-text-link" href={profile.href} target="_blank" rel="noopener noreferrer">查看遊戲檔案 <Arrow /></a> : null}
        </article>)}</div>
      </section> : null}

      <section className="personal-section personal-section--contact" id="contact" aria-labelledby="contact-title" tabIndex={-1}>
        <div className="personal-section__label"><h2 id="contact-title"><span aria-hidden="true">✉</span> 社群與聯絡</h2></div>
        <div className="personal-contact">
          <p className="personal-contact__description">關於作品、想法，或只是說聲你好，都歡迎來打個招呼。</p>
          <div className="social-links">{getSocialLinks(site).map((profile) => <a className="social-link" key={profile.id} href={profile.href} {...(profile.platform !== 'email' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <span className="social-link__icon"><PixelIcon name={profile.platform} /></span><span className="social-link__copy"><span className="social-link__label">{profile.label}</span>{profile.handle ? <span className="social-link__handle">{profile.handle}</span> : null}</span><Arrow />
          </a>)}</div>
        </div>
      </section>
    </>
  )
}
