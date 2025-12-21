import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get all descendant org units recursively
 * @param rootOrgUnitId The root org unit ID
 * @returns Array of org unit IDs including the root and all descendants
 */
export async function getDescendantOrgUnits(rootOrgUnitId: number): Promise<number[]> {
  const descendants: number[] = [rootOrgUnitId];
  
  // Get direct children using raw query
  const children: any = await prisma.$queryRaw`
    SELECT "id" FROM "OrgUnit" WHERE "parentId" = ${rootOrgUnitId}
  `;
  
  // Recursively get descendants for each child
  for (const child of children) {
    const childDescendants = await getDescendantOrgUnits(child.id);
    descendants.push(...childDescendants);
  }
  
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
export async function getAllowedOrgUnitsForUser(userRole: string, userOrgUnitId: number | null): Promise<number[]> {
  // SUPERADMIN can access everything
  if (userRole === 'SUPERADMIN') {
    // Get all org units using raw query
    const allOrgUnits: any = await prisma.$queryRaw`
      SELECT "id" FROM "OrgUnit"
    `;
    return allOrgUnits.map((org: { id: number }) => org.id);
  }
  
  // For other roles, get descendant org units if user has an org unit
  if (userOrgUnitId) {
    return await getDescendantOrgUnits(userOrgUnitId);
  }
  
  // If user has no org unit, they can't access anything
  return [];
}