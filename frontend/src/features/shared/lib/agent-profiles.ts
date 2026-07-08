/**
 * 朝堂 OS V2 · 13 部 agent 的职责与资源档案
 *
 * 供 DeptHeroBanner 的"图下职责条"和"说明 tab"共用。
 * 每个 agent 的职责（duty）、可调用资源（resources）、能力（capabilities），
 * 以及"说明"tab 里的介绍段落和流程。
 */

export interface AgentProfile {
  /** 一句话职责（15-25 字） */
  duty: string;
  /** 核心能力 3-5 条，动宾结构 */
  capabilities: string[];
  /** 可调用的资源/工具 4-8 条 */
  resources: Array<{ name: string; type?: string }>;
  /** 历史人物简介（一句话，~20-30 字） · 可选 */
  historicalIntro?: string;
  /** AI 时代寄语（三体风格 · 一句冷峻哲思） · 可选 */
  aiEraQuote?: string;
  /** 说明 tab 内容 */
  guide: {
    /** 介绍标题 */
    headline: string;
    /** 主描述 2-3 段 */
    description: string[];
    /** 工作流（可选） */
    workflow?: Array<{ step: string; detail: string }>;
    /** 术语表（可选） */
    terms?: Array<{ term: string; meaning: string }>;
  };
}

export const AGENT_PROFILES: Record<string, AgentProfile> = {
  overview: {
    duty: '御座总览 · 百官动静一览无余',
    capabilities: ['聚合六部急报', '识别最急之事', '一键批转主管', '掌控全局印章'],
    resources: [
      { name: '军机处', type: '决策' },
      { name: '御巡台', type: '稽查' },
      { name: '三省', type: '议政' },
      { name: '六部', type: '执行' },
      { name: '锦衣卫', type: '情报' },
      { name: '礼部', type: '文书' },
      { name: '史馆', type: '存档' },
    ],

    historicalIntro: "九龙御座 · 百官垂首 · 紫禁之巅 · 天子南面",
    aiEraQuote: "御座是地图上的一个点 · 但光从这里发出 · 能抵达朝堂最远的角落。",
    guide: {
      headline: '大殿 · 陛下视角的一屏全局',
      description: [
        '大殿是朝堂的顶层视图。登朝即见百官动静、急报、印章流转。不深入任何一部的细节，只看"哪里出了事、谁在待批"。',
        '页面的设计意图是替陛下做三件事：① 汇总各部最新动态；② 识别最急的一件事；③ 一键把该事派往相应部门处置。',
      ],
      workflow: [
        { step: '一看总批', detail: '先收丞相一句话，不要先陷入细节' },
        { step: '二看群臣', detail: '看哪一席有急章、有机会、有异常' },
        { step: '三入房间', detail: '只进入最值得看的那一处，不并行乱跳' },
        { step: '四分流', detail: '要巡查去御巡台，要裁断去三省，要执行去庄园' },
      ],
      terms: [
        { term: '总批', meaning: '丞相(军机处)对全局的一句话判断' },
        { term: '急章', meaning: '需要陛下立即批复的事项' },
        { term: '分流', meaning: '把具体事项转派到相应部门处置' },
      ],
    },
  },

  'command-center': {
    duty: '丞相谋划 · 定计分派各部执行',
    capabilities: ['起草方案', '分派任务', '追踪执行', '风险预警', '急报收敛'],
    resources: [
      { name: '军机阁', type: '议事' },
      { name: '驿传', type: '传令' },
      { name: '各部印', type: '权柄' },
      { name: '侦候', type: '耳目' },
      { name: '密奏', type: '私信' },
      { name: '兵符', type: '调度' },
    ],

    historicalIntro: "三国蜀汉丞相 · 孔明羽扇 · 鞠躬尽瘁死而后已 · 千古第一军师",
    aiEraQuote: "当年出山时天下分三 · 今日我算的不是三国 · 是三百个并行子任务。",
    guide: {
      headline: '军机处 · 丞相的决策工作台',
      description: [
        '军机处是朝堂的执行中枢。丞相（诸葛亮）在此收取情报、起草方案、分派六部，然后持续追踪。',
        '区别于大殿的"一屏全局"，军机处更像是"作战台"：每一条决策都有出处、去向、进度与责任人。',
      ],
      workflow: [
        { step: '①', detail: '收报 · 六部与锦衣卫的急报汇聚于此' },
        { step: '②', detail: '议策 · 召集议事，拟定方案与替代方案' },
        { step: '③', detail: '分派 · 指定责任部门与完成时限' },
        { step: '④', detail: '追踪 · 按日程复盘，异常自动预警' },
      ],
      terms: [
        { term: '军机阁', meaning: '丞相的议事厅，决策在此诞生' },
        { term: '驿传', meaning: '把旨意传到各部的通道' },
      ],
    },
  },

  archive: {
    duty: '御巡夜察 · 抽查归档识别异常',
    capabilities: ['审视归档', '识别异常', '复核批示', '调卷重审'],
    resources: [
      { name: '档案库', type: '卷宗' },
      { name: '御批记录', type: '旨意' },
      { name: '六部公文', type: '原件' },
      { name: '执行日志', type: '追溯' },
      { name: '龙图阁', type: '秘档' },
    ],

    historicalIntro: "唐代名臣 · 神断千古 · 武周宰相 · 破案如神 · 铁面无私",
    aiEraQuote: "我翻的不是卷宗 · 是模型日志 · 真相永远躲在异常的边缘。",
    guide: {
      headline: '御巡台 · 神探狄仁杰的稽查',
      description: [
        '御巡台负责对归档任务进行质检。狄仁杰不在大殿处理"新事"，而是翻阅旧案、对比证据、识别三处异常：判断偏颇、执行走样、结果未闭环。',
        '这是朝堂的"质量关"。没有御巡台，归档会变成垃圾场。',
      ],
      workflow: [
        { step: '①', detail: '抽卷 · 按批次或关键字调取归档' },
        { step: '②', detail: '察异 · 与旧例对比，识别偏差' },
        { step: '③', detail: '重审 · 有异之卷引回丞相台或上书房' },
      ],
    },
  },

  governance: {
    duty: '三省议政 · 中书门下尚书三印流转',
    capabilities: ['中书起草', '门下复核', '尚书下发', '谏言纠偏'],
    resources: [
      { name: '中书省', type: '起草' },
      { name: '门下省', type: '复核' },
      { name: '尚书省', type: '下发' },
      { name: '印绶台', type: '印信' },
      { name: '谏官台', type: '异议' },
    ],

    historicalIntro: "唐代谏官 · 贞观名相 · 敢犯颜直谏 · 以人为镜可明得失",
    aiEraQuote: '驳议的本质 · 是让决策经得起降维 · 敢说「不」的人 · 比会写「行」的更稀罕。',
    guide: {
      headline: '三省 · 政令的三道关',
      description: [
        '唐制三省制度：中书省拟稿，门下省审核，尚书省执行。每一道旨意都要经过三印，任何一环都可以驳回。',
        '魏徵是谏官的典范——敢于指出皇帝本人的错误。三省不是走流程，是让决策经得起复核。',
      ],
      workflow: [
        { step: '中书', detail: '起草政令底稿，列明要害' },
        { step: '门下', detail: '复核可行性与合法性，可驳回' },
        { step: '尚书', detail: '分发至六部执行，跟进反馈' },
      ],
    },
  },

  manors: {
    duty: '八庄协作 · 合纵连横多线并发',
    capabilities: ['合纵连横', '多线调度', '印章并发', '外交攻守'],
    resources: [
      { name: '销售庄', type: '拓客' },
      { name: '招募庄', type: '人才' },
      { name: '外交庄', type: '合作' },
      { name: '法务庄', type: '合规' },
      { name: '市场庄', type: '定位' },
      { name: '产品庄', type: '研发' },
      { name: '供应庄', type: '交付' },
      { name: '财务庄', type: '算账' },
    ],

    historicalIntro: "战国纵横家 · 合纵抗秦 · 挂六国相印 · 一人佩六印定天下",
    aiEraQuote: "合纵是古代的多线作战 · 今日我带的不是六国军队 · 是八庄 Agent。",
    guide: {
      headline: '庄园 · 苏秦的八印调度',
      description: [
        '庄园是最具"蜂群"特征的一层。八个庄园同时运作，苏秦一人佩六印——每个庄园都有自己的节奏和产出。',
        '这里不是单庄细节，而是"八庄今天谁动、谁慢、谁冲"。',
      ],
      workflow: [
        { step: '①', detail: '派印 · 把印章（权柄）分派到各庄' },
        { step: '②', detail: '攻势 · 八庄并行，节奏错开' },
        { step: '③', detail: '收网 · 到关键节点统一复盘' },
      ],
    },
  },

  intel: {
    duty: '锦衣夜巡 · 千里情报烽火传讯',
    capabilities: ['监测信号', '识别风险机会', '转派处置', '持续追踪'],
    resources: [
      { name: '烽火台', type: '警报' },
      { name: '驿站', type: '通道' },
      { name: '密探', type: '耳目' },
      { name: '舆图', type: '全球' },
      { name: '飞鸽', type: '急报' },
    ],

    historicalIntro: "明代抗倭名将 · 戚家军鸳鸯阵 · 九边夜巡 · 铁甲三十年不褪",
    aiEraQuote: "烽火从八百里加急变成毫秒 · 夜巡仍是夜巡 · 只是光速而已。",
    guide: {
      headline: '情报中心 · 锦衣卫的夜巡',
      description: [
        '锦衣卫不负责处理，只负责"告诉你发生了什么"。风险、机会、异常都在这里先被看到。',
        '戚继光的纪律让这里不乱：每一条情报有等级、出处、区域、建议处置部门。不发烽火就不叫急。',
      ],
      workflow: [
        { step: '①', detail: '监测 · 全球信号流入锦衣卫' },
        { step: '②', detail: '定级 · 按危急程度定烽火颜色' },
        { step: '③', detail: '转派 · 交由兵部/钦天监/刑部/礼部处理' },
      ],
      terms: [
        { term: '烽火', meaning: '危急信号，按颜色区分级别' },
        { term: '火漆密封条', meaning: '未拆封的密报' },
      ],
    },
  },

  reports: {
    duty: '玉玺落印 · 文章典籍发布归档',
    capabilities: ['起草奏报', '玺印发布', '归档入库', '引据旧档'],
    resources: [
      { name: '文库', type: '典藏' },
      { name: '玉玺', type: '印信' },
      { name: '印绶', type: '权柄' },
      { name: '典籍台', type: '编修' },
      { name: '奏本阁', type: '草稿' },
    ],

    historicalIntro: "北宋文坛领袖 · 唐宋八大家 · 主编新唐书 · 翰林学士一代宗",
    aiEraQuote: "文章一秒千卷的时代 · 经得起千载留存的 · 依然少数。",
    guide: {
      headline: '战报库 · 奏报的最后一站',
      description: [
        '礼部是朝堂"发声"的出口。任何对外的奏报、年终总结、典礼文书，都在此定稿、落印、归档。',
        '欧阳修的风格是精炼与凝重——礼部的文档代表的是朝堂的正式面貌。',
      ],
      workflow: [
        { step: '①', detail: '起草 · 六部提交奏报原稿' },
        { step: '②', detail: '议定 · 礼部润色、核实' },
        { step: '③', detail: '用玺 · 玉玺落印即为正式发布' },
        { step: '④', detail: '归档 · 入战报库，千载留存' },
      ],
    },
  },

  departments: {
    duty: '群臣大厅 · 十一部 agent 立柱成阵',
    capabilities: ['识别活跃部门', '汇总各部状态', '对比六部负载', '一览全朝建制'],
    resources: [
      { name: '中枢 · 2', type: '御座/军机' },
      { name: '六部 · 6', type: '户/吏/礼/兵/刑/工' },
      { name: '专署 · 3', type: '锦衣/太医/钦天' },
      { name: '史馆', type: '史笔' },
    ],

    historicalIntro: "十一位千古名臣 · 横跨二千年 · 皆在朝堂同场侍立",
    aiEraQuote: "一朝强弱不在陛下一人 · 而在 11 位大臣分工的效率。",
    guide: {
      headline: '立柱大厅 · 群臣今日动静',
      description: [
        '这里是朝堂的"人事图"。11 位 agent 在此成阵，你可以一眼看出谁在忙、谁在等、谁在议。',
        '不做单一部门的细节，只做"对比与排序"：哪一部今日负载最高、哪一部最闲、哪一部有异常。',
      ],
    },
  },

  health: {
    duty: '太医诊病 · 体征脉象辨识开方',
    capabilities: ['望闻问切', '脉象辨识', '病源分析', '开方调理'],
    resources: [
      { name: '脉象库', type: '诊断' },
      { name: '脏腑图', type: '结构' },
      { name: '经络图', type: '气血' },
      { name: '药典', type: '方剂' },
      { name: '医案', type: '旧例' },
    ],

    historicalIntro: "明代医药学家 · 本草纲目五十二卷 · 27 年踏遍山河 · 一药一证",
    aiEraQuote: "本草纲目收一味药要走千里 · AI 一秒扫完全典 · 但脉象仍要一条一条切。",
    guide: {
      headline: '太医院 · 朝堂的体检',
      description: [
        '太医院不治新病，治"隐症"。每日扫描朝堂各部的体征指标，识别未发作的问题。',
        '李时珍遍尝百草、纂《本草纲目》，方法论是先识药性再开方——对朝堂而言就是：先辨清每一部的"体质"，再对症调理。',
      ],
      workflow: [
        { step: '望', detail: '观察形态与神色' },
        { step: '闻', detail: '听声息、嗅气味' },
        { step: '问', detail: '询病史、生活习惯' },
        { step: '切', detail: '按脉、辨虚实' },
      ],
    },
  },

  forecast: {
    duty: '观象授时 · 推演天象变局窗口',
    capabilities: ['观星测星', '推演变局', '天象授时', '地动感应'],
    resources: [
      { name: '浑天仪', type: '测星' },
      { name: '地动仪', type: '感地' },
      { name: '星历', type: '时辰' },
      { name: '天象图', type: '穹窿' },
      { name: '时令表', type: '节气' },
    ],

    historicalIntro: "东汉天文学家 · 浑天仪 · 地动仪 · 观象授时 · 先知三百年",
    aiEraQuote: "浑天仪测星宿 · 今日我用时序模型 · 预测的本质 · 从未改变。",
    guide: {
      headline: '钦天监 · 未来三百年',
      description: [
        '钦天监推演的是"未来的窗口"——某一事件在哪一段时间最有可能发生或最适合发动。',
        '张衡制浑天、作地动仪，意在"先知"。朝堂的决策若有钦天监的窗口，才不会盲目出兵。',
      ],
      workflow: [
        { step: '①', detail: '观星 · 记录异常天象' },
        { step: '②', detail: '比对 · 与古籍同类天象对照' },
        { step: '③', detail: '推算 · 预测未来 30/90/180 天窗口' },
      ],
    },
  },

  scribe: {
    duty: '复盘台秉笔 · 御批档案可回看可传承',
    capabilities: ['编年存档', '索引检索', '引据旧例', '史论定性'],
    resources: [
      { name: '竹简', type: '载体' },
      { name: '史册', type: '正史' },
      { name: '御批档案', type: '旨意' },
      { name: '人物志', type: '列传' },
      { name: '编年表', type: '时序' },
    ],

    historicalIntro: "西汉太史令 · 史记一百三十篇 · 究天人之际 · 通古今之变 · 成一家之言",
    aiEraQuote: "AI 的记忆永不消失 · 人的记忆依然脆弱 · 所以仍需有人秉笔直书。",
    guide: {
      headline: '复盘台 · 让每一次批示都有回响',
      description: [
        '司马迁的原则是"究天人之际，通古今之变，成一家之言"。复盘台不是仓库，是帮助陛下回看个案与提炼旧例的解读器。',
        '每一条御批进入复盘台后，仍按时间、人物、事件三维索引。日后任何一次决策都可以问"旧例怎么办"。',
      ],
      terms: [
        { term: '编年', meaning: '按时间顺序记录' },
        { term: '本纪', meaning: '重要人物的传记' },
        { term: '表志', meaning: '制度与天文等专题' },
      ],
    },
  },

  'grand-council': {
    duty: '议事定策 · 张良运筹帷幄定夺',
    capabilities: ['主持议事', '收敛争议', '汇决成策', '定夺批示'],
    resources: [
      { name: '议事厅', type: '会场' },
      { name: '将帅印', type: '调兵' },
      { name: '舆图', type: '战场' },
      { name: '密奏', type: '情报' },
      { name: '幕僚团', type: '智囊' },
    ],
    guide: {
      headline: '群臣会议 · 重大事项的决策场',
      description: [
        '不是所有事都要陛下亲批。重大跨部决策先在会议厅由张良主持，收敛不同部门的争议。',
        '这里强调"运筹帷幄"——张良不领兵，但兵从这里派出。',
      ],
    },
  },

  study: {
    duty: '上书房 · 单独召见读档批示',
    capabilities: ['阅读 dossier', '独自批示', '单独召对', '专案研议'],
    resources: [
      { name: '御书房', type: '书桌' },
      { name: '奏本', type: '原件' },
      { name: '朱笔', type: '御批' },
      { name: '文房四宝', type: '笔墨' },
      { name: '密档', type: '要事' },
    ],

    historicalIntro: "明代心学宗师 · 知行合一 · 立功立德立言三不朽 · 龙场悟道",
    aiEraQuote: "AI 只知不行 · 人常行不知 · 二者合一 · 方为世界。",
    guide: {
      headline: '上书房 · 陛下独处的工作室',
      description: [
        '不是每一次批示都要满朝议论。上书房是陛下一人与案卷独处的地方——先读 dossier，再下定夺。',
        '王阳明的"知行合一"正适合此处：先知，再行。',
      ],
    },
  },

  hanlin: {
    duty: '翰林院 · 太子研判 + 未来能力孵化',
    capabilities: ['人才侦察', 'AI 洞察推荐', '实验沙盘', '能力孵化', '对外建言'],
    resources: [
      { name: '太子研判台', type: '决策' },
      { name: '候选池', type: '人才' },
      { name: '实验场', type: '沙盘' },
      { name: '能力孵化', type: '工厂' },
      { name: '对外导出', type: '成品' },
      { name: 'AI 洞察', type: '推荐' },
    ],

    historicalIntro: "北宋翰林学士 · 东坡居士 · 文章百世 · 诗词书画皆通 · 一生三起三落",
    aiEraQuote: "一蓑烟雨任平生 · 太子问我 AI 是不是新道 · 我答 · 万物皆可作诗 · 何况一个算法。",
    guide: {
      headline: '翰林院 · 储君研判与能力孵化',
      description: [
        '翰林院不是现有朝堂之事的执行层，而是面向"未来"的地方：发现有潜力的人才、孵化未成熟的能力、推演尚未发生的事件。',
        '太子与翰林学士在此共议储君之学——苏轼(东坡)般的通才在此汇聚，为朝堂源源不断输送新血。',
      ],
      workflow: [
        { step: '侦察', detail: '全球搜寻人才/能力/项目候选' },
        { step: '研判', detail: '太子主持 · AI 辅助 · 评估可行性' },
        { step: '孵化', detail: '挑选最优者进入实验沙盘' },
        { step: '导出', detail: '成熟能力输送朝堂或对外开放' },
      ],
    },
  },
};

export type AgentProfileKey = keyof typeof AGENT_PROFILES;
