export interface ReplyCaseView {
  id: string;
  title: string;
  departments: string[];
  process: string;
  conclusion: string;
  repliedAt: string;
  respondent: string;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(hasText)
  );
}

export function toReplyCaseView(archive: unknown): ReplyCaseView | null {
  if (
    !isRecord(archive) ||
    archive.type !== "REPLY" ||
    !hasText(archive.id) ||
    !hasText(archive.title) ||
    !isNonEmptyStringArray(archive.participatingDepartments) ||
    !hasText(archive.replyProcess) ||
    !hasText(archive.replyConclusion) ||
    !hasText(archive.replyTime) ||
    !hasText(archive.respondent)
  ) {
    return null;
  }

  return {
    id: archive.id,
    title: archive.title,
    departments: [...archive.participatingDepartments],
    process: archive.replyProcess,
    conclusion: archive.replyConclusion,
    repliedAt: archive.replyTime,
    respondent: archive.respondent,
  };
}

export function filterReplyCasesByDepartment(
  cases: ReplyCaseView[],
  department: string,
): ReplyCaseView[] {
  return department
    ? cases.filter((item) => item.departments.includes(department))
    : [...cases];
}
