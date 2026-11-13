/** Existing lossless page decoration; separate from the immutable portrait. */
type Decoration = Readonly<{ file: string; width: number; height: number }>

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
