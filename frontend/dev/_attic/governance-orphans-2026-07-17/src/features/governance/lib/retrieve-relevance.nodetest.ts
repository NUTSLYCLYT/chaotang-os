import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSignalsByRelevance, type RetrievableSignal } from './three-chamber-engine.ts';

const SIGNALS: RetrievableSignal[] = [
  { title: '欧盟 AI Act 配套细则加速落地', summary: '欧盟委员会将发布 AI Act 实施细则，覆盖高风险系统合规边界', url: 'https://reuters.com/eu-ai-act' },
  { title: '美联储主席释放紧缩信号', summary: '暗示暂缓降息，市场流动性预期转向', url: '' },
  { title: '东南亚 AI 基础设施投资窗口', summary: '印尼越南新增 AI 数据中心投资', url: 'https://bloomberg.com/sea-ai' },
];

test('命令匹配到相关情报 → 召回，且相关的排前', () => {
  const hits = rankSignalsByRelevance('评估欧盟 AI Act 配套细则对我们业务的合规风险', SIGNALS);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0]?.title, '欧盟 AI Act 配套细则加速落地');
});

test('命令与库零重合 → 空数组（诚实缺证，不硬凑）', () => {
  const hits = rankSignalsByRelevance('低温电池冬季续航衰减测试方法', SIGNALS);
  assert.equal(hits.length, 0);
});

test('topN 截断：最多 5 条', () => {
  const many = Array.from({ length: 12 }, () => SIGNALS[0]!);
  assert.ok(rankSignalsByRelevance('欧盟 AI Act 配套细则合规', many).length <= 5);
});

test('minScore 门槛：仅偶然单片段重合不算命中', () => {
  // “评估”与库里任何标题至多 1 个二字片段重合 < 默认 minScore(3) → 不召回噪声
  const hits = rankSignalsByRelevance('评估仓储物流路线', SIGNALS);
  assert.equal(hits.length, 0);
});

// —— 会审 CRITICAL 1 回归：主题无关但通用行政词高度重合，绝不能凑够覆盖度误放行 ——
test('通用行政词堆叠（评估/风险/合规/影响/业务/下一步）主题无关 → 0 命中（停用词过滤）', () => {
  // 这句和库里"欧盟 AI Act"主题毫不相关，只共享一堆通用词；若不过滤停用词会假阳性凑够 3 片段
  const hits = rankSignalsByRelevance('评估仓储供应商合规风险对我们业务的影响与下一步', SIGNALS);
  assert.equal(hits.length, 0);
});

// —— 回归：纯年份/数字重合不得凑够覆盖度（"铭硕新能税务"误召回"2026 大模型"新闻） ——
test('年份重合不算相关：新主体查询与含同年份的无关情报 → 0 命中（诚实缺证）', () => {
  const daMoXing: RetrievableSignal[] = [
    { title: '2025 大模型技术四大里程碑与 2026 产业落地', summary: '大模型技术演进与 2026 年产业趋势', url: '' },
  ];
  const hits = rankSignalsByRelevance('请分析2026年7月铭硕新能的税务情况', daMoXing);
  assert.equal(hits.length, 0, '主体词(铭硕/新能/税务)零重合,只共享年份2026,必须判缺证不得硬凑');
});

test('去停用词后仍靠有辨识度词命中真相关（中美/欧盟AI 等实体不被误伤）', () => {
  const usChina: RetrievableSignal[] = [{ title: '中美元首会晤与中美关系新定位', summary: '元首外交引领中美关系', url: '' }];
  const hits = rankSignalsByRelevance('评估中美元首会晤与中美关系新定位对我们业务的影响', usChina);
  assert.equal(hits.length, 1); // 中美/元首/会晤/关系 等有辨识度词仍召回
});
