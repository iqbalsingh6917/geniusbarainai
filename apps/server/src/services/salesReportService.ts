import prisma from '../prismaClient';
import { Prisma } from '@prisma/client';

export interface SalesFilter {
  from: Date;
  to: Date;
  courseCode?: string;
  groupBy?: 'BP' | 'FRANCHISE' | 'CENTER';
}

export interface LeadStageSummary {
  new: number;
  contacted: number;
  trialBooked: number;
  trialDone: number;
  converted: number;
  lost: number;
}

export interface LeadBreakdownRow extends LeadStageSummary {
  orgUnitId: number;
  orgUnitName: string;
  orgUnitType: string;
}

type LeadStageKey = keyof LeadStageSummary;

function mapStudentStatusToStage(status?: string | null): LeadStageKey {
  const normalized = status?.toUpperCase?.() ?? 'NEW';

  if (normalized === 'ACTIVE' || normalized === 'ONGOING') {
    return 'converted';
  }

  if (normalized === 'INACTIVE' || normalized === 'DROPPED' || normalized === 'CANCELLED') {
    return 'lost';
  }

  return 'new';
}

function baseLeadSummary(): LeadStageSummary {
  return {
    new: 0,
    contacted: 0,
    trialBooked: 0,
    trialDone: 0,
    converted: 0,
    lost: 0,
  };
}

export async function getGlobalLeadSummary(filter: SalesFilter): Promise<LeadStageSummary> {
  const where: Prisma.StudentWhereInput = {
    createdAt: {
      gte: filter.from,
      lte: filter.to,
    },
  };

  if (filter.courseCode) {
    where.enrollments = {
      some: {
        course: {
          code: filter.courseCode,
        },
      },
    };
  }

  const students = await prisma.student.findMany({
    where,
    select: {
      status: true,
    },
  });

  const summary = baseLeadSummary();

  for (const student of students) {
    const stage = mapStudentStatusToStage(student.status);
    summary[stage] += 1;
  }

  return summary;
}

export async function getLeadBreakdownByOrg(filter: SalesFilter): Promise<LeadBreakdownRow[]> {
  const where: Prisma.StudentWhereInput = {
    createdAt: {
      gte: filter.from,
      lte: filter.to,
    },
  };

  if (filter.courseCode) {
    where.enrollments = {
      some: {
        course: {
          code: filter.courseCode,
        },
      },
    };
  }

  const students = await prisma.student.findMany({
    where,
    select: {
      status: true,
      orgUnitId: true,
      orgUnit: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  const map = new Map<number, LeadBreakdownRow>();

  for (const student of students) {
    if (!student.orgUnit) continue;
    const key = student.orgUnit.id;

    if (!map.has(key)) {
      map.set(key, {
        orgUnitId: student.orgUnit.id,
        orgUnitName: student.orgUnit.name,
        orgUnitType: student.orgUnit.type,
        ...baseLeadSummary(),
      });
    }

    const row = map.get(key)!;
    const stage = mapStudentStatusToStage(student.status);
    row[stage] += 1;
  }

  return Array.from(map.values());
}
