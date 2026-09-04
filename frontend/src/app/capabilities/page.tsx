import { CapabilityRegistryClient } from "../../features/capabilities/CapabilityRegistryClient";
import { requireUser } from "../../lib/requireUser";

export default async function CapabilitiesPage() {
  // 能力总账 V1 使用鸿胪寺同一认证边界；页面只读，真实授权另走正式链路。
  await requireUser("/honglusi");
  return <CapabilityRegistryClient />;
}
