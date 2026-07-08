/**
 * Turso migration: 太医院医讯数据表
 *
 * 创建 medical_news 表存储医讯条目。
 * 字段：id（主键）、news_json（完整结构化数据）、importance（排序）、created_at、updated_at。
 *
 * 种子数据包含 3 篇初始医讯（AI、Breakthrough、Trial），
 * 对应 src/app/api/court/taiyi/news/route.ts 的 FALLBACK_NEWS。
 */

-- 建表
CREATE TABLE IF NOT EXISTS medical_news (
  id TEXT PRIMARY KEY,
  news_json TEXT NOT NULL,           -- 完整 MedicalNewsItem JSON
  category TEXT NOT NULL,             -- breakthrough | trial | ai | policy
  headline TEXT NOT NULL,
  importance INTEGER NOT NULL,        -- 0-100，用于排序
  relevant BOOLEAN DEFAULT 0,         -- 是否与用户关注疾病相关
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 索引优化查询
CREATE INDEX IF NOT EXISTS idx_medical_news_importance ON medical_news(importance DESC);
CREATE INDEX IF NOT EXISTS idx_medical_news_category ON medical_news(category);
CREATE INDEX IF NOT EXISTS idx_medical_news_relevant ON medical_news(relevant);

-- 种子数据插入（示例 3 条医讯）
INSERT OR IGNORE INTO medical_news (
  id, news_json, category, headline, importance, relevant, created_at, updated_at
) VALUES
(
  'n1',
  json('{"id":"n1","category":"ai","headline":"Neuralink N1 二代植入患者突破 12 例，运动皮层解码延迟降至 48 ms","excerpt":"新一代柔性电极阵列显著降低胶质瘢痕，长时程（>9 月）信噪比维持在商用级。已在 ALS 与四肢瘫患者实现光标控制、短信听写、AR 打字三项日常任务。","source":"Nature Neuroscience","importance":92,"publishedAt":"2024-12-18T18:00:00Z","relevant":false,"tags":["脑机接口","运动神经元","ALS"],"citations":[{"title":"Nature Neuroscience - Neuralink N1 Study","type":"research","url":"https://www.nature.com/articles/nn.taiyi","excerpt":"新一代脑机接口植入体临床试验"}]}'),
  'ai',
  'Neuralink N1 二代植入患者突破 12 例，运动皮层解码延迟降至 48 ms',
  92,
  0,
  datetime('now'),
  datetime('now')
),
(
  'n2',
  json('{"id":"n2","category":"breakthrough","headline":"靶向心脏纤维化的 mRNA 疗法 II 期达到主终点，射血分数提升 8.2%","excerpt":"首个针对 HFpEF 的 mRNA 直接心肌递送方案，48 周随访显示 LVEF 改善显著优于对照组，心衰住院率下降 31%。","source":"NEJM","importance":88,"publishedAt":"2024-12-17T12:00:00Z","relevant":true,"tags":["心脏","HFpEF","mRNA"],"citations":[{"title":"NEJM - mRNA Cardiac Therapy","type":"research","excerpt":"II 期临床试验达到主终点"}]}'),
  'breakthrough',
  '靶向心脏纤维化的 mRNA 疗法 II 期达到主终点，射血分数提升 8.2%',
  88,
  1,
  datetime('now'),
  datetime('now')
),
(
  'n3',
  json('{"id":"n3","category":"ai","headline":"GPT-5 medical 版通过美国执业医师考试各科 94% 正确率，超越 95% 住院医","excerpt":"OpenAI 与 Mayo Clinic 联合发布医疗微调版，在 USMLE Step 1/2/3 与各专科 board 模拟题上整体超越执医基线，但在罕见病个例与用药相互作用仍有 6% 误判。","source":"JAMA","importance":85,"publishedAt":"2024-12-16T09:00:00Z","relevant":false,"tags":["AI","LLM","执业考试"],"citations":[{"title":"JAMA - GPT-5 Medical Evaluation","type":"research","excerpt":"医疗大模型执业考试评估"}]}'),
  'ai',
  'GPT-5 medical 版通过美国执业医师考试各科 94% 正确率，超越 95% 住院医',
  85,
  0,
  datetime('now'),
  datetime('now')
);
