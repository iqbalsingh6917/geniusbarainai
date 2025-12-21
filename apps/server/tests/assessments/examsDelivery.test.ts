import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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

describe('Exams 2.0 delivery', () => {
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

  it('student can start, answer, and submit exam attempt', async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });

    const startRes = await request(app)
      .post(`/api/student/exams/${seed.exam.id}/start-attempt`)
      .set('Authorization', `Bearer ${studentToken}`);
    if (startRes.status !== 201) {
      console.error('start exam attempt failed', startRes.status, startRes.body);
    }
    expect(startRes.status).toBe(201);

    const attemptId = startRes.body?.data?.id ?? startRes.body?.id;
    expect(attemptId).toBeTruthy();

    const qRes = await request(app)
      .get(`/api/student/exams/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
    expect(questions).toHaveLength(2);
    const mcq = questions.find((q: any) => q.type === 'MCQ');
    const numeric = questions.find((q: any) => q.type === 'NUMERIC');
    const correctMcqOption = mcq.options.find((o: any) => o.text === '2');

    const submitRes = await request(app)
      .post(`/api/student/exams/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq.id, optionIds: [correctMcqOption.id] },
          { questionId: numeric.id, numericAns: 7 },
        ],
      })
      .expect(200);

    const submitted = submitRes.body?.data ?? submitRes.body;
    expect(submitted.score).toBe(2);
    expect(submitted.maxScore).toBe(2);
    expect(submitted.percentage).toBe(100);
  });

  it('student cannot start exam without enrollment', async () => {
    const seed = await seedAssessmentsTestData();
    const suffix = Date.now();
    const otherStudent = await prisma.student.create({
      data: {
        code: `STU_NO_ENROLL_${suffix}`,
        firstName: 'Other',
        status: 'ACTIVE',
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        username: `student_no_enroll_${suffix}`,
        passwordHash: 'x',
        role: 'STUDENT',
        studentId: otherStudent.id,
        orgUnitId: null,
      },
    });

    const token = makeToken({
      id: otherUser.id,
      role: 'STUDENT',
      orgUnitId: null,
      studentId: otherStudent.id,
    });

    await request(app)
      .post(`/api/student/exams/${seed.exam.id}/start-attempt`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('teacher can override score', async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });

    // student completes exam
    const startRes = await request(app)
      .post(`/api/student/exams/${seed.exam.id}/start-attempt`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body?.data?.id ?? startRes.body?.id;
    const qRes = await request(app)
      .get(`/api/student/exams/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`);
    const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
    const mcq = questions.find((q: any) => q.type === 'MCQ');
    const numeric = questions.find((q: any) => q.type === 'NUMERIC');
    const correctMcqOption = mcq.options.find((o: any) => o.text === '2');
    await request(app)
      .post(`/api/student/exams/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq.id, optionIds: [correctMcqOption.id] },
          { questionId: numeric.id, numericAns: 7 },
        ],
      });

    const teacherToken = makeToken({
      id: seed.teacherUser.id,
      role: 'TEACHER',
      orgUnitId: seed.teacherUser.orgUnitId,
    });

    const overrideRes = await request(app)
      .post(`/api/teacher/exams/attempts/${attemptId}/override-score`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ score: 1 })
      .expect(200);

    const overridden = overrideRes.body?.data ?? overrideRes.body;
    expect(overridden.score).toBe(1);
  });
});
