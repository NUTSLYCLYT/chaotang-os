/**
 * 朝堂 OS · 朱批卡 Social Card Generator
 *
 * 用纯 Canvas 2D 绘制一张 1080×1080 的朝堂美学分享卡：
 *   - 金黑朱三色
 *   - 陛下今日决策要点（1-3 条）
 *   - 丞相一句评语
 *   - 右下金印 · 朝堂 OS 水印
 *
 * 导出为 PNG Blob 或 Data URL，可下载或复制到剪贴板。
 *
 * 零依赖 · 全客户端 · 无需上传。
 */

export interface VerdictCardData {
  /** 1-3 件事，每件一句话 */
  highlights: string[];
  /** 丞相一句话总批 */
  primeMinisterVerdict: string;
  /** 陛下签名日期（可选，默认今天） */
  date?: string;
  /** 御批类型 */
  verdict?: '准' | '驳' | '再议' | '行' | '查';
}

const WIDTH = 1080;
const HEIGHT = 1080;

const GOLD = '#F0C66A';
const GOLD_DEEP = '#8A6224';
const CREAM = '#F5E9C9';
const BG_DARK = '#0A0704';
const BG_MID = '#15120A';
const RED_SEAL = '#C03030';
const MUTED = '#8A92AC';

/** 等 Noto Serif SC 等 web font 加载完毕再画，避免首次 canvas 用默认字体 */
async function waitForFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.ready;
  } catch {
    /* fallthrough */
  }
}

function formatChineseDate(d: Date = new Date()): string {
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月${d.getDate()}日`;
}

export async function renderVerdictCard(data: VerdictCardData): Promise<string> {
  await waitForFonts();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d not available');
  if (!data.highlights || data.highlights.length === 0) {
    throw new Error('verdict card requires at least one highlight');
  }

  // ===== 背景 =====
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, BG_MID);
  bgGrad.addColorStop(0.5, BG_DARK);
  bgGrad.addColorStop(1, '#07050F');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 左上放射金光
  const radial = ctx.createRadialGradient(200, 200, 20, 200, 200, 700);
  radial.addColorStop(0, 'rgba(240,198,106,0.22)');
  radial.addColorStop(1, 'rgba(240,198,106,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 右下放射红光
  const radialRed = ctx.createRadialGradient(880, 880, 20, 880, 880, 500);
  radialRed.addColorStop(0, 'rgba(192,48,48,0.18)');
  radialRed.addColorStop(1, 'rgba(192,48,48,0)');
  ctx.fillStyle = radialRed;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ===== 金色双外框 =====
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, WIDTH - 80, HEIGHT - 80);
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1;
  ctx.strokeRect(56, 56, WIDTH - 112, HEIGHT - 112);

  // ===== 顶部小标 =====
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 22px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText('CourtOS · 朝堂 OS', 90, 120);

  // 顶部金分隔线
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(90, 144);
  ctx.lineTo(340, 144);
  ctx.stroke();

  // ===== 主标题 =====
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 72px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText('陛下今日朱批', 90, 240);

  ctx.fillStyle = MUTED;
  ctx.font = '24px "Noto Serif SC", serif';
  ctx.fillText(data.date ?? formatChineseDate(), 90, 282);

  // ===== Highlights 卡片 =====
  const highlightTop = 340;
  const highlightHeight = 80;
  const highlightGap = 16;
  const highlights = data.highlights.slice(0, 3);

  highlights.forEach((text, i) => {
    const y = highlightTop + i * (highlightHeight + highlightGap);

    // 底卡
    const cardGrad = ctx.createLinearGradient(90, y, 90, y + highlightHeight);
    cardGrad.addColorStop(0, 'rgba(240,198,106,0.08)');
    cardGrad.addColorStop(1, 'rgba(240,198,106,0.02)');
    ctx.fillStyle = cardGrad;
    ctx.fillRect(90, y, WIDTH - 180, highlightHeight);

    // 左金条
    ctx.fillStyle = GOLD;
    ctx.fillRect(90, y, 4, highlightHeight);

    // 序号
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}`, 118, y + 52);

    // 文字
    ctx.fillStyle = CREAM;
    ctx.font = '500 28px "Noto Serif SC", serif';
    const maxWidth = WIDTH - 260;
    const truncated = truncateToWidth(ctx, text, maxWidth);
    ctx.fillText(truncated, 168, y + 52);
  });

  // ===== 丞相总批 =====
  const pmY = highlightTop + highlights.length * (highlightHeight + highlightGap) + 60;

  ctx.fillStyle = GOLD;
  ctx.font = 'bold 16px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText('丞相 · 一句评语', 90, pmY);

  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(90, pmY + 12);
  ctx.lineTo(260, pmY + 12);
  ctx.stroke();

  // 引号 +文字
  ctx.fillStyle = GOLD;
  ctx.font = 'italic bold 48px "Noto Serif SC", serif';
  ctx.fillText('「', 90, pmY + 80);

  ctx.fillStyle = CREAM;
  ctx.font = 'italic 30px "Noto Serif SC", serif';
  const pmText = data.primeMinisterVerdict || '朝堂议事 · 留待后续复盘';
  const pmLines = wrapText(ctx, pmText, WIDTH - 220);
  const visibleLines = pmLines.slice(0, 3);
  visibleLines.forEach((line, i) => {
    ctx.fillText(line, 144, pmY + 78 + i * 44);
  });

  // 闭合引号 · 放在最后一行末尾，若文本为空则不画
  if (visibleLines.length > 0) {
    const lastIdx = visibleLines.length - 1;
    const lastLine = visibleLines[lastIdx] ?? '';
    const lastLineY = pmY + 78 + lastIdx * 44;
    ctx.fillStyle = GOLD;
    ctx.font = 'italic bold 48px "Noto Serif SC", serif';
    ctx.measureText(lastLine); // 触发一次度量避免刚切字体后第一次 measure 失真
    const lastLineWidth = ctx.measureText(lastLine).width;
    ctx.fillText('」', Math.min(144 + lastLineWidth + 4, WIDTH - 140), lastLineY);
  }

  // ===== 右下朱红大印 =====
  drawSeal(ctx, WIDTH - 180, HEIGHT - 180, 120, data.verdict ?? '准');

  // ===== 左下底脚 =====
  ctx.fillStyle = MUTED;
  ctx.font = '18px "Noto Serif SC", serif';
  ctx.textAlign = 'left';
  ctx.fillText('朝堂 OS · AI 决策驾驶舱', 90, HEIGHT - 90);

  ctx.fillStyle = GOLD;
  ctx.font = 'bold 16px monospace';
  ctx.fillText('courtos.ai', 90, HEIGHT - 64);

  // ===== 粒子金点装饰 =====
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * WIDTH;
    const y = Math.random() * HEIGHT;
    const r = Math.random() * 2 + 0.5;
    ctx.fillStyle = `rgba(240, 198, 106, ${Math.random() * 0.4 + 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL('image/png');
}

function drawSeal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  verdict: string,
) {
  // 印泥光晕
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size);
  glow.addColorStop(0, `${RED_SEAL}55`);
  glow.addColorStop(1, 'rgba(192,48,48,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);

  // 方印底
  const half = size * 0.45;
  const sealGrad = ctx.createLinearGradient(x - half, y - half, x + half, y + half);
  sealGrad.addColorStop(0, '#DC3A3A');
  sealGrad.addColorStop(1, '#8A1818');
  ctx.fillStyle = sealGrad;
  ctx.fillRect(x - half, y - half, size * 0.9, size * 0.9);

  // 白色细边
  ctx.strokeStyle = '#FFD6D6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - half + 6, y - half + 6, size * 0.9 - 12, size * 0.9 - 12);

  // 印字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 56px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(verdict, x, y + 4);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** 触发下载 */
export function downloadVerdictCard(dataUrl: string, filename = 'courtos-verdict.png') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/** 复制到剪贴板（仅现代浏览器） */
export async function copyVerdictCardToClipboard(dataUrl: string): Promise<boolean> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
