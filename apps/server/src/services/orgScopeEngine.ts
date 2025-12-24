import prisma from '../prismaClient';
import { isCoordinator, isHeadCoordinator } from '../constants/roles';
import { getRequestCache } from '../utils/requestContext';

/**
 * Get all descendant org units recursively
 * @param rootOrgUnitId The root org unit ID
 * @returns Array of org unit IDs including the root and all descendants
 */
export async function getDescendantOrgUnits(rootOrgUnitId: number): Promise<number[]> {
  const cache = getRequestCache();
  const cacheKey = `descendants:${rootOrgUnitId}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey) as number[];
  }

  const rows: any = await prisma.$queryRaw`
    WITH RECURSIVE org_tree AS (
      SELECT "id", "parentId" FROM "OrgUnit" WHERE "id" = ${rootOrgUnitId}
      UNION ALL
      SELECT ou."id", ou."parentId"
      FROM "OrgUnit" ou
      JOIN org_tree ot ON ou."parentId" = ot."id"
    )
    SELECT "id" FROM org_tree
  `;

  const descendants = (rows || []).map((row: { id: number }) => row.id);
  cache?.set(cacheKey, descendants);
  return descendants;
}

/**
 * Check if a user can access a target org unit
 * @param userOrgUnitId The user's org unit ID
 * @param targetOrgUnitId The target org unit ID to check access for
 * @returns True if user can access the target org unit
 */
export async function canAccessOrgUnit(userOrgUnitId: number, targetOrgUnitId: number): Promise<boolean> {
  // Get all descendant org units of the user's org unit
  const allowedOrgUnits = await getDescendantOrgUnits(userOrgUnitId);
  
  // Check if target org unit is in the allowed list
  return allowedOrgUnits.includes(targetOrgUnitId);
}

/**
 * Enforce org scope access control
 * @param userOrgUnitId The user's org unit ID
 * @param targetOrgUnitId The target org unit ID to check access for
 * @throws 403 error if access is denied
 */
export async function enforceOrgScope(userOrgUnitId: number, targetOrgUnitId: number): Promise<void> {
  const hasAccess = await canAccessOrgUnit(userOrgUnitId, targetOrgUnitId);
  
  if (!hasAccess) {
    throw new Error('Access denied: Insufficient org scope permissions');
  }
}

/**
 * Get allowed org units for a user based on their role
 * @param userRole The user's role
 * @param userOrgUnitId The user's org unit ID
 * @returns Array of allowed org unit IDs
 */
export async function getAllowedOrgUnitsForUser(
  userRole: string,
  userOrgUnitId: number | null,
  userId?: number | null,
): Promise<number[]> {
  const cache = getRequestCache();
  const cacheKey = `allowed:${userRole}:${userOrgUnitId ?? 'none'}:${userId ?? 'none'}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey) as number[];
  }

  // SUPERADMIN can access everything
  if (userRole === 'SUPERADMIN') {
    // Get all org units using raw query
    const allOrgUnits: any = await prisma.$queryRaw`
      SELECT "id" FROM "OrgUnit"
    `;
    const result = allOrgUnits.map((org: { id: number }) => org.id);
    cache?.set(cacheKey, result);
    return result;
  }
  
  if ((isHeadCoordinator(userRole) || isCoordinator(userRole)) && userId) {
    const assignments = await prisma.staffOrgUnitAssignment.findMany({
      where: {
        userId,
        roleType: isHeadCoordinator(userRole) ? 'HEAD_COORDINATOR' : 'COORDINATOR',
      },
      select: { orgUnitId: true },
    });
    const assignedIds = assignments.map((row) => row.orgUnitId);
    if (assignedIds.length > 0) {
      if (userOrgUnitId) {
        assignedIds.push(userOrgUnitId);
      }
      const unique = Array.from(new Set(assignedIds));
      cache?.set(cacheKey, unique);
      return unique;
    }
  }

  // For other roles, get descendant org units if user has an org unit
  if (userOrgUnitId) {
    const result = await getDescendantOrgUnits(userOrgUnitId);
    cache?.set(cacheKey, result);
    return result;
  }
  
  // If user has no org unit, they can't access anything
  cache?.set(cacheKey, []);
  return [];
}
