import { requireUser } from "../../lib/requireUser";

import { StudyClient } from "./StudyClient";

export default async function StudyPage() {
  await requireUser("/study");
  return <StudyClient />;
}
