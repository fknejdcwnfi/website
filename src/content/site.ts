/** Edit personal content here; portrait geometry and animation remain independent. */
export type Project = {
  id: string
  title: string
  subtitle: string
  description: string
  tags: string[]
  href: string
  status: 'active' | 'archived'
}

export type SiteContent = {
  name: string
  fullName: string
  handle: string
  intro: string
  tagline: string
  about: string[]
  github: string
  email?: string
  projects: Project[]
  navigation: { label: string; href: string }[]
}

// Name, greeting and email were supplied by the owner; project links are real public repositories.
// No invented job title, location, client work or social accounts.
export const site: SiteContent = {
  name: 'fknejdcwnfi',
  fullName: 'fknejdcwnfi',
  handle: 'fknejdcwnfi',
  intro: 'HELLOWORLD',
  tagline: '把好奇心，慢慢做成作品。歡迎來到我的像素小世界。',
  about: [
    '你好，我是 fknejdcwnfi。HELLOWORLD，歡迎來到我的像素小世界。',
    '從 Java 的象棋專案，到這個結合像素美術與前端動態的網站，我想把想法一步步做成可以看見、可以使用的東西。',
  ],
  github: 'https://github.com/fknejdcwnfi',
  email: 'fknejdcwnfi@gmail.com',
  navigation: [
    { label: '關於', href: '#about' },
    { label: '作品', href: '#work' },
    { label: '聯絡', href: '#contact' },
  ],
  projects: [
    {
      id: 'living-portrait',
      title: 'Living Portrait',
      subtitle: '個人網站 · 像素動態實驗',
      description: '把 Vermouth 的像素肖像帶進個人網站，讓微風、眨眼與飾物在同一個角色上自然發生。',
      tags: ['TypeScript', 'React', 'Canvas'],
      href: 'https://github.com/fknejdcwnfi/website',
      status: 'active',
    },
    {
      id: 'xiangqi-review',
      title: 'Xiangqi Review',
      subtitle: 'Java · 象棋專案',
      description: '一段以 Java 製作象棋專案的開發嘗試。目前已封存，保留程式碼與當時的探索。',
      tags: ['Java', 'Xiangqi', 'Archive'],
      href: 'https://github.com/fknejdcwnfi/xiangqi-review',
      status: 'archived',
    },
  ],
}
