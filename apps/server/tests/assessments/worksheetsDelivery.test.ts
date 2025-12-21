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

describe('Worksheets 2.0 delivery', () => {
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

  it(
    'student can start, answer, and submit worksheet attempt',
    { timeout: 15000 },
    async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });

    const startRes = await request(app)
      .post(`/api/student/worksheets/${seed.worksheet.id}/start-attempt`)
      .set('Authorization', `Bearer ${studentToken}`);
    if (startRes.status !== 201) {
      console.error('start worksheet attempt failed', startRes.status, startRes.body);
    }
    expect(startRes.status).toBe(201);

    const attemptId = startRes.body?.data?.attempt?.id || startRes.body?.attempt?.id || startRes.body?.data?.id || startRes.body?.id;
    expect(attemptId).toBeTruthy();

    const qRes = await request(app)
      .get(`/api/student/worksheets/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);

    const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
    expect(questions.length).toBe(3);
    const mcq = questions.find((q: any) => q.questionType === 'MCQ');
    const numeric = questions.find((q: any) => q.questionType === 'NUMERIC');
    const textQ = questions.find((q: any) => q.questionType === 'TEXT');
    const correctMcqOption = mcq.options.find((o: any) => o.text === '4');

    const submitRes = await request(app)
      .post(`/api/student/worksheets/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq.id, optionIds: [correctMcqOption.id] },
          { questionId: numeric.id, numericAns: 7 },
          { questionId: textQ.id, textAns: 'cat' },
        ],
      })
      .expect(200);

    const submitted = submitRes.body?.data ?? submitRes.body;
    expect(submitted.totalScore || submitted.score).toBe(3);
    expect(submitted.maxScore).toBe(3);
    const percentage = submitted.percentage ?? submitted?.percentage;
    expect(percentage).toBe(100);
  });

  it(
    'teacher can review and override worksheet score',
    { timeout: 15000 },
    async () => {
    const seed = await seedAssessmentsTestData();
    const studentToken = makeToken({
      id: seed.studentUser.id,
      role: 'STUDENT',
      orgUnitId: seed.studentUser.orgUnitId,
      studentId: seed.studentUser.studentId,
    });

    // student completes worksheet
    const startRes = await request(app)
      .post(`/api/student/worksheets/${seed.worksheet.id}/start-attempt`)
      .set('Authorization', `Bearer ${studentToken}`);
    const attemptId = startRes.body?.data?.attempt?.id || startRes.body?.attempt?.id || startRes.body?.data?.id || startRes.body?.id;
    const qRes = await request(app)
      .get(`/api/student/worksheets/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${studentToken}`);
    const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
    const mcq = questions.find((q: any) => q.questionType === 'MCQ');
    const numeric = questions.find((q: any) => q.questionType === 'NUMERIC');
    const textQ = questions.find((q: any) => q.questionType === 'TEXT');
    const correctMcqOption = mcq.options.find((o: any) => o.text === '4');
    await request(app)
      .post(`/api/student/worksheets/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        answers: [
          { questionId: mcq.id, optionIds: [correctMcqOption.id] },
          { questionId: numeric.id, numericAns: 7 },
          { questionId: textQ.id, textAns: 'cat' },
        ],
      });

    const teacherToken = makeToken({
      id: seed.teacherUser.id,
      role: 'TEACHER',
      orgUnitId: seed.teacherUser.orgUnitId,
    });

    const reviewRes = await request(app)
      .get(`/api/teacher/worksheets/review/attempts/${attemptId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const reviewData = reviewRes.body?.data ?? reviewRes.body;
    expect(reviewData.questions?.length).toBe(3);
    expect(reviewData.questions[0]).toHaveProperty('correctAnswer');
    expect(reviewData.questions[0]).toHaveProperty('answerGiven');

    const overrideRes = await request(app)
      .post(`/api/teacher/worksheets/review/attempts/${attemptId}/override-score`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ score: 2 })
      .expect(200);

    const overridden = overrideRes.body?.data ?? overrideRes.body;
    expect(overridden.totalScore ?? overridden.score).toBe(2);
  });
});
