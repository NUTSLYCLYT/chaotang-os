import {
  getDepartment,
  getOffice,
  type DepartmentDirectoryEntry,
  type OfficeDirectoryEntry,
} from "./departmentDirectory.ts";

export type MinistryRouteResolution =
  | { kind: "overview" }
  | { kind: "department"; department: DepartmentDirectoryEntry }
  | {
      kind: "office";
      department: DepartmentDirectoryEntry;
      office: OfficeDirectoryEntry;
    }
  | { kind: "not-found" };

export function resolveMinistryRoute(): { kind: "overview" };
export function resolveMinistryRoute(
  code: string,
  officeSlug?: string,
): Exclude<MinistryRouteResolution, { kind: "overview" }>;
export function resolveMinistryRoute(
  code?: string,
  officeSlug?: string,
): MinistryRouteResolution {
  if (code === undefined) return { kind: "overview" };
  const department = getDepartment(code);
  if (!department) return { kind: "not-found" };
  if (officeSlug === undefined) return { kind: "department", department };
  const office = getOffice(code, officeSlug);
  return office ? { kind: "office", department, office } : { kind: "not-found" };
}
