import { getProjects, getSiteGithub, site } from '../content/site'
import { GameSection, InterestSection, SocialSection } from './ProfileModules'
import PixelIcon from './PixelIcon'
import { poeticPixelAssets } from '../../poeticPixel/assets'
import { getNavigationIconPath } from '../content/navigationIcons'

const Arrow = () => <PixelIcon name="arrow-up-right" />

export default function PersonalSections() {
  const github = getSiteGithub(site)
  const projects = getProjects(site)
  const projectOverview = [
    { label: '公开项目', count: projects.length },
    { label: '持续制作', count: projects.filter(project => project.status === 'active').length },
    { label: '已归档', count: projects.filter(project => project.status === 'archived').length },
  ]
  return (
    <>
      <section className="personal-section" id="about" aria-labelledby="about-title" tabIndex={-1}>
        <div className="personal-section__label"><h2 id="about-title"><span aria-hidden="true"><svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath('#about')} /></svg></span> 关于我</h2></div>
        <div className="personal-about">
          <div className="personal-about__scene" aria-hidden="true" />
          {site.about.map((paragraph, index) => <p className={index === 0 ? 'personal-about__lead' : undefined} key={paragraph}>{paragraph}</p>)}
          {github ? <a className="personal-text-link" href={github} target="_blank" rel="noopener noreferrer">了解我的 GitHub <Arrow /></a> : null}
        </div>
      </section>

      <section className="personal-section" id="work" aria-labelledby="work-title" tabIndex={-1}>
        <div className="personal-section__label"><h2 id="work-title"><span aria-hidden="true"><svg className="site-nav__icon" viewBox="0 0 16 16" fill="currentColor" shapeRendering="crispEdges"><path fillRule="evenodd" d={getNavigationIconPath('#work')} /></svg></span> 作品与实验</h2></div>
        <div className="personal-work">
          <div className="personal-work__intro"><p>做过的，与正在做的。</p>{github ? <a className="personal-text-link" href={`${github}?tab=repositories`} target="_blank" rel="noopener noreferrer">所有公开项目 <Arrow /></a> : null}</div>
          <dl className="project-overview" aria-label="项目概览">{projectOverview.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.count}<span> 个</span></dd></div>)}</dl>
          <div className="project-table-wrap">
            <table className="project-table">
              <caption className="visually-hidden">公开项目</caption>
              <thead><tr><th scope="col">项目</th><th scope="col">状态</th><th scope="col">说明</th></tr></thead>
              <tbody>{projects.map((project) => <tr className="personal-project" id={`project-${project.id}`} tabIndex={-1} key={project.id}>
                <td><div className="personal-project__identity"><span className={`personal-project__thumbnail personal-project__thumbnail--${project.id}`} aria-hidden="true">{project.id === 'living-portrait' ? <img src={`${import.meta.env.BASE_URL}assets/poetic-pixel/canonical.png?v=${poeticPixelAssets.canonicalSha256}`} alt="" width="64" height="64" loading="lazy" decoding="async" /> : <PixelIcon name="chess" />}</span><div><a className="personal-project__link" href={project.href} target="_blank" rel="noopener noreferrer" aria-label={`${project.title} — ${project.subtitle}，打开项目（在新标签页打开）`}><span className="personal-project__heading">{project.title} <Arrow /></span></a><span className="personal-project__subtitle">{project.subtitle}</span>{project.kind || project.year ? <p className="personal-project__meta">{[project.kind, project.year].filter(Boolean).join(' · ')}</p> : null}</div></div></td>
                <td><span className={`personal-project__status personal-project__status--${project.status}`}><span aria-hidden="true" />{project.status === 'active' ? '持续制作中' : '已归档'}</span></td>
                <td><p className="personal-project__description">{project.description}</p><ul className="personal-project__tags" aria-label="项目技术">{project.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>{project.highlights?.length || project.note ? <details className="personal-project__details"><summary><span>项目亮点</span>{project.highlights?.length ? <span className="personal-project__detail-count">{project.highlights.length}</span> : null}<PixelIcon name="arrow-down" /></summary><div className="personal-project__details-body">{project.highlights?.length ? <ul className="personal-project__highlights">{project.highlights.map(item => <li key={item}>{item}</li>)}</ul> : null}{project.note ? <p className="personal-project__note">{project.note}</p> : null}</div></details> : null}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <blockquote className="document-note">每个作品都链接到真实的公开源码；已归档的项目保留当时的探索。</blockquote>
        </div>
      </section>

      <InterestSection content={site} />
      <GameSection content={site} />
      <SocialSection content={site} />
    </>
  )
}
