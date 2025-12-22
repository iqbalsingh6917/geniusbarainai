import request from 'supertest';
import jwt from 'jsonwebtoken';
import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { prisma } from '@lms/db';
import { createApp } from '../../src';

const app = createApp();

const makeToken = (user: { id: number; role: string; orgUnitId?: number | null; studentId?: number | null }) => {
  const secret = process.env.JWT_SECRET || 'testsecret123456';
  return jwt.sign(
    {
      userId: user.id,
      username: user.role.toLowerCase(),
      role: user.role,
      orgUnitId: user.orgUnitId ?? null,
      studentId: user.studentId ?? null,
    },
    secret,
  );
};

async function resetDb() {
  await prisma.settlement.deleteMany({});
  await prisma.studentWorksheetAttempt.deleteMany({});
  await prisma.teacherStudentAssignment.deleteMany({});
  await prisma.abacusEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.abacusWorksheet.deleteMany({});
  await prisma.abacusLevel.deleteMany({});
  await prisma.abacusModule.deleteMany({});
  await prisma.abacusCourse.deleteMany({});
  await prisma.orgUnit.deleteMany({});
}

async function seedOrgTree() {
  const root = await prisma.orgUnit.create({ data: { code: 'ROOT', name: 'Root', type: 'SUPERADMIN_ROOT' } });
  const center = await prisma.orgUnit.create({
    data: { code: 'CE1', name: 'Center', type: 'CENTER', parentId: root.id },
  });
  return { root, center };
}

async function seedCourseGraph() {
  const course = await prisma.abacusCourse.create({
    data: { code: 'COURSE1', name: 'Course 1', variant: 'REGULAR' },
  });
  const module = await prisma.abacusModule.create({
    data: { courseId: course.id, index: 1, title: 'Module 1' },
  });
  const level = await prisma.abacusLevel.create({
    data: {
      moduleId: module.id,
      order: 1,
      name: 'Level 1',
      difficulty: 'Easy',
      operations: [],
      examDurationMin: 30,
      passingPercent: 60,
    },
  });
  const worksheet = await prisma.abacusWorksheet.create({
    data: { levelId: level.id, title: 'Worksheet 1', kind: 'PRACTICE' },
  });
  return { course, worksheet };
}

describe('Retention assist signals', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('scopes teacher signals and includes inactivity + overdue review', async () => {
    const orgs = await seedOrgTree();
    const { course, worksheet } = await seedCourseGraph();

    const student1 = await prisma.student.create({
      data: { code: 'ST1', firstName: 'A', lastName: 'One', status: 'ACTIVE', orgUnitId: orgs.center.id },
    });
    const student2 = await prisma.student.create({
      data: { code: 'ST2', firstName: 'B', lastName: 'Two', status: 'ACTIVE', orgUnitId: orgs.center.id },
    });

    const enrollment1 = await prisma.abacusEnrollment.create({
      data: { studentId: student1.id, courseId: course.id, status: 'ONGOING', orgUnitId: orgs.center.id },
    });
    const enrollment2 = await prisma.abacusEnrollment.create({
      data: { studentId: student2.id, courseId: course.id, status: 'ONGOING', orgUnitId: orgs.center.id },
    });

    const teacher1 = await prisma.user.create({
      data: { username: 'teacher1', passwordHash: 'x', role: 'TEACHER', orgUnitId: orgs.center.id },
    });
    const teacher2 = await prisma.user.create({
      data: { username: 'teacher2', passwordHash: 'x', role: 'TEACHER', orgUnitId: orgs.center.id },
    });

    await prisma.teacherStudentAssignment.create({
      data: {
        teacherUserId: teacher1.id,
        studentId: student1.id,
        enrollmentId: enrollment1.id,
        orgUnitId: orgs.center.id,
      },
    });
    await prisma.teacherStudentAssignment.create({
      data: {
        teacherUserId: teacher2.id,
        studentId: student2.id,
        enrollmentId: enrollment2.id,
        orgUnitId: orgs.center.id,
      },
    });

    const now = new Date();
    const submittedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const startedAt = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);

    await prisma.studentWorksheetAttempt.create({
      data: {
        studentId: student1.id,
        worksheetId: worksheet.id,
        status: 'SUBMITTED',
        startedAt,
        submittedAt,
        totalScore: 50,
        maxScore: 100,
      },
    });

    const token = makeToken({ id: teacher1.id, role: teacher1.role, orgUnitId: teacher1.orgUnitId });
    const res = await request(app)
      .get('/api/teacher/assist/signals?limit=50&offset=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    const items = data.items ?? [];
    const studentSignals = items.filter((signal: any) => signal.studentId);
    expect(studentSignals.every((signal: any) => signal.studentId === student1.id)).toBe(true);
    expect(items.some((signal: any) => signal.code === 'OVERDUE_REVIEW')).toBe(true);
    const inactivity = studentSignals.find((signal: any) => signal.code === 'INACTIVITY_RISK');
    expect(inactivity?.severity).toBe('WARN');
  });

  it('student summary is scoped to the logged-in student', async () => {
    const orgs = await seedOrgTree();
    const { course, worksheet } = await seedCourseGraph();

    const student1 = await prisma.student.create({
      data: { code: 'ST3', firstName: 'C', lastName: 'Three', status: 'ACTIVE', orgUnitId: orgs.center.id },
    });
    await prisma.student.create({
      data: { code: 'ST4', firstName: 'D', lastName: 'Four', status: 'ACTIVE', orgUnitId: orgs.center.id },
    });

    await prisma.abacusEnrollment.create({
      data: { studentId: student1.id, courseId: course.id, status: 'ONGOING', orgUnitId: orgs.center.id },
    });

    const now = new Date();
    await prisma.studentWorksheetAttempt.create({
      data: {
        studentId: student1.id,
        worksheetId: worksheet.id,
        status: 'SUBMITTED',
        startedAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        totalScore: 55,
        maxScore: 100,
      },
    });

    const studentUser = await prisma.user.create({
      data: {
        username: 'student_user',
        passwordHash: 'x',
        role: 'STUDENT',
        orgUnitId: orgs.center.id,
        studentId: student1.id,
      },
    });

    const token = makeToken({
      id: studentUser.id,
      role: studentUser.role,
      orgUnitId: studentUser.orgUnitId,
      studentId: studentUser.studentId,
    });

    const res = await request(app)
      .get('/api/student/assist/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(Array.isArray(data.insights)).toBe(true);
    expect(data.insights.length).toBeGreaterThan(0);
  });

  it('applies pagination defaults for center assist signals', async () => {
    const orgs = await seedOrgTree();
    const { course } = await seedCourseGraph();

    const centerUser = await prisma.user.create({
      data: { username: 'center_mgr', passwordHash: 'x', role: 'CENTER_MANAGER', orgUnitId: orgs.center.id },
    });

    const students = Array.from({ length: 25 }).map((_, idx) => ({
      code: `ST${idx + 10}`,
      firstName: `Student${idx + 10}`,
      status: 'ACTIVE',
      orgUnitId: orgs.center.id,
    }));

    await prisma.student.createMany({ data: students });
    const studentIds = await prisma.student.findMany({
      where: { orgUnitId: orgs.center.id },
      select: { id: true },
    });

    await prisma.abacusEnrollment.createMany({
      data: studentIds.map((student) => ({
        studentId: student.id,
        courseId: course.id,
        status: 'ONGOING',
        orgUnitId: orgs.center.id,
      })),
    });

    const token = makeToken({ id: centerUser.id, role: centerUser.role, orgUnitId: centerUser.orgUnitId });
    const res = await request(app)
      .get('/api/center/assist/signals')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
    expect(data.total).toBe(25);
    expect(data.items.length).toBe(20);
  });
});
