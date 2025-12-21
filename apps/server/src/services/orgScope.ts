/**
 * Get user's organization context
 * @param user The authenticated user (partial object from JWT)
 * @returns Object containing user's org context
 */
export function getUserOrgContext(user: { id: number; username: string; role: string }) {
  return {
    userId: user.id,
    role: user.role,
    // Note: orgUnitId is not available in the JWT user object
    // It needs to be fetched from the database if needed
  };
}

/**
 * For SUPERADMIN users, allow specifying orgUnitId via query param for debugging
 * For other roles, force orgUnitId from user.orgUnitId
 * @param user The authenticated user (partial object from JWT)
 * @param queryOrgUnitId Optional orgUnitId from query parameters
 * @returns The effective orgUnitId for scoping
 */
export function getEffectiveOrgUnitId(user: { id: number; username: string; role: string }, queryOrgUnitId?: number): number | null {
  // If role is SUPERADMIN and queryOrgUnitId is provided, use it
  if (user.role === 'SUPERADMIN' && queryOrgUnitId) {
    return queryOrgUnitId;
  }
  
  // For all other cases, we don't have orgUnitId in the JWT user object
  // It would need to be fetched from the database
  return null;
}

/**
 * Check if user can access data from a specific org unit
 * @param user The authenticated user (partial object from JWT)
 * @param targetOrgUnitId The org unit ID to check access for
 * @returns True if user can access the org unit data
 */
export async function canAccessOrgUnit(user: { id: number; username: string; role: string }, targetOrgUnitId: number): Promise<boolean> {
  // SUPERADMIN can access all org units
  if (user.role === 'SUPERADMIN') {
    return true;
  }
  
  // For non-SUPERADMIN users, we would need to fetch their orgUnitId from the database
  // For now, we'll just return false for non-SUPERADMIN users
  return false;
}