/**
 * 上书房参考画面 · 交互热区配置
 *
 * 画面 `public/study/shangshufang-bg.webp`（1672×941）当底图，
 * 在画好的按钮/面板位置叠透明真热区。坐标用「百分比」(相对底图舞台)，
 * 缩放不错位。坐标为初始估算，靠 ?zones=1 调试叠框 + 截图比对迭代校准。
 */

export type HotspotKind = 'route' | 'toast' | 'approve' | 'reject' | 'report';

export interface Hotspot {
  id: string;
  label: string;
  /** 百分比矩形（相对底图舞台）*/
  x: number;
  y: number;
  w: number;
  h: number;
  kind: HotspotKind;
  /** route → 路径；report → /reports/[target]；其余可空 */
  target?: string;
  toastTitle?: string;
  toastDesc?: string;
}

export const SHANGSHUFANG_RATIO = 1672 / 941;

export const SHANGSHUFANG_HOTSPOTS: Hotspot[] = [
  /* ── 顶部导航 ── */
  { id: 'nav-dadian', label: '大殿', x: 30.8, y: 2.0, w: 4.6, h: 4.0, kind: 'route', target: '/overview' },
  { id: 'nav-liubu', label: '六部', x: 36.2, y: 2.0, w: 4.6, h: 4.0, kind: 'route', target: '/departments' },
  { id: 'nav-jiuqing', label: '九卿', x: 41.6, y: 2.0, w: 4.6, h: 4.0, kind: 'route', target: '/manors' },
  { id: 'nav-renwu', label: '任务', x: 47.2, y: 2.0, w: 4.6, h: 4.0, kind: 'route', target: '/command-center' },
  { id: 'nav-aizhongshu', label: 'AI中枢', x: 52.4, y: 2.0, w: 6.2, h: 4.0, kind: 'route', target: '/grand-council' },
  { id: 'nav-shuju', label: '数据', x: 59.2, y: 2.0, w: 4.6, h: 4.0, kind: 'route', target: '/reports' },
  { id: 'nav-shezhi', label: '设置', x: 64.4, y: 2.0, w: 4.6, h: 4.0, kind: 'route', target: '/settings' },
  { id: 'top-bell', label: '通知', x: 86.8, y: 1.8, w: 2.6, h: 5, kind: 'toast', toastTitle: '通知', toastDesc: '您有 17 件待裁决事项，3 件紧急。' },
  { id: 'top-help', label: '帮助', x: 89.6, y: 1.8, w: 2.6, h: 5, kind: 'toast', toastTitle: '上书房帮助', toastDesc: '点击画面中的面板与按钮即可操作。' },
  { id: 'top-user', label: '皇上', x: 92.4, y: 1.6, w: 7, h: 5, kind: 'toast', toastTitle: '皇上', toastDesc: '账户与偏好设置请前往「设置」。' },

  /* ── 左 · 为您推荐 / 钦天监教学 ── */
  { id: 'rec-1', label: '先处理 3 件紧急事项', x: 4, y: 60, w: 13, h: 6, kind: 'toast', toastTitle: '先处理 3 件紧急事项', toastDesc: '今日有 3 件紧急待处理。' },
  { id: 'rec-2', label: '关注户部财政异常', x: 4, y: 67.5, w: 13, h: 6, kind: 'toast', toastTitle: '户部财政异常', toastDesc: '开支超预算 18%，建议核查。' },
  { id: 'rec-3', label: '审批 5 件可一键通过', x: 4, y: 74.5, w: 13, h: 6, kind: 'toast', toastTitle: '5 件可一键通过', toastDesc: '多为例行事务。' },
  { id: 'lesson-detail', label: '查看详情（钦天监教学）', x: 46.5, y: 76, w: 8, h: 5, kind: 'toast', toastTitle: '御下之道 · 恩威并施', toastDesc: '为君者，恩威并行，方能服众。' },

  /* ── 今日朝报 / 重要事件 ── */
  { id: 'events-viewall', label: '查看全部重要事件', x: 19, y: 65, w: 14, h: 4.5, kind: 'route', target: '/intel' },

  /* ── 待裁决事项（查看 / 批示）── */
  { id: 'pv1-view', label: '查看 · 江南赈灾', x: 63.4, y: 25.2, w: 4, h: 4.2, kind: 'report', target: 'rpt-jiangnan-relief' },
  { id: 'pv1-approve', label: '批示 · 江南赈灾', x: 68, y: 25.2, w: 4.8, h: 4.2, kind: 'approve' },
  { id: 'pv2-view', label: '查看 · 北境粮草', x: 63.4, y: 34.4, w: 4, h: 4.2, kind: 'report', target: 'rpt-beijing-supply' },
  { id: 'pv2-approve', label: '批示 · 北境粮草', x: 68, y: 34.4, w: 4.8, h: 4.2, kind: 'approve' },
  { id: 'pv3-view', label: '查看 · 京城盗贼案', x: 63.4, y: 44.6, w: 4, h: 4.2, kind: 'report', target: '' },
  { id: 'pv3-approve', label: '批示 · 京城盗贼案', x: 68, y: 44.6, w: 4.8, h: 4.2, kind: 'approve' },
  { id: 'pv-viewall', label: '查看全部待裁决 17 件', x: 45.5, y: 52, w: 15, h: 4.5, kind: 'route', target: '/command-center' },

  /* ── 快捷下旨（6 + 自定义）── */
  { id: 'qd-agree', label: '同意 · 批准通过', x: 76, y: 21.4, w: 8.6, h: 7, kind: 'approve' },
  { id: 'qd-reject', label: '驳回 · 退回重议', x: 85.4, y: 21.4, w: 8.6, h: 7, kind: 'reject' },
  { id: 'qd-investigate', label: '查办 · 彻查办理', x: 76, y: 29.9, w: 8.6, h: 7, kind: 'toast', toastTitle: '查办', toastDesc: '已交相关部门彻查办理。' },
  { id: 'qd-discuss', label: '议处 · 依法处置', x: 85.4, y: 29.9, w: 8.6, h: 7, kind: 'route', target: '/grand-council' },
  { id: 'qd-reward', label: '赐赏 · 赏赐表彰', x: 76, y: 38.4, w: 8.6, h: 7, kind: 'toast', toastTitle: '赐赏', toastDesc: '已拟赏赐表彰之旨。' },
  { id: 'qd-pardon', label: '宽免 · 宽宥减责', x: 85.4, y: 38.4, w: 8.6, h: 7, kind: 'toast', toastTitle: '宽免', toastDesc: '已拟宽宥减责之旨。' },
  { id: 'qd-custom', label: '自定义下旨', x: 76, y: 47.4, w: 18, h: 6.5, kind: 'route', target: '/throne/compose' },

  /* ── 最近奏折 / 最近任务 ── */
  { id: 'rm-viewall', label: '查看全部奏折', x: 66, y: 78.5, w: 11, h: 4, kind: 'route', target: '/reports' },
  { id: 'rt-viewall', label: '查看全部任务', x: 88.5, y: 78.5, w: 10.5, h: 4, kind: 'route', target: '/command-center' },

  /* ── 底部 · 开始处理 ── */
  { id: 'start-process', label: '开始处理紧急事项', x: 54.8, y: 91, w: 7.6, h: 5, kind: 'route', target: '/throne/compose' },
];
