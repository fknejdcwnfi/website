import { useEffect, useRef, useState } from 'react'
import { getGameProfiles, getInterests, getSocialLinks, resolveProfileAsset } from '../content/site'
import type { ContactLink, GameShowcaseBlock, SiteContent } from '../content/types'
import PixelIcon from './PixelIcon'

type ModuleProps = { content: SiteContent; base?: string }
const Arrow = () => <PixelIcon name="arrow-up-right" />
const categoryNames = { anime: '动漫', manga: '漫画', music: '音乐', other: '兴趣' } as const

/** Content-only modules: their configuration never affects the portrait player. */
export function InterestSection({ content, base = import.meta.env.BASE_URL }: ModuleProps) {
  const interests = getInterests(content)
  if (!interests.length) return null
  return <section className="personal-section" id="interests" aria-labelledby="interests-title" tabIndex={-1}>
    <div className="personal-section__label"><h2 id="interests-title"><span aria-hidden="true"><PixelIcon name="heart" /></span> 兴趣图鉴</h2></div>
    <p className="profile-section__intro">喜欢的故事，值得留一格。</p>
    <div className="interest-grid">{interests.map(interest => {
      const cover = resolveProfileAsset(interest.cover, base)
      return <article className="interest-card" data-category={interest.category} id={`interest-${interest.id}`} tabIndex={-1} key={interest.id}>
        {cover ? <img className="interest-card__cover" src={cover} width="640" height="360" loading="lazy" decoding="async" alt={`${interest.title}封面`} /> : <div className="interest-card__scene" data-interest={interest.id} aria-hidden="true" />}
        <div className="interest-card__heading"><span className="interest-card__icon"><PixelIcon name="heart" /></span><div><p className="interest-card__category">{categoryNames[interest.category]}</p><h3>{interest.title}</h3></div></div>
        {interest.description ? <p>{interest.description}</p> : null}
        {interest.tags?.length ? <ul className="interest-card__tags" aria-label={`${interest.title}标签`}>{interest.tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : null}
        {interest.favorites?.length ? <div className="interest-card__favorites"><h4>特别喜欢</h4><ul>{interest.favorites.map(favorite => <li key={favorite}>{favorite}</li>)}</ul></div> : null}
        {interest.note ? <p className="interest-card__note">{interest.note}</p> : null}
        {interest.href ? <a className="personal-text-link" href={interest.href} target="_blank" rel="noopener noreferrer">了解更多 <Arrow /></a> : null}
      </article>
    })}</div>
  </section>
}

function ShowcaseContent({ block, base }: { block: GameShowcaseBlock; base: string }) {
  switch (block.kind) {
    case 'facts': return <dl className="showcase-facts">{block.items.map((item, index) => <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    case 'collection': return <ul className="showcase-collection">{block.items.map((item, index) => <li key={`${item.name}-${index}`}><strong>{item.name}</strong>{item.note ? <p>{item.note}</p> : null}</li>)}</ul>
    case 'notes': return <p className="showcase-note">{block.text}</p>
    case 'gallery': return <div className="showcase-gallery">{block.items.map((item, index) => {
      const src = resolveProfileAsset(item.src, base)
      if (!src) return null
      const image = <img src={src} alt={item.title} width="640" height="360" loading="lazy" decoding="async" />
      return <figure key={`${item.title}-${index}`}>{item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`${item.title}（在新标签页打开）`}>{image}</a> : image}<figcaption><strong>{item.title}</strong>{item.description ? <span>{item.description}</span> : null}</figcaption></figure>
    })}</div>
    case 'links': return <ul className="showcase-links">{block.items.map((item, index) => <li key={`${item.title}-${index}`}><a className="personal-text-link" href={item.href} target="_blank" rel="noopener noreferrer">{item.title} <Arrow /></a>{item.description ? <p>{item.description}</p> : null}</li>)}</ul>
  }
}

export function GameSection({ content, base = import.meta.env.BASE_URL }: ModuleProps) {
  const games = getGameProfiles(content)
  if (!games.length) return null
  return <section className="personal-section" id="games" aria-labelledby="games-title" tabIndex={-1}>
    <div className="personal-section__label"><h2 id="games-title"><span aria-hidden="true"><PixelIcon name="gamepad" /></span> 游戏基地</h2></div>
    <p className="profile-section__intro">在喜欢的世界里，留下自己的足迹。</p>
    <div className="personal-games">{games.map(profile => {
      const cover = resolveProfileAsset(profile.cover, base)
      const hasDetails = profile.playerName || profile.playerId || profile.region
      return <article className="game-showcase" data-game={profile.game} id={`game-${profile.id}`} tabIndex={-1} key={profile.id}>
        {cover ? <img className="game-showcase__cover" src={cover} alt={`${profile.label}封面`} width="640" height="360" loading="lazy" decoding="async" /> : <div className="game-showcase__scene" aria-hidden="true" />}
        <div className="game-showcase__header"><span className="game-showcase__icon"><PixelIcon name="gamepad" /></span><div>{profile.tagline ? <p className="game-showcase__tagline">{profile.tagline}</p> : null}<h3>{profile.label}</h3></div></div>
        {profile.description ? <p>{profile.description}</p> : null}
        {profile.tags?.length ? <ul className="game-showcase__tags" aria-label={`${profile.label}标签`}>{profile.tags.map(tag => <li key={tag}>{tag}</li>)}</ul> : null}
        {hasDetails ? <dl className="game-showcase__details">
          {profile.playerName ? <div><dt>玩家</dt><dd>{profile.playerName}</dd></div> : null}
          {profile.playerId ? <div><dt>ID</dt><dd>{profile.playerId}</dd></div> : null}
          {profile.region ? <div><dt>区服</dt><dd>{profile.region}</dd></div> : null}
        </dl> : null}
        {profile.blocks?.length ? <div className="game-showcase__blocks">{profile.blocks.map(block => <details className="showcase-block" open={block.expanded === true} key={block.id}>
          <summary><span>{block.title}</span><PixelIcon name="arrow-down" /></summary>
          <div className="showcase-block__body"><ShowcaseContent block={block} base={base} /></div>
        </details>)}</div> : null}
        {profile.href ? <a className="personal-text-link" href={profile.href} target="_blank" rel="noopener noreferrer">查看游戏主页 <Arrow /></a> : null}
      </article>
    })}</div>
  </section>
}

/** Clipboard success is announced only after the browser confirms the write. */
function CopyAccount({ profile }: { profile: ContactLink & { handle: string } }) {
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current) } }, [])
  const copy = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setStatus('')
    clearTimeout(timer.current)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(profile.handle)
      if (mounted.current) setStatus(`已复制${profile.label}`)
    } catch {
      if (mounted.current) {
        const text = document.getElementById(`account-${profile.id}`)
        const selection = window.getSelection()
        if (text && selection) {
          const range = document.createRange()
          range.selectNodeContents(text)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        setStatus('未能自动复制，请选中账号手动复制。')
      }
    } finally {
      if (mounted.current) {
        setBusy(false)
        timer.current = setTimeout(() => setStatus(''), 4500)
      }
    }
  }
  return <>
    <button className="social-copy" type="button" onClick={() => { void copy() }} disabled={busy} aria-label={`复制${profile.label}账号`}><PixelIcon name="copy" />{busy ? '复制中…' : '复制账号'}</button>
    <span className="social-card__status" role="status" aria-live="polite">{status}</span>
  </>
}

export function SocialSection({ content, base = import.meta.env.BASE_URL }: ModuleProps) {
  const profiles = getSocialLinks(content)
  return <section className="personal-section personal-section--contact" id="contact" aria-labelledby="contact-title" tabIndex={-1}>
    <div className="personal-section__label"><h2 id="contact-title"><span aria-hidden="true"><PixelIcon name="other" /></span> 社交坐标</h2></div>
    <div className="personal-contact">
      <p className="personal-contact__description">关于作品、兴趣，或者只是说声你好，都欢迎来打个招呼。</p>
      <div className="social-cards">{profiles.map(profile => {
        const qrCode = resolveProfileAsset(profile.qrCode, base)
        return <article className="social-card" data-platform={profile.platform} id={`contact-${profile.id}`} tabIndex={-1} key={profile.id}>
          <div className="social-card__heading"><span className="social-card__icon"><PixelIcon name={profile.platform} /></span><h3 className="social-card__label">{profile.label}</h3></div>
          {profile.handle ? <p className="social-card__handle" id={`account-${profile.id}`}>{profile.handle}</p> : null}
          {profile.description ? <p className="social-card__description">{profile.description}</p> : null}
          {profile.href || profile.handle ? <div className="social-card__actions">
            {profile.href ? <a className="personal-text-link" href={profile.href} {...(profile.platform !== 'email' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{profile.platform === 'email' ? '发送邮件' : '打开主页'} <Arrow /></a> : null}
            {profile.handle ? <CopyAccount profile={{ ...profile, handle: profile.handle }} /> : null}
          </div> : null}
          {qrCode ? <details className="social-qr"><summary>查看{profile.label}二维码</summary><img src={qrCode} alt={`${profile.label}联系二维码`} width="240" height="240" loading="lazy" decoding="async" /></details> : null}
        </article>
      })}</div>
    </div>
  </section>
}
