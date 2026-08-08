import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/useAuth";
import { myPermissionsQuery, myRolesQuery, type AppRole, type Permission } from "@/lib/admin";

/**
 * Frontend mirror of the backend permission check. The database is still the
 * authority — this only decides what we bother rendering.
 */
export function usePermissions() {
  const { user, loading } = useAuth();
  const permissions = useQuery(myPermissionsQuery(user?.id));
  const roles = useQuery(myRolesQuery(user?.id));

  const list: Permission[] = permissions.data ?? [];
  const roleList: AppRole[] = roles.data ?? [];

  return {
    userId: user?.id,
    permissions: list,
    roles: roleList,
    isStaff: list.length > 0,
    isSuperAdmin: roleList.includes("super_admin"),
    can: (permission: Permission) => list.includes(permission),
    canAny: (...wanted: Permission[]) => wanted.some((p) => list.includes(p)),
    loading: loading || permissions.isLoading || roles.isLoading,
  };
}
