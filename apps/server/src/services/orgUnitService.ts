import prisma from '../prismaClient';

export type OrgUnitType = 'SUPERADMIN_ROOT' | 'BUSINESS_PARTNER' | 'FRANCHISE' | 'CENTER';
export type OrgUnitStatus = 'ACTIVE' | 'INACTIVE';

export interface OrgUnitFilter {
  type?: OrgUnitType;
  parentId?: number;
}

export interface OrgUnitInput {
  name: string;
  code: string;
  type: OrgUnitType;
  parentId?: number | null;
  status: OrgUnitStatus;
}

function validateParentChildType(parentType: OrgUnitType | null, childType: OrgUnitType) {
  if (childType === 'BUSINESS_PARTNER') {
    if (parentType !== 'SUPERADMIN_ROOT') {
      throw new Error('BUSINESS_PARTNER must be under SUPERADMIN_ROOT.');
    }
  } else if (childType === 'FRANCHISE') {
    if (parentType !== 'BUSINESS_PARTNER') {
      throw new Error('FRANCHISE must be under BUSINESS_PARTNER.');
    }
  } else if (childType === 'CENTER') {
    if (parentType !== 'FRANCHISE' && parentType !== 'BUSINESS_PARTNER') {
      throw new Error('CENTER must be under FRANCHISE or BUSINESS_PARTNER.');
    }
  }
}

export async function listOrgUnitsForSuperadmin(filter: OrgUnitFilter = {}) {
  const { type, parentId } = filter;
  const where: any = {};
  if (type) where.type = type;
  if (typeof parentId === 'number') where.parentId = parentId;

  return prisma.orgUnit.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });
}

export async function createOrgUnitForSuperadmin(input: OrgUnitInput) {
  const { name, code, type, parentId, status } = input;

  let parentType: OrgUnitType | null = null;

  if (parentId) {
    const parent = await prisma.orgUnit.findUnique({
      where: { id: parentId },
      select: { type: true },
    });

    if (!parent) {
      throw new Error('Parent org unit not found.');
    }

    parentType = parent.type as OrgUnitType;
  }

  if (type !== 'SUPERADMIN_ROOT') {
    if (!parentId) {
      throw new Error('Non-root org units must have a parent.');
    }
    validateParentChildType(parentType, type);
  }

  const orgUnit = await prisma.orgUnit.create({
    data: {
      name,
      code,
      type,
      parentId: parentId ?? null,
      isActive: status === 'ACTIVE',
    },
  });

  return orgUnit;
}

export async function updateOrgUnitForSuperadmin(id: number, input: Partial<OrgUnitInput>) {
  const existing = await prisma.orgUnit.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('Org unit not found.');
  }

  const newType = (input.type ?? existing.type) as OrgUnitType;
  const newParentId = typeof input.parentId === 'undefined' ? existing.parentId : input.parentId;

  let parentType: OrgUnitType | null = null;

  if (newType !== 'SUPERADMIN_ROOT') {
    if (!newParentId) {
      throw new Error('Non-root org units must have a parent.');
    }

    const parent = await prisma.orgUnit.findUnique({
      where: { id: newParentId },
      select: { type: true },
    });

    if (!parent) {
      throw new Error('Parent org unit not found.');
    }

    parentType = parent.type as OrgUnitType;
    validateParentChildType(parentType, newType);
  }

  const updated = await prisma.orgUnit.update({
    where: { id },
    data: {
      name: input.name ?? existing.name,
      code: input.code ?? existing.code,
      type: newType,
      parentId: newParentId ?? null,
      isActive: typeof input.status === 'undefined' ? existing.isActive : input.status === 'ACTIVE',
    },
  });

  return updated;
}
