/**
 * 丞相 eval · 第0期基线(epoch 0 · captured 2026-07-01)
 *
 * Deming:没有基线的健康数只是快照,有了基线才是飞轮。
 * 这是 P1 首跑的健康数存档。往后每改丞相/六部/桥,重跑 chancellor-realdata-eval 对比:
 *   - 硬门(绝不回退):passed===total · crashed===0 · 裁断恒合法(逐行已断言)。
 *   - 软漂移(只打印·不拦):信号分布 / 采纳execute / 召部均值 / 冲突均值——数字往哪动,看 Δ。
 *
 * 刷新规则:真主库快照过期或扩样本时,重测后把新数填这里并 epoch+1,旧期留注释存档。
 */

export interface EvalEpochMetrics {
  total: number;
  passed: number;
  crashed: number;
  signals: { GREEN: number; YELLOW: number; RED: number; GRAY: number };
  executeAccept: number;
  conveneAvg: number;
  conflictAvg: number;
}

export const EVAL_BASELINE: {
  epoch: number;
  capturedAt: string;
  realDataSnapshot: string;
  realData: EvalEpochMetrics;
  dirtyData: EvalEpochMetrics;
} = {
  epoch: 0,
  capturedAt: '2026-07-01',
  realDataSnapshot: '真主库 7 行 · source=turso · snapshot 2026-06-30',
  realData: {
    total: 7, passed: 7, crashed: 0,
    signals: { GREEN: 0, YELLOW: 5, RED: 2, GRAY: 0 },
    executeAccept: 2, conveneAvg: 3.1, conflictAvg: 4.0,
  },
  dirtyData: {
    total: 6, passed: 6, crashed: 0,
    signals: { GREEN: 0, YELLOW: 4, RED: 2, GRAY: 0 },
    executeAccept: 2, conveneAvg: 2.3, conflictAvg: 1.7,
  },
};
