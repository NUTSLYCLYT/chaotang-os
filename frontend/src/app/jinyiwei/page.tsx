import { redirect } from "next/navigation";

import { requireUser } from "../../lib/requireUser";
import { redirectLegacyJinyiweiEntry } from "./redirectLegacyEntry";

export default function JinyiweiPage() {
  return redirectLegacyJinyiweiEntry(requireUser, redirect);
}
