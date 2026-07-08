export type LibuResidentSkillGroup =
  | 'character'
  | 'video'
  | 'visual'
  | 'frontend'
  | 'review';

export interface LibuResidentSkill {
  id: string;
  label: string;
  group: LibuResidentSkillGroup;
  command: string;
  useWhen: string;
  output: string;
  gates: string[];
  quickLabel: string;
  readyPrompt: string;
}

export const LIBU_RESIDENT_SKILLS: LibuResidentSkill[] = [
  {
    id: 'vam-character-master',
    label: 'VaM 成人角色总监',
    group: 'character',
    command: 'vam-character-master',
    useWhen: '需要设计 VaM 成人角色 preset、形象资产、服化道与可复用人物设定时。',
    output: '角色定位、morph/skin/hair/pose/scene preset 方案、验证清单。',
    gates: ['仅成人角色', '不得伪装 VaM GUI 验收', '敏感资产需本地留证'],
    quickLabel: 'VaM 角色',
    readyPrompt: '用 vam-character-master 设计一个 VaM 成人角色 preset：写清人物设定、morph、皮肤、发型、服装、灯光、pose、依赖插件和验收方法。',
  },
  {
    id: 'ai-video-pro-system',
    label: '短视频流水线导演',
    group: 'video',
    command: 'ai-video-pro-system',
    useWhen: '需要从选题、脚本、Hero Frame、生成、剪辑、复盘搭建短视频生产 SOP 时。',
    output: 'MCSLA 简报、镜头表、A/B 变体、质检分、发布复盘表。',
    gates: ['先锁 Hero Frame 再动视频', '必须有 A/B 版本', '必须写清平台与指标'],
    quickLabel: '短视频流水线',
    readyPrompt: '用 ai-video-pro-system 做一套短视频生产流水线：按 MCSLA、Hero Frame Lock、镜头生成、后期、发布、复盘输出。',
  },
  {
    id: 'seedance-cinematic',
    label: '电影感分镜提示词',
    group: 'video',
    command: 'seedance-cinematic',
    useWhen: '需要 4-15 秒电影感 Seedance 视频 prompt、镜头节奏、光影与声画提示时。',
    output: '3 条可直接投喂 Seedance 的结构化 prompt。',
    gates: ['2 秒内必须有 hook', '写清 camera/lighting/color/audio', '素材引用用 @material'],
    quickLabel: '电影感 Prompt',
    readyPrompt: '用 seedance-cinematic 写 3 条电影感视频 prompt：每条包含 hook、camera、subject、lighting、color、motion、audio。',
  },
  {
    id: 'imagegen',
    label: '朝堂视觉主图工房',
    group: 'visual',
    command: 'imagegen',
    useWhen: '需要生成 hero 图、海报主视觉、角色概念图、封面或关键帧时。',
    output: '一张可落盘的生成图与可复用视觉提示词。',
    gates: ['项目资产需保存到仓内', '真实品牌不可误导', '透明图先按纯色背景生成'],
    quickLabel: 'Hero 图',
    readyPrompt: '用 imagegen 生成一张朝堂系统 hero 图：电影级中式数字朝堂、中央决策台、六部数据光幕、帝金光线、宽幅构图。',
  },
  {
    id: 'frontend-design',
    label: '页面重构设计师',
    group: 'frontend',
    command: 'frontend-design',
    useWhen: '需要重做页面、提升首屏信息架构、统一组件和交互密度时。',
    output: '可运行的前端改造、页面结构、视觉取舍和验收截图。',
    gates: ['复用本仓设计 token', '不重写冻结 globals.css', '视觉类改动必须浏览器验收'],
    quickLabel: '重做页面',
    readyPrompt: '用 frontend-design 重做当前页面：保留朝堂视觉资产，优化首屏层级、交互密度、响应式和可读性。',
  },
  {
    id: 'ui-ux-pro-max',
    label: 'UI/UX 发布审查官',
    group: 'review',
    command: 'ui-ux-pro-max',
    useWhen: '需要审当前 UI 的可用性、无障碍、布局、移动端、信息架构和发布风险时。',
    output: '按严重度排序的问题清单、修复建议、验收门禁。',
    gates: ['先找现有设计系统', '必须覆盖移动端', '必须指出可操作修复'],
    quickLabel: 'UI 审查',
    readyPrompt: '用 ui-ux-pro-max 审一下当前 UI：按 P0/P1/P2 输出布局、可读性、交互、无障碍、移动端和性能问题。',
  },
];

export const LIBU_AUTO_DISPATCH_PROMPT =
  '礼部总调度：我只说一个目标，请你自动判断该调用 VaM 角色、短视频流水线、Seedance prompt、imagegen、frontend-design 还是 UI/UX 审查，并输出执行顺序、产物清单和风险边界。';

export const LIBU_RESIDENT_SKILL_GROUP_LABELS: Record<LibuResidentSkillGroup, string> = {
  character: '角色资产',
  video: '视频生产',
  visual: '视觉生成',
  frontend: '页面改造',
  review: '审查门禁',
};

export function getLibuResidentSkillPrompt(skillId: string): string | null {
  return LIBU_RESIDENT_SKILLS.find((skill) => skill.id === skillId)?.readyPrompt ?? null;
}
