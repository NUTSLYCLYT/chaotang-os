/**
 * 占位 · 把 libu key 加进 AGENT_PROFILES 的扩展点
 * 不直接改 agent-profiles.ts（避免影响其他 13 项）· 走 module augmentation
 *
 * 当 DeptPageShell 以 deptKey="libu" 调用时 · AGENT_PROFILES.libu 提供 fallback
 */

export const LIBU_PROFILE = {
  duty: '掌典籍 · 修辞章 · 备援引',
  capabilities: ['文档摄入', '语义检索', '脚注援引', '陛下批注'],
  resources: [
    { name: '经', type: '经典著作' },
    { name: '史', type: '案例史卷' },
    { name: '子', type: '理论方法' },
    { name: '集', type: '随手剪报' },
  ],
  historicalIntro: '司礼监 · 文渊阁 · 朝堂的眼界与底气 · 凡奏对必引经据典',
  aiEraQuote:
    '陛下的知识库 · 不是塞给 ChatGPT 的 prompt · 是朝堂代代相传的眼神。',
  guide: {
    headline: '御书房 · 个人知识圣殿',
    description: [
      '上传 PDF/网页/文本 · 自动切分入卷 · 经史子集四部归档。',
      'AI 答问时主动检索 · 句末脚注援引 · 让每个建议都有出处。',
    ],
    workflow: [
      { step: '收', detail: '上传 / 粘贴 URL / 文本' },
      { step: '入', detail: '自动切分 + 语义索引' },
      { step: '援', detail: 'AI 答问自动援引 · 标 [N]' },
      { step: '注', detail: '陛下随手批注 · 反向沉淀' },
    ],
  },
};
