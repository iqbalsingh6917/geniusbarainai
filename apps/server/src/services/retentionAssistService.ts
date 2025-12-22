import prisma from '../prismaClient';

export type RetentionSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type RetentionSignal = {
  code: string;
  severity: RetentionSeverity;
  title: string;
  description: string;
  evidence: Record<string, number | string | null>;
  reasons: string[];
  suggestedAction: string;
  studentId?: number;
  studentName?: string;
  draftMessageTeacherToParent?: string;
  draftMessageTeacherToStudent?: string;
};

export type RetentionSignalsResponse = {
  items: RetentionSignal[];
  total: number;
  limit: number;
  offset: number;
  summary: {
    totalSignals: number;
    bySeverity: Record<RetentionSeverity, number>;
    byCode: Record<string, number>;
  };
};

export type StudentInsight = {
  code: string;
  title: string;
  description: string;
  suggestedAction: string;
};

export const RETENTION_RULES = {
  inactivityWarnDays: 7,
  inactivityCriticalDays: 14,
  performanceDropPoints: 20,
  lowAccuracyThreshold: 60,
  lowAccuracyAttempts: 3,
  performanceDropAttempts: 3,
  retryLookbackAttempts: 10,
  retryAverageThreshold: 2,
  overdueReviewInfoDays: 3,
  overdueReviewWarnDays: 7,
} as const;

const toNumber = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0));

const daysBetween = (now: Date, past?: Date | null) => {
  if (!past) return null;
  const diffMs = now.getTime() - past.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const formatStudentName = (firstName?: string | null, lastName?: string | null) =>
  [firstName, lastName].filter(Boolean).join(' ').trim();

type AttemptRow = {
  studentId: number;
  worksheetId: number;
  submittedAt: Date | null;
  createdAt: Date;
  totalScore: number | null;
  maxScore: number | null;
  teacherAdjustedScore: number | null;
  status: string;
};

const attemptDate = (row: AttemptRow) => row.submittedAt ?? row.createdAt;

const scorePercent = (row: AttemptRow) => {
  const maxScore = row.maxScore ?? 0;
  const rawScore = row.teacherAdjustedScore ?? row.totalScore;
  if (!maxScore || rawScore == null) return null;
  return Math.round((rawScore / maxScore) * 100);
};

const scoreAttempts = (attempts: AttemptRow[]) =>
  attempts
    .map((attempt) => ({ percent: scorePercent(attempt), date: attemptDate(attempt) }))
    .filter((row): row is { percent: number; date: Date } => row.percent !== null);

const buildDrafts = (studentName: string, code: string) => {
  const name = studentName || 'your child';
  switch (code) {
    case 'INACTIVITY_RISK':
      return {
        draftMessageTeacherToParent: `Hi, we noticed ${name} hasn’t completed a worksheet recently. A short practice session this week would help keep momentum.`,
        draftMessageTeacherToStudent: `Hi ${studentName || ''}! Let’s complete one worksheet this week to keep your rhythm going.`,
      };
    case 'PERFORMANCE_DROP':
      return {
        draftMessageTeacherToParent: `Recent worksheet scores for ${name} dipped compared to the previous set. A quick review session should help.`,
        draftMessageTeacherToStudent: `Your recent scores dipped a bit. Let’s review the last worksheet together and try again.`,
      };
    case 'LOW_ACCURACY_STREAK':
      return {
        draftMessageTeacherToParent: `${name} has had a few worksheets below the target accuracy. We’ll focus on fundamentals this week.`,
        draftMessageTeacherToStudent: `Let’s slow down and focus on accuracy in the next worksheet.`,
      };
    case 'HIGH_RETRY_PATTERN':
      return {
        draftMessageTeacherToParent: `${name} is retrying worksheets multiple times. We’ll work on accuracy and confidence.`,
        draftMessageTeacherToStudent: `Try reviewing the steps carefully before reattempting. Quality over speed helps.`,
      };
    default:
      return {};
  }
};

const computeStudentSignals = (params: {
  studentId: number;
  studentName: string;
  attempts: AttemptRow[];
  now: Date;
  includeDrafts: boolean;
}): RetentionSignal[] => {
  const { studentId, studentName, attempts, now, includeDrafts } = params;
  const signals: RetentionSignal[] = [];

  const lastAttempt = attempts[0];
  const lastAttemptAt = lastAttempt ? attemptDate(lastAttempt) : null;
  const daysSince = daysBetween(now, lastAttemptAt);

  if (daysSince === null || daysSince >= RETENTION_RULES.inactivityWarnDays) {
    const severity: RetentionSeverity =
      daysSince === null || daysSince >= RETENTION_RULES.inactivityCriticalDays ? 'CRITICAL' : 'WARN';
    const reason = daysSince === null ? 'No worksheet attempts logged yet.' : `No worksheet attempts in ${daysSince} days.`;
    const drafts = includeDrafts ? buildDrafts(studentName, 'INACTIVITY_RISK') : {};
    signals.push({
      code: 'INACTIVITY_RISK',
      severity,
      title: 'Inactivity risk',
      description: 'Student has not attempted a worksheet recently.',
      evidence: {
        daysSinceLastAttempt: daysSince,
      },
      reasons: [reason],
      suggestedAction: 'Assign a short worksheet and follow up this week.',
      studentId,
      studentName,
      ...drafts,
    });
  }

  const scored = scoreAttempts(attempts);
  if (scored.length >= RETENTION_RULES.performanceDropAttempts * 2) {
    const last3 = scored.slice(0, RETENTION_RULES.performanceDropAttempts);
    const prev3 = scored.slice(
      RETENTION_RULES.performanceDropAttempts,
      RETENTION_RULES.performanceDropAttempts * 2,
    );
    const lastAvg = Math.round(last3.reduce((sum, row) => sum + row.percent, 0) / last3.length);
    const prevAvg = Math.round(prev3.reduce((sum, row) => sum + row.percent, 0) / prev3.length);
    const dropPoints = prevAvg - lastAvg;
    if (dropPoints >= RETENTION_RULES.performanceDropPoints) {
      const drafts = includeDrafts ? buildDrafts(studentName, 'PERFORMANCE_DROP') : {};
      signals.push({
        code: 'PERFORMANCE_DROP',
        severity: 'WARN',
        title: 'Performance drop',
        description: 'Recent worksheet scores are lower than the previous set.',
        evidence: {
          last3Avg: lastAvg,
          prev3Avg: prevAvg,
          dropPoints,
        },
        reasons: [`Recent average dropped ${dropPoints} points.`],
        suggestedAction: 'Review recent mistakes and assign a focused worksheet.',
        studentId,
        studentName,
        ...drafts,
      });
    }
  }

  if (scored.length >= RETENTION_RULES.lowAccuracyAttempts) {
    const last3 = scored.slice(0, RETENTION_RULES.lowAccuracyAttempts);
    const lastAvg = Math.round(last3.reduce((sum, row) => sum + row.percent, 0) / last3.length);
    if (lastAvg < RETENTION_RULES.lowAccuracyThreshold) {
      const drafts = includeDrafts ? buildDrafts(studentName, 'LOW_ACCURACY_STREAK') : {};
      signals.push({
        code: 'LOW_ACCURACY_STREAK',
        severity: 'WARN',
        title: 'Low accuracy streak',
        description: 'Recent worksheet accuracy is below target.',
        evidence: {
          last3Avg: lastAvg,
        },
        reasons: [`Average accuracy is ${lastAvg}%.`],
        suggestedAction: 'Revisit fundamentals and assign a simpler worksheet.',
        studentId,
        studentName,
        ...drafts,
      });
    }
  }

  if (attempts.length >= RETENTION_RULES.retryLookbackAttempts) {
    const lastAttempts = attempts.slice(0, RETENTION_RULES.retryLookbackAttempts);
    const worksheetIds = new Set(lastAttempts.map((row) => row.worksheetId));
    const averageRetries =
      worksheetIds.size > 0 ? Number((lastAttempts.length / worksheetIds.size).toFixed(2)) : 0;
    if (averageRetries > RETENTION_RULES.retryAverageThreshold) {
      const drafts = includeDrafts ? buildDrafts(studentName, 'HIGH_RETRY_PATTERN') : {};
      signals.push({
        code: 'HIGH_RETRY_PATTERN',
        severity: 'INFO',
        title: 'High retry pattern',
        description: 'Student is retrying worksheets frequently.',
        evidence: {
          attemptsConsidered: lastAttempts.length,
          uniqueWorksheets: worksheetIds.size,
          avgAttemptsPerWorksheet: averageRetries,
        },
        reasons: [`Average ${averageRetries} attempts per worksheet.`],
        suggestedAction: 'Coach accuracy and review concepts before reattempts.',
        studentId,
        studentName,
        ...drafts,
      });
    }
  }

  return signals;
};

const buildSummary = (signals: RetentionSignal[]) => {
  const bySeverity: Record<RetentionSeverity, number> = {
    INFO: 0,
    WARN: 0,
    CRITICAL: 0,
  };
  const byCode: Record<string, number> = {};
  signals.forEach((signal) => {
    bySeverity[signal.severity] += 1;
    byCode[signal.code] = (byCode[signal.code] ?? 0) + 1;
  });
  return {
    totalSignals: signals.length,
    bySeverity,
    byCode,
  };
};

const severityOrder: Record<RetentionSeverity, number> = {
  CRITICAL: 0,
  WARN: 1,
  INFO: 2,
};

const sortSignals = (signals: RetentionSignal[]) =>
  signals.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return (a.studentName || '').localeCompare(b.studentName || '');
  });

async function getAttemptsForStudents(studentIds: number[], limit: number): Promise<AttemptRow[]> {
  if (!studentIds.length) return [];
  const rows: AttemptRow[] = await prisma.$queryRawUnsafe(
    `
      SELECT "studentId", "worksheetId", "submittedAt", "createdAt", "totalScore", "maxScore", "teacherAdjustedScore", "status"
      FROM (
        SELECT swa.*,
               ROW_NUMBER() OVER (
                 PARTITION BY swa."studentId"
                 ORDER BY COALESCE(swa."submittedAt", swa."createdAt") DESC
               ) as rn
        FROM "StudentWorksheetAttempt" swa
        WHERE swa."studentId" = ANY($1)
      ) swa
      WHERE swa.rn <= $2
    `,
    studentIds,
    limit,
  );
  return rows;
}

export async function getTeacherAssistSignals(params: {
  teacherId: number;
  windowDays: number;
  limit: number;
  offset: number;
  now?: Date;
}): Promise<RetentionSignalsResponse> {
  const now = params.now ?? new Date();
  const assignments = await prisma.teacherStudentAssignment.findMany({
    where: { teacherUserId: params.teacherId },
    select: { studentId: true },
  });
  const studentIds = Array.from(new Set(assignments.map((a) => a.studentId))).filter(Boolean);
  if (!studentIds.length) {
    return { items: [], total: 0, limit: params.limit, offset: params.offset, summary: buildSummary([]) };
  }

  const enrollments = await prisma.abacusEnrollment.findMany({
    where: { studentId: { in: studentIds }, status: 'ONGOING' },
    select: { studentId: true },
  });
  const activeStudentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
  if (!activeStudentIds.length) {
    return { items: [], total: 0, limit: params.limit, offset: params.offset, summary: buildSummary([]) };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: activeStudentIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(
    students.map((student) => [student.id, formatStudentName(student.firstName, student.lastName)]),
  );

  const attempts = await getAttemptsForStudents(activeStudentIds, RETENTION_RULES.retryLookbackAttempts);
  const attemptsByStudent = new Map<number, AttemptRow[]>();
  attempts.forEach((row) => {
    const list = attemptsByStudent.get(row.studentId) ?? [];
    list.push(row);
    attemptsByStudent.set(row.studentId, list);
  });

  const signals: RetentionSignal[] = [];
  activeStudentIds.forEach((studentId) => {
    const studentName = studentMap.get(studentId) ?? 'Student';
    const studentAttempts = attemptsByStudent.get(studentId) ?? [];
    signals.push(
      ...computeStudentSignals({
        studentId,
        studentName,
        attempts: studentAttempts,
        now,
        includeDrafts: true,
      }),
    );
  });

  const pendingReviews: Array<{ count: number; oldest: Date | null }> = await prisma.$queryRaw`
    SELECT COUNT(*)::int as "count", MIN(swa."submittedAt") as "oldest"
    FROM "StudentWorksheetAttempt" swa
    JOIN "TeacherStudentAssignment" tsa
      ON tsa."studentId" = swa."studentId"
     AND tsa."teacherUserId" = ${params.teacherId}
    WHERE swa."status" = 'SUBMITTED'
      AND swa."reviewedAt" IS NULL
      AND swa."submittedAt" IS NOT NULL
  `;

  const pendingCount = pendingReviews[0]?.count ?? 0;
  const oldestDate = pendingReviews[0]?.oldest ?? null;
  const oldestDays = daysBetween(now, oldestDate);
  if (pendingCount > 0 && oldestDays !== null && oldestDays >= RETENTION_RULES.overdueReviewInfoDays) {
    const severity: RetentionSeverity =
      oldestDays >= RETENTION_RULES.overdueReviewWarnDays ? 'WARN' : 'INFO';
    signals.push({
      code: 'OVERDUE_REVIEW',
      severity,
      title: 'Pending reviews',
      description: 'Worksheet reviews have been pending for several days.',
      evidence: { pendingCount, oldestPendingDays: oldestDays },
      reasons: [`${pendingCount} submissions awaiting review; oldest is ${oldestDays} days.`],
      suggestedAction: 'Prioritize pending reviews and clear the backlog.',
    });
  }

  const sorted = sortSignals(signals);
  const total = sorted.length;
  const paged = sorted.slice(params.offset, params.offset + params.limit);
  return {
    items: paged,
    total,
    limit: params.limit,
    offset: params.offset,
    summary: buildSummary(sorted),
  };
}

export async function getCenterAssistSignals(params: {
  orgUnitIds: number[];
  windowDays: number;
  limit: number;
  offset: number;
  now?: Date;
}): Promise<RetentionSignalsResponse> {
  const now = params.now ?? new Date();
  if (!params.orgUnitIds.length) {
    return { items: [], total: 0, limit: params.limit, offset: params.offset, summary: buildSummary([]) };
  }

  const enrollments = await prisma.abacusEnrollment.findMany({
    where: { orgUnitId: { in: params.orgUnitIds }, status: 'ONGOING' },
    select: { studentId: true },
  });
  const activeStudentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));
  if (!activeStudentIds.length) {
    return { items: [], total: 0, limit: params.limit, offset: params.offset, summary: buildSummary([]) };
  }

  const students = await prisma.student.findMany({
    where: { id: { in: activeStudentIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const studentMap = new Map(
    students.map((student) => [student.id, formatStudentName(student.firstName, student.lastName)]),
  );

  const attempts = await getAttemptsForStudents(activeStudentIds, RETENTION_RULES.retryLookbackAttempts);
  const attemptsByStudent = new Map<number, AttemptRow[]>();
  attempts.forEach((row) => {
    const list = attemptsByStudent.get(row.studentId) ?? [];
    list.push(row);
    attemptsByStudent.set(row.studentId, list);
  });

  const signals: RetentionSignal[] = [];
  activeStudentIds.forEach((studentId) => {
    const studentName = studentMap.get(studentId) ?? 'Student';
    const studentAttempts = attemptsByStudent.get(studentId) ?? [];
    signals.push(
      ...computeStudentSignals({
        studentId,
        studentName,
        attempts: studentAttempts,
        now,
        includeDrafts: false,
      }),
    );
  });

  const pendingReviews: Array<{ count: number; oldest: Date | null }> = await prisma.$queryRawUnsafe(
    `
      SELECT COUNT(*)::int as "count", MIN(swa."submittedAt") as "oldest"
      FROM "StudentWorksheetAttempt" swa
      JOIN "Student" s ON s."id" = swa."studentId"
      WHERE s."orgUnitId" = ANY($1)
        AND swa."status" = 'SUBMITTED'
        AND swa."reviewedAt" IS NULL
        AND swa."submittedAt" IS NOT NULL
    `,
    params.orgUnitIds,
  );

  const pendingCount = pendingReviews[0]?.count ?? 0;
  const oldestDate = pendingReviews[0]?.oldest ?? null;
  const oldestDays = daysBetween(now, oldestDate);
  if (pendingCount > 0 && oldestDays !== null && oldestDays >= RETENTION_RULES.overdueReviewInfoDays) {
    const severity: RetentionSeverity =
      oldestDays >= RETENTION_RULES.overdueReviewWarnDays ? 'WARN' : 'INFO';
    signals.push({
      code: 'OVERDUE_REVIEW',
      severity,
      title: 'Pending reviews',
      description: 'Worksheet reviews have been pending for several days.',
      evidence: { pendingCount, oldestPendingDays: oldestDays },
      reasons: [`${pendingCount} submissions awaiting review; oldest is ${oldestDays} days.`],
      suggestedAction: 'Coordinate with teachers to clear pending reviews.',
    });
  }

  const sorted = sortSignals(signals);
  const total = sorted.length;
  const paged = sorted.slice(params.offset, params.offset + params.limit);
  return {
    items: paged,
    total,
    limit: params.limit,
    offset: params.offset,
    summary: buildSummary(sorted),
  };
}

export async function getStudentInsights(params: { studentId: number; windowDays: number; now?: Date }) {
  const now = params.now ?? new Date();
  const enrollments = await prisma.abacusEnrollment.findMany({
    where: { studentId: params.studentId, status: 'ONGOING' },
    select: { studentId: true },
  });
  if (!enrollments.length) {
    return { windowDays: params.windowDays, insights: [] as StudentInsight[] };
  }

  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { id: true, firstName: true, lastName: true },
  });
  const studentName = student ? formatStudentName(student.firstName, student.lastName) : 'Student';

  const attempts = await getAttemptsForStudents([params.studentId], RETENTION_RULES.retryLookbackAttempts);
  const signals = computeStudentSignals({
    studentId: params.studentId,
    studentName,
    attempts,
    now,
    includeDrafts: false,
  });

  const insightsMap: Record<string, StudentInsight> = {
    INACTIVITY_RISK: {
      code: 'INACTIVITY_RISK',
      title: 'Keep your practice streak',
      description: 'A short worksheet this week will help you stay on track.',
      suggestedAction: 'Complete one worksheet this week.',
    },
    PERFORMANCE_DROP: {
      code: 'PERFORMANCE_DROP',
      title: 'Refresher recommended',
      description: 'Your recent scores dipped slightly compared to earlier attempts.',
      suggestedAction: 'Review the last worksheet and try again.',
    },
    LOW_ACCURACY_STREAK: {
      code: 'LOW_ACCURACY_STREAK',
      title: 'Accuracy boost',
      description: 'Let’s focus on accuracy before moving faster.',
      suggestedAction: 'Revisit the last module and practice slowly.',
    },
    HIGH_RETRY_PATTERN: {
      code: 'HIGH_RETRY_PATTERN',
      title: 'Quality over retries',
      description: 'Take a moment to review steps before reattempting.',
      suggestedAction: 'Pause and check each step before submitting.',
    },
  };

  const sorted = sortSignals(signals).filter((signal) => signal.code in insightsMap);
  const insights = sorted.slice(0, 3).map((signal) => insightsMap[signal.code]);
  return { windowDays: params.windowDays, insights };
}
