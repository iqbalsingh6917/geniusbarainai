import prisma from '../prismaClient';

export type SeatAllocationErrorCode =
  | 'LICENSE_MISSING'
  | 'INSUFFICIENT_SEATS'
  | 'LICENSE_NOT_ACTIVE'
  | 'LICENSE_SEAT_CAPACITY_EXCEEDED'
  | 'NEGATIVE_SEATS_NOT_ALLOWED';

export class SeatAllocationError extends Error {
  code: SeatAllocationErrorCode;

  constructor(code: SeatAllocationErrorCode, message: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, SeatAllocationError.prototype);
  }
}

export async function incrementLicenseSeat(orgUnitId: number, courseCode: string) {
  const now = new Date();
  const license = await prisma.courseLicense.findUnique({
    where: {
      orgUnitId_courseCode: { orgUnitId, courseCode },
    },
  });

  if (!license) {
    throw new SeatAllocationError('LICENSE_MISSING', 'No active license found for org/unit');
  }

  const isActive =
    (!license.validFrom || license.validFrom <= now) &&
    (!license.validTo || license.validTo >= now);
  if (!isActive) {
    throw new SeatAllocationError('LICENSE_NOT_ACTIVE', 'License is not active for allocation');
  }

  const remaining = (license.totalSeats || 0) - (license.usedSeats || 0);
  if (remaining <= 0) {
    throw new SeatAllocationError('LICENSE_SEAT_CAPACITY_EXCEEDED', 'No available seats on license');
  }

  await prisma.courseLicense.update({
    where: {
      orgUnitId_courseCode: { orgUnitId, courseCode },
    },
    data: {
      usedSeats: {
        increment: 1,
      },
    },
  });
}

export async function addSeatsFromPaidOrder(buyerOrgUnitId: number, courseCode: string, seatQuantity: number) {
  if (seatQuantity <= 0) {
    throw new SeatAllocationError('NEGATIVE_SEATS_NOT_ALLOWED', 'Seat quantity must be positive');
  }

  const existing = await prisma.courseLicense.findUnique({
    where: {
      orgUnitId_courseCode: { orgUnitId: buyerOrgUnitId, courseCode },
    },
  });

  if (!existing) {
    await prisma.courseLicense.create({
      data: {
        orgUnitId: buyerOrgUnitId,
        courseCode,
        totalSeats: seatQuantity,
        usedSeats: 0,
      },
    });
    return;
  }

  await prisma.courseLicense.update({
    where: {
      orgUnitId_courseCode: { orgUnitId: buyerOrgUnitId, courseCode },
    },
    data: {
      totalSeats: {
        increment: seatQuantity,
      },
    },
  });
}

export async function getOrgCourseLicense(orgUnitId: number, courseCode: string) {
  return prisma.courseLicense.findUnique({
    where: {
      orgUnitId_courseCode: { orgUnitId, courseCode },
    },
  });
}

export async function allocateSeatsToChild(
  parentOrgUnitId: number,
  childOrgUnitId: number,
  courseCode: string,
  seatCount: number
) {
  if (seatCount <= 0) {
    throw new SeatAllocationError('INSUFFICIENT_SEATS', 'Requested seats must be positive.');
  }

  return prisma.$transaction(async (tx) => {
    // 1) Parent license must exist
    const parentLicense = await tx.courseLicense.findFirst({
      where: {
        orgUnitId: parentOrgUnitId,
        courseCode,
      },
    });

    if (!parentLicense) {
      throw new SeatAllocationError('LICENSE_MISSING', 'No active course license found for the parent org unit.');
    }

    const { totalSeats, usedSeats } = parentLicense;

    // 2) Already allocated out from this parent
    const allocatedOutAgg = await tx.licenseAllocation.aggregate({
      where: {
        parentOrgUnitId,
        courseCode,
      },
      _sum: {
        allocatedSeats: true,
      },
    });

    const alreadyAllocatedOut = allocatedOutAgg._sum.allocatedSeats ?? 0;

    // 3) Remaining seats on parent license
    const remainingSeats = totalSeats - usedSeats - alreadyAllocatedOut;
    if (remainingSeats <= 0 || seatCount > remainingSeats) {
      const message = [
        'Insufficient seats on parent license.',
        `Requested: ${seatCount}`,
        `Remaining: ${remainingSeats < 0 ? 0 : remainingSeats}`,
        `Total: ${totalSeats}`,
        `Used: ${usedSeats}`,
        `Allocated out: ${alreadyAllocatedOut}`,
      ].join(' | ');
      throw new SeatAllocationError('INSUFFICIENT_SEATS', message);
    }

    // 4) Create allocation
    const allocation = await tx.licenseAllocation.create({
      data: {
        parentOrgUnitId,
        childOrgUnitId,
        courseCode,
        allocatedSeats: seatCount,
      },
    });

    // 5) Ensure child license exists and increment totalSeats
    const childLicense = await tx.courseLicense.findUnique({
      where: {
        orgUnitId_courseCode: { orgUnitId: childOrgUnitId, courseCode },
      },
    });

    if (!childLicense) {
      await tx.courseLicense.create({
        data: {
          orgUnitId: childOrgUnitId,
          courseCode,
          totalSeats: seatCount,
          usedSeats: 0,
        },
      });
    } else {
      await tx.courseLicense.update({
        where: {
          orgUnitId_courseCode: { orgUnitId: childOrgUnitId, courseCode },
        },
        data: {
          totalSeats: {
            increment: seatCount,
          },
        },
      });
    }

    return {
      allocation,
      parentLicenseSummary: {
        totalSeats,
        usedSeats,
        alreadyAllocatedOut,
        remainingSeatsAfterAllocation: remainingSeats - seatCount,
      },
    };
  });
}

export async function hasAvailableSeatForEnrollment(orgUnitId: number, courseCode: string): Promise<boolean> {
  const now = new Date();
  const license = await prisma.courseLicense.findUnique({
    where: {
      orgUnitId_courseCode: {
        orgUnitId,
        courseCode,
      },
    },
  });

  // If no license exists, skip enforcement for now
  if (!license) return false;

  const isActive =
    (!license.validFrom || license.validFrom <= now) &&
    (!license.validTo || license.validTo >= now);
  if (!isActive) return false;

  const remaining = (license.totalSeats || 0) - (license.usedSeats || 0);
  return remaining > 0;
}

export async function decrementLicenseSeat(orgUnitId: number, courseCode: string) {
  const license = await prisma.courseLicense.findUnique({
    where: {
      orgUnitId_courseCode: { orgUnitId, courseCode },
    },
  });

  if (!license || license.usedSeats <= 0) {
    return;
  }

  await prisma.courseLicense.update({
    where: {
      orgUnitId_courseCode: { orgUnitId, courseCode },
    },
    data: {
      usedSeats: {
        decrement: 1,
      },
    },
  });
}
