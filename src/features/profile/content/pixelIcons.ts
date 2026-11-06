import type { ContactLink } from './site.ts'

export type PixelIconName = ContactLink['platform'] | 'code' | 'chess' | 'gamepad' | 'heart' | 'copy' | 'arrow-up-right' | 'arrow-down'

/** Shared pixel glyphs keep React and initial HTML visually consistent. */
export const pixelIconPaths: Record<PixelIconName, string> = {
  'arrow-up-right': 'M5 2h9v9h-2V6h-2v2H8v2H6v2H4v2H2v-2h2v-2h2V8h2V6h2V4H5V2z',
  'arrow-down': 'M7 1h2v9h2V8h2v3h-2v2H9v2H7v-2H5v-2H3V8h2v2h2V1z',
  github: 'M4 2h3v1h2V2h3v2h2v7h-2v3h-2v-3H6v3H4v-3H2V4h2V2zm1 4v2h2V6H5zm4 0v2h2V6H9z',
  email: 'M1 3h14v10H1V3zm2 2v6h10V5h-2v2H9v2H7V7H5V5H3zm4 0v2h2V5H7z',
  bilibili: 'M4 1h2v2h4V1h2v2h2v11H2V3h2V1zM4 5v7h8V5H4zm1 2h2v3H5V7zm4 0h2v3H9V7z',
  douyin: 'M8 1h3v2h2v2h2v3h-4v4h-1v2H8v1H4v-1H2v-2H1V9h2V7h4v3H5v1h2v-1h1V1z',
  wechat: 'M3 2h7v1h2v2h2v6h-2v2h-2v2H8v-2H4v-1H2v-2H1V5h2V2zm1 4v2h2V6H4zm5 0v2h2V6H9z',
  qq: 'M6 1h4v1h2v3h1v2h1v4h-2v2h2v2H9v-1H7v1H2v-2h2v-2H2V7h1V5h1V2h2V1zm0 3v2h1V4H6zm3 0v2h1V4H9zM5 8v4h6V8H5z',
  weibo: 'M5 4h5v1h3v2h2v4h-2v2H4v-1H2v-2H1V7h2V5h2V4zm0 3v1H3v2h2v1h5v-1h2V8h-2V7H5zm1 1h3v2H6V8zm4-7h3v1h2v4h-2V3h-3V1z',
  xiaohongshu: 'M2 2h12v12H2V2zm2 2v8h3V4H4zm5 0v2h3V4H9zm0 4v4h3V8H9z',
  telegram: 'M13 1h2v3h-1v4h-1v5h-2v-1H9v-2H7v3H5V8H2V6h2V5h2V4h2V3h3V2h2V1zM7 7v1h1V7h1V6h1V5H9v1H8v1H7z',
  discord: 'M4 2h3v1h2V2h3v2h1v2h1v2h1v5h-3v-1H4v1H1V8h1V6h1V4h1V2zm1 5v3h2V7H5zm4 0v3h2V7H9z',
  other: 'M6 1h4v2h3v3h2v4h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3V1zm0 4v6h4V5H6z',
  code: 'M5 3h2v2H5v2H3v2h2v2h2v2H5v-2H3V9H1V7h2V5h2V3zm4 0h2v2h2v2h2v2h-2v2h-2v2H9v-2h2V9h2V7h-2V5H9V3z',
  chess: 'M5 1h6v3H9v2h3v3h-1v2h2v3H3v-3h2V9H4V6h3V4H5V1z',
  gamepad: 'M3 4h10v1h2v7h-1v1h-3v-2H5v2H2v-1H1V5h2V4zm1 2v2H2v1h2v2h1V9h2V8H5V6H4zm6 1v2h2V7h-2zm2 2v2h2V9h-2z',
  heart: 'M3 2h3v1h1v1h2V3h1V2h3v1h2v5h-1v2h-2v2h-2v2H6v-2H4v-2H2V8H1V3h2V2z',
  copy: 'M1 1h10v2H3v8H1V1zm4 4h10v10H5V5zm2 2v6h6V7H7z',
}
