import { requireUser } from "../../lib/requireUser";

import { ShiguanClient } from "./ShiguanClient";

export default async function ShiguanPage() {
  await requireUser("/shiguan");
  return <ShiguanClient />;
}
