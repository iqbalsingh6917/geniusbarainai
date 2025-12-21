import prisma from '../../prismaClient';
import { SeatAllocationError } from './seatAllocationErrors';

interface CreateSeatAllocationInput {
  parentOrgUnitId: number; // BP
  childOrgUnitId: number; // Franchise / Center
  courseCode: string;
  seats: number;
  actorUserId?: number | null;
}

export async function allocateSeats(input: CreateSeatAllocationInput) {
  const { parentOrgUnitId, childOrgUnitId, courseCode, seats, actorUserId = null } = input;

  if (seats <= 0) throw new SeatAllocationError('INVALID_SEAT_COUNT');

  return prisma.$transaction(async (tx) => {
    const now = new Date();

    // 1) Parent license must exist
    const license = await tx.courseLicense.findFirst({
      where: {
        orgUnitId: parentOrgUnitId,
        courseCode,
        AND: [
          {
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          },
          {
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
        ],
      },
    });

    if (!license) {
      throw new SeatAllocationError('NO_ACTIVE_LICENSE');
    }

    // 2) Remaining seats = total - used - already allocated out
    const allocatedAgg = await tx.licenseAllocation.aggregate({
      where: { parentOrgUnitId, courseCode },
      _sum: { allocatedSeats: true },
    });
    const alreadyAllocated = allocatedAgg._sum.allocatedSeats ?? 0;
    const remaining = license.totalSeats - (license.usedSeats ?? 0) - alreadyAllocated;

    if (seats > remaining) {
      throw new SeatAllocationError('INSUFFICIENT_SEATS', { remaining, requested: seats });
    }

    // 3) Create allocation
    const allocation = await tx.licenseAllocation.create({
      data: {
        parentOrgUnitId,
        childOrgUnitId,
        courseCode,
        allocatedSeats: seats,
      },
    });

    // 4) Ensure child license exists and increment seats
    await tx.courseLicense.upsert({
      where: { orgUnitId_courseCode: { orgUnitId: childOrgUnitId, courseCode } },
      create: { orgUnitId: childOrgUnitId, courseCode, totalSeats: seats, usedSeats: 0 },
      update: { totalSeats: { increment: seats } },
    });

    // 5) Optional audit log
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        orgUnitId: parentOrgUnitId,
        action: 'SEAT_ALLOCATION_CREATE',
        entityType: 'LicenseAllocation',
        entityId: allocation.id,
        meta: {
          childOrgUnitId,
          courseCode,
          seats,
        },
      },
    });

    return allocation;
  });
}
