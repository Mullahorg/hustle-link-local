import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Permission = Database["public"]["Enums"]["app_permission"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type ReportStatus = Database["public"]["Enums"]["report_status"];

export const ADMIN_PAGE = 20;

/** Staff roles, in descending order of reach. `user` is a member, not staff. */
export const STAFF_ROLES: { role: AppRole; label: string; blurb: string }[] = [
  { role: "super_admin", label: "Super Admin", blurb: "Full control, including permissions" },
  { role: "admin", label: "Administrator", blurb: "Everything except changing roles" },
  { role: "moderator", label: "Moderator", blurb: "Jobs, reports, reviews, messages" },
  { role: "support_agent", label: "Support Agent", blurb: "Read-only help desk + notifications" },
  { role: "verification_officer", label: "Verification Officer", blurb: "ID verification queue" },
  { role: "content_moderator", label: "Content Moderator", blurb: "Job and review content" },
  { role: "analyst", label: "Read-only Analyst", blurb: "Analytics and read-only data" },
];

export const PERMISSION_GROUPS: { group: string; permissions: Permission[] }[] = [
  { group: "User management", permissions: ["users.read", "users.write"] },
  { group: "Role management", permissions: ["roles.read", "roles.write"] },
  { group: "Verification", permissions: ["verification.read", "verification.write"] },
  { group: "Jobs", permissions: ["jobs.read", "jobs.write"] },
  { group: "Applications", permissions: ["applications.read", "applications.write"] },
  { group: "Workers", permissions: ["workers.read", "workers.write"] },
  { group: "Employers", permissions: ["employers.read", "employers.write"] },
  { group: "Messages", permissions: ["messages.read", "messages.moderate"] },
  { group: "Reports", permissions: ["reports.read", "reports.write"] },
  { group: "Reviews", permissions: ["reviews.read", "reviews.write"] },
  { group: "Notifications", permissions: ["notifications.read", "notifications.write"] },
  { group: "Categories", permissions: ["categories.read", "categories.write"] },
  { group: "System settings", permissions: ["settings.read", "settings.write"] },
  { group: "Payments", permissions: ["payments.read", "payments.write"] },
  { group: "Analytics", permissions: ["analytics.read"] },
  { group: "Audit logs", permissions: ["audit.read"] },
];

export const roleLabel = (role: AppRole) =>
  STAFF_ROLES.find((r) => r.role === role)?.label ?? "Member";

/* ------------------------------------------------------------------ reads */

export const myPermissionsQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-permissions", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<Permission[]> => {
      const { data, error } = await supabase.rpc("my_permissions");
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.permission);
    },
  });

export const myRolesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-roles", userId],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.role);
    },
  });

export const superAdminExistsQuery = () =>
  queryOptions({
    queryKey: ["super-admin-exists"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_exists");
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
  });

export type AdminStats = {
  total_users: number;
  verified_users: number;
  suspended_users: number;
  workers: number;
  employers: number;
  jobs_posted: number;
  jobs_open: number;
  jobs_completed: number;
  jobs_hidden: number;
  applications: number;
  messages: number;
  reports: number;
  reports_open: number;
  reviews: number;
  verification_pending: number;
  verification_requests: number;
  payments_total: number;
  payments_succeeded: number;
  payments_volume_cents: number;
  dau: number;
  mau: number;
  new_users_7d: number;
  new_jobs_7d: number;
  signups_trend: { day: string; count: number }[];
  jobs_trend: { day: string; count: number }[];
};

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: ["admin-stats"],
    staleTime: 30_000,
    queryFn: async (): Promise<AdminStats> => {
      const { data, error } = await supabase.rpc("admin_stats");
      if (error) throw new Error(error.message);
      return data as unknown as AdminStats;
    },
  });

export type ListArgs = {
  table: string;
  columns?: string;
  page: number;
  pageSize?: number;
  sort?: string;
  ascending?: boolean;
  /** ILIKE search across these columns. */
  searchColumns?: string[];
  q?: string;
  /** Exact-match filters; undefined/"" values are ignored. */
  eq?: Record<string, string | boolean | number | undefined>;
  /** `is null` / `not null` filters. */
  nullish?: Record<string, "null" | "notnull" | undefined>;
  enabled?: boolean;
};

export type ListResult<T> = { rows: T[]; total: number };

/**
 * One paginated, filtered, sorted table read used by every admin list.
 * RLS decides what actually comes back, so an under-privileged staff member
 * simply sees an empty table rather than a leak.
 */
export const adminListQuery = <T,>(args: ListArgs) =>
  queryOptions({
    queryKey: ["admin-list", args.table, args.columns ?? "*", args.page, args.pageSize ?? ADMIN_PAGE, args.sort ?? "", args.ascending ?? false, args.q ?? "", args.searchColumns?.join(",") ?? "", JSON.stringify(args.eq ?? {}), JSON.stringify(args.nullish ?? {})],
    enabled: args.enabled ?? true,
    staleTime: 15_000,
    queryFn: async (): Promise<ListResult<T>> => {
      const size = args.pageSize ?? ADMIN_PAGE;
      const from = args.page * size;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = (supabase as any)
        .from(args.table)
        .select(args.columns ?? "*", { count: "exact" });

      for (const [col, value] of Object.entries(args.eq ?? {})) {
        if (value === undefined || value === "") continue;
        query = query.eq(col, value);
      }
      for (const [col, mode] of Object.entries(args.nullish ?? {})) {
        if (!mode) continue;
        query = mode === "null" ? query.is(col, null) : query.not(col, "is", null);
      }
      const term = args.q?.trim();
      if (term && args.searchColumns?.length) {
        const escaped = term.replace(/[%,()]/g, " ");
        query = query.or(args.searchColumns.map((c) => `${c}.ilike.%${escaped}%`).join(","));
      }
      if (args.sort) query = query.order(args.sort, { ascending: args.ascending ?? false });
      query = query.range(from, from + size - 1);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as T[], total: count ?? 0 };
    },
  });

/* -------------------------------------------------------------- mutations */

const rpc = async (fn: string, args: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

export const claimSuperAdmin = () => rpc("claim_super_admin", {});

export const setRole = (userId: string, role: AppRole, grant: boolean) =>
  rpc("admin_set_role", { _user_id: userId, _role: role, _grant: grant });

export const setRolePermission = (role: AppRole, permission: Permission, enabled: boolean) =>
  rpc("admin_set_role_permission", { _role: role, _permission: permission, _enabled: enabled });

export const setSuspension = (userId: string, suspended: boolean, reason?: string) =>
  rpc("admin_set_suspension", { _user_id: userId, _suspended: suspended, _reason: reason ?? null });

export const setJobHidden = (jobId: string, hidden: boolean, reason?: string) =>
  rpc("admin_set_job_hidden", { _job_id: jobId, _hidden: hidden, _reason: reason ?? null });

export const reviewVerification = (id: string, status: VerificationStatus, notes?: string) =>
  rpc("admin_review_verification", { _id: id, _status: status, _notes: notes ?? null });

export const updateReport = (id: string, status: ReportStatus, notes?: string) =>
  rpc("admin_update_report", { _id: id, _status: status, _notes: notes ?? null });

export const deleteReview = (id: string, reason?: string) =>
  rpc("admin_delete_review", { _id: id, _reason: reason ?? null });

export const upsertCategory = (slug: string, name: string, icon: string, sortOrder: number) =>
  rpc("admin_upsert_category", { _slug: slug, _name: name, _icon: icon, _sort_order: sortOrder });

export const deleteCategory = (slug: string) => rpc("admin_delete_category", { _slug: slug });

export const sendNotification = (userId: string, title: string, body: string, link?: string) =>
  rpc("admin_send_notification", { _user_id: userId, _title: title, _body: body, _link: link ?? null });

export const setSetting = (key: string, value: unknown) =>
  rpc("admin_set_setting", { _key: key, _value: value });
