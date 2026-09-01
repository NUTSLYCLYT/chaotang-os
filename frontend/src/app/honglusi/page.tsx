import { HonglusiScene } from "../../features/honglusi-visual/HonglusiScene";
import { requireUser } from "../../lib/requireUser";

export default async function HonglusiPage() {
  // 鸿胪寺沿用朝堂统一认证边界，不建立第二入口。
  await requireUser("/honglusi");
  return <HonglusiScene />;
}
