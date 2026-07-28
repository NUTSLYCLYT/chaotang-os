import { requireUser } from "../../lib/requireUser";

import { StudyClient } from "./StudyClient";

export default async function StudyPage() {
  const user = await requireUser("/study");
  return <StudyClient userId={user.id} />;
}
