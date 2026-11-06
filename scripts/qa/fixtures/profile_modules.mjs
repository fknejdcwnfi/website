/** Synthetic QA data only. This file is never imported by the production website. */
export const profileFixture = {
  socials: [
    { id: 'wechat-qa', platform: 'wechat', label: '微信测试账号', handle: 'WECHAT_QA_ONLY', description: '仅用于独立测试，不是真实账号。', qrCode: 'qa-profile/media-test.png', href: 'javascript:window.__fixtureInjected=1' },
    { id: 'qq-qa', platform: 'qq', label: 'QQ测试账号', handle: 'QQ_QA_ONLY' },
    { id: 'bilibili-qa', platform: 'bilibili', label: 'B站测试主页', handle: 'BILIBILI_QA_ONLY', href: 'https://example.com/qa/bilibili' },
    { id: 'unsafe-qr', platform: 'other', label: '无效图片测试', handle: 'SAFE_QA_TEXT', qrCode: '../private.png' },
    { id: 'empty-account', platform: 'wechat', label: '不应显示的空账号' },
    { id: 'unsafe-link-only', platform: 'other', label: '不应显示的脚本链接', href: 'javascript:alert(1)' },
  ],
  interests: [
    { id: 'naruto', title: '火影忍者', category: 'anime', description: '测试兴趣说明。', tags: ['动漫', 'QA_TAG'], favorites: ['QA 收藏角色'], note: 'QA <script>window.__fixtureInjected=1</script>', href: 'javascript:alert(1)', cover: 'qa-profile/media-test.png' },
    { id: 'detective-conan', title: '名侦探柯南', category: 'anime', description: '测试推理兴趣。', favorites: ['QA 推理篇章'] },
    { id: 'bad"><script', title: '不应出现的非法兴趣ID', category: 'other' },
  ],
  gameProfiles: [
    { id: 'honor-of-kings', game: 'honor-of-kings', label: '王者荣耀', playerName: 'QA 玩家（非真实）', playerId: 'QA_PLAYER_ID', region: 'QA 区服', description: '仅用于验证个性化游戏模块。', tagline: 'QA_GAME_TAGLINE_WITH_A_LONG_UNBROKEN_WORD_FOR_RESPONSIVE_LAYOUT', tags: ['MOBA', 'QA_ONLY'], cover: 'qa-profile/media-test.png',
      blocks: [
        { id: 'notes', kind: 'notes', title: '游戏手记', expanded: true, text: 'QA_NARRATIVE 练习记录\n<img src=x onerror="window.__fixtureInjected=1">' },
        { id: 'facts', kind: 'facts', title: '自定义数据', items: [{ label: '段位', value: 'QA 段位（非真实）' }, { label: '', value: '不应显示' }] },
        { id: 'heroes', kind: 'collection', title: '角色收藏', items: [{ name: 'QA 英雄', note: 'QA 练习记录' }] },
        { id: 'gallery', kind: 'gallery', title: '截图相册', items: [{ title: 'QA 战绩截图', src: 'qa-profile/media-test.png', description: '合成测试图片，不是实际战绩。', href: 'https://example.com/qa/record' }, { title: '不应显示的远程图片', src: 'https://example.com/remote.png' }, { title: '不应显示的路径穿越', src: '../private.png' }] },
        { id: 'clips', kind: 'links', title: '精彩片段', items: [{ title: 'QA 精彩视频', href: 'https://example.com/qa/video', description: '只提供链接，不嵌入第三方播放器。' }, { title: '不应显示的脚本视频', href: 'javascript:alert(1)' }] },
        { id: 'empty', kind: 'notes', title: '不应显示的空模块', text: '  ' },
        { id: 'notes', kind: 'notes', title: '不应显示的重复模块', text: '重复ID' },
      ] },
    { id: 'empty-game', game: 'other', label: '不应显示的空游戏' },
    { id: 'link-only-qa', game: 'other', label: '仅主页链接的游戏', href: 'https://example.com/qa/game-only' },
    { id: 'region-only-qa', game: 'other', label: '仅公开区服的游戏', region: 'QA 区服（无玩家ID）' },
    { id: 'unsafe-game-link-only', game: 'other', label: '不应显示的脚本主页游戏', href: 'javascript:alert(1)' },
  ],
}
