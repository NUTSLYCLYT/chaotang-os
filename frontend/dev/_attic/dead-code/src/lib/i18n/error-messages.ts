export const ERROR_MESSAGES = {
  network_offline: {
    title: '网络已断开',
    body: '部分功能不可用。请检查网络连接后重试。',
    action: '等待网络恢复',
  },
  network_restored: {
    title: '网络已恢复',
    body: '连接已恢复，可以继续使用。',
  },
  manor_timeout: {
    title: '庄园暂时无响应',
    body: '任务已保存，稍后可在史馆查看。',
    action: '重试',
  },
  manor_unavailable: {
    title: '庄园服务不可达',
    body: '法务庄园暂时下线，任务已保存。请稍后重试。',
    action: '重试',
  },
  permission_denied: {
    title: '无权访问此任务',
    body: '该任务属于其他身份，请切换身份后查看。',
    action: '切换身份',
  },
  task_failed: {
    title: '庄园未响应',
    body: '任务执行失败，可点击重试重新提交。',
    action: '重试',
  },
  generic: {
    title: '出现错误',
    body: '请刷新页面重试，或联系管理员。',
    action: '刷新页面',
  },
} as const;

export type ErrorKey = keyof typeof ERROR_MESSAGES;
