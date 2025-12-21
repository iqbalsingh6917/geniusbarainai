import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '@lms/db';
import { createApp } from '../../src/index';
import { resetAssessmentsData, seedAssessmentsTestData } from '../../src/tests/helpers/seedAssessmentsTestData';

const app = createApp();

function makeToken(user: { id: number; username?: string; role: string; orgUnitId?: number | null; studentId?: number | null }) {
  const secret = process.env.JWT_SECRET || 'testsecret123456';
  return jwt.sign(
    {
      userId: user.id,
      username: user.username || user.role.toLowerCase(),
      role: user.role,
      orgUnitId: user.orgUnitId ?? null,
      studentId: user.studentId ?? null,
    },
    secret
  );
}

function unwrap(body: any) {
  return body?.data ?? body;
}

async function startAndSubmitAttempt(studentToken: string, worksheetId: number) {
  const startRes = await request(app)
    .post(`/api/student/worksheets/${worksheetId}/start-attempt`)
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(201);
  const startData = unwrap(startRes.body);
  const attemptId = startData?.attempt?.id || startData?.attemptId || startData?.id;

  const qRes = await request(app)
    .get(`/api/student/worksheets/attempts/${attemptId}/questions`)
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(200);
  const questions = unwrap(qRes.body)?.questions ?? [];
  const mcq = questions.find((q: any) => q.questionType === 'MCQ');
  const numeric = questions.find((q: any) => q.questionType === 'NUMERIC');
  const textQ = questions.find((q: any) => q.questionType === 'TEXT');
  const correctMcqOption = mcq.options.find((o: any) => o.isCorrect || o.text === '4');
  const wrongMcqOption = mcq.options.find((o: any) => o.id !== correctMcqOption.id);

  await request(app)
    .post(`/api/student/worksheets/attempts/${attemptId}/submit`)
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      answers: [
        { questionId: mcq.id, optionIds: [wrongMcqOption.id] },
        { questionId: numeric.id, numericAns: 7 },
        { questionId: textQ.id, textAns: 'cat' },
      ],
    })
    .expect(200);

  return attemptId as number;
}

describe('Teacher module', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret123456';
  });

  beforeEach(async () => {
    await resetAssessmentsData();
  });

  afterAll(async () => {
    await resetAssessmentsData();
    await prisma.$disconnect();
  });

  it('teacher dashboard KPIs reflect assigned scope', async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });
    const teacherToken = makeToken({
      id: seed.teacherUser.id,
      role: 'TEACHER',
      orgUnitId: seed.teacherUser.orgUnitId,
    });

    await prisma.studentWorksheetAssignment.create({
      data: {
        studentId: seed.student.id,
        worksheetId: seed.worksheet.id,
        enrollmentId: seed.enrollment.id,
        assignedByUserId: seed.teacherUser.id,
        status: 'ASSIGNED',
      },
    });

    await startAndSubmitAttempt(studentToken, seed.worksheet.id);

    const res = await request(app)
      .get('/api/dashboard/teacher/overview')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const payload = unwrap(res.body);
    const kpis = payload?.kpis || payload?.data?.kpis;
    expect(kpis.studentsAssigned).toBe(1);
    expect(kpis.worksheetsAssigned).toBe(1);
    expect(kpis.worksheetsPendingReview).toBe(1);
    expect(kpis.averageAccuracy).toBeCloseTo(66.67, 1);
  });

  it('worksheet attempt filters separate submitted vs pending vs reviewed', async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });
    const teacherToken = makeToken({
      id: seed.teacherUser.id,
      role: 'TEACHER',
      orgUnitId: seed.teacherUser.orgUnitId,
    });

    const pendingAttemptId = await startAndSubmitAttempt(studentToken, seed.worksheet.id);
    const reviewedAttemptId = await startAndSubmitAttempt(studentToken, seed.worksheet.id);

    await request(app)
      .put(`/api/teacher/worksheets/review/attempts/${reviewedAttemptId}/feedback`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ teacherComment: 'Reviewed' })
      .expect(200);

    const submittedRes = await request(app)
      .get('/api/teacher/worksheets/attempts?status=SUBMITTED,GRADED')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const submittedAttempts = unwrap(submittedRes.body) || [];
    expect(submittedAttempts.length).toBe(2);

    const pendingRes = await request(app)
      .get('/api/teacher/worksheets/attempts?status=SUBMITTED&reviewStatus=PENDING')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const pendingAttempts = unwrap(pendingRes.body) || [];
    expect(pendingAttempts.length).toBe(1);
    expect(pendingAttempts[0].id).toBe(pendingAttemptId);

    const reviewedRes = await request(app)
      .get('/api/teacher/worksheets/attempts?status=SUBMITTED,GRADED&reviewStatus=REVIEWED')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    const reviewedAttempts = unwrap(reviewedRes.body) || [];
    expect(reviewedAttempts.length).toBe(1);
    expect(reviewedAttempts[0].id).toBe(reviewedAttemptId);
  });

  it('review feedback creates one audit log and is idempotent', async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });
    const teacherToken = makeToken({
      id: seed.teacherUser.id,
      role: 'TEACHER',
      orgUnitId: seed.teacherUser.orgUnitId,
    });

    const attemptId = await startAndSubmitAttempt(studentToken, seed.worksheet.id);

    await request(app)
      .put(`/api/teacher/worksheets/review/attempts/${attemptId}/feedback`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ teacherComment: 'Nice work' })
      .expect(200);

    const afterFirst = await prisma.auditLog.count({
      where: { action: 'TEACHER_WORKSHEET_FEEDBACK', entityType: 'StudentWorksheetAttempt', entityId: String(attemptId) },
    });
    expect(afterFirst).toBe(1);

    await request(app)
      .put(`/api/teacher/worksheets/review/attempts/${attemptId}/feedback`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ teacherComment: 'Nice work' })
      .expect(200);

    const afterSecond = await prisma.auditLog.count({
      where: { action: 'TEACHER_WORKSHEET_FEEDBACK', entityType: 'StudentWorksheetAttempt', entityId: String(attemptId) },
    });
    expect(afterSecond).toBe(1);
  });

  it('teacher cannot review attempts outside their assignments', async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });

    const attemptId = await startAndSubmitAttempt(studentToken, seed.worksheet.id);

    const otherTeacherPassword = await bcrypt.hash('teachersecret', 10);
    const otherTeacher = await prisma.user.create({
      data: {
        username: `other_teacher_${Date.now()}`,
        passwordHash: otherTeacherPassword,
        role: 'TEACHER',
        orgUnitId: seed.teacherUser.orgUnitId,
        isActive: true,
      },
    });
    const otherTeacherToken = makeToken({
      id: otherTeacher.id,
      role: 'TEACHER',
      orgUnitId: otherTeacher.orgUnitId,
    });

    await request(app)
      .get(`/api/teacher/worksheets/review/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .expect(403);
  });
});
