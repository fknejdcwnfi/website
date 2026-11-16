/** Full-size lossless decoration stays available; smaller variants are sampled. */
export type Decoration = Readonly<{ file: string; width: number; height: number }>

export const CARD_DECORATION_SIZES = '(max-width: 540px) 100vw, (max-width: 1100px) 50vw, 30vw'
export const WIDE_DECORATION_SIZES = '(max-width: 1100px) 100vw, 64vw'

/** Both markup paths use the same candidates and preserve the full fallback. */
export const getDecorationSrcSet = (decoration: Decoration, base: string): string => {
  const name = decoration.file.replace(/\.webp$/, '')
  return [
    `${base}assets/pixel-ui/responsive/${name}-768.webp 768w`,
    `${base}assets/pixel-ui/responsive/${name}-1536.webp 1536w`,
    `${base}assets/pixel-ui/${decoration.file} ${decoration.width}w`,
  ].join(', ')
}

export const getInterestDecoration = (id: string): Decoration | undefined => {
  switch (id) {
    case 'naruto': return { file: 'naruto.webp', width: 1774, height: 887 }
    case 'detective-conan': return { file: 'conan.webp', width: 2172, height: 724 }
    default: return undefined
  }
}

export const GAME_DECORATION: Decoration = { file: 'game-realm.webp', width: 2172, height: 724 }

export const getSocialDecoration = (platform: string): Decoration | undefined => {
  switch (platform) {
    case 'github': return { file: 'social-github.webp', width: 2172, height: 724 }
    case 'email': return { file: 'social-mail.webp', width: 2172, height: 724 }
    default: return undefined
  }
}
