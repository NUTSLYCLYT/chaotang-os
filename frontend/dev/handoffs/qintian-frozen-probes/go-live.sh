#!/usr/bin/env bash
# 钦天监上线·一键发射(2026-07-04 备)：把 5 条真情报写进 intel_signals,点亮 source='turso' 全链。
# 前提(稳定时段、你在场时执行):
#   1. dev server 起着:  cd chaotang-web-lyt && nohup pnpm dev > /tmp/dev.log 2>&1 & disown; sleep 6
#      (dev=NODE_ENV≠prod → 用本地 file:./.chaotang-main-dev.db,首次访问自动建表,不碰生产:3050)
#   2. 拿登录 token:浏览器登录朝堂 → DevTools → Application → Cookies → 复制 courtos.access_token 的值
#   3. 填进下面 TOKEN=，然后 bash go-live.sh
# 出错防护:每条 POST 打印结果;source-gate 会挡掉缺真 URL 的(这 5 条都带真 SMM/新浪/证券时报 URL)。
set -euo pipefail
TOKEN='<把浏览器 courtos.access_token 的值贴这里>'
BASE='http://localhost:3002/chaotang'   # dev 端口;上 prod 改 3050(prod 用真 Turso,需先确认 TURSO_DB_URL)

post() {  # $1=id $2=title $3=summary $4=url $5=name $6=publishedAt
  echo "→ 写入 [$1] $2"
  curl -s -X POST "$BASE/api/court/intel/signals" \
    -H 'Content-Type: application/json' -H "Cookie: courtos.access_token=$TOKEN" \
    --data-raw "{\"id\":\"$1\",\"title\":\"$2\",\"summary\":\"$3\",\"sourceLabel\":\"LIVE\",\"ticker\":\"lithium-carbonate\",\"market\":\"CN\",\"region\":\"CN\",\"sources\":[{\"name\":\"$5\",\"url\":\"$4\",\"sourceType\":\"market_data\",\"credibility\":\"high\",\"publishedAt\":\"$6\",\"capturedAt\":\"2026-07-04T00:00:00Z\"}]}"
  echo
}

post "smm-103982413" "中矿资源子公司江西中矿锂业临时停产检修，锂盐供应预期收紧" "中矿全资子公司江西中矿锂业自6月30日起对两条高纯锂盐产线临时停产检修，预计7月底完成，供应预期收紧。" "https://news.smm.cn/news/103982413" "上海有色网SMM" "2026-07-01"
post "sina-4283707" "宁德时代枧下窝锂矿获批安全生产许可证，10万吨碳酸锂产能有望复产" "宁德时代6月29日获批枧下窝锂矿安全生产许可证，市场传10万吨碳酸锂产能将复产，供给端预期宽松。" "https://finance.sina.com.cn/stock/bxjj/2026-07-01/doc-inifheyw4283707.shtml" "新浪财经" "2026-07-01"
post "qq-20260627" "碳酸锂险些失守15万元/吨，枧下窝锂矿短期难复产" "分析指宁德时代枧下窝锂矿尾矿库问题短期难复产，供给端收紧未如市场此前宽松预期。" "https://view.inews.qq.com/a/20260627A01W7000" "华夏时报" "2026-06-27"
post "stcn-3950261" "锂价冲高回落，后续怎么走" "碳酸锂供给宽松预期让锂价突破20万后持续回调，6月8日期货较5月高点下跌超22%。" "https://www.stcn.com/article/detail/3950261.html" "证券时报" "2026-06-08"
post "ofweek-456714143687" "碳酸锂价格持续下跌" "碳酸锂年内过山车行情，近期供给宽松预期下价格持续承压下跌。" "https://mp.ofweek.com/libattery/a456714143687" "OFweek锂电" "2026-06-20"

echo "=== 验证:source 应从 fallback 变 turso ==="
curl -s "$BASE/api/court/intel/signals" | grep -o '"source":"[a-z]*"' | head -1
echo "=== 然后跑生产者产真预测(基于刚入库的真情报) ==="
echo "set -a; source .env.local; set +a; npx tsx dev/handoffs/qintian-frozen-probes/qintian-producer-proto.ts"
