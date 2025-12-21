"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const supertest_1 = __importDefault(require("supertest"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("@lms/db");
const index_1 = require("../../src/index");
const seedAssessmentsTestData_1 = require("../../src/tests/helpers/seedAssessmentsTestData");
const app = (0, index_1.createApp)();
function makeToken(user) {
    const secret = process.env.JWT_SECRET || 'testsecret123456';
    return jsonwebtoken_1.default.sign({
        userId: user.id,
        username: user.username || user.role.toLowerCase(),
        role: user.role,
        orgUnitId: user.orgUnitId ?? null,
        studentId: user.studentId ?? null,
    }, secret);
}
(0, vitest_1.describe)('Worksheets 2.0 delivery', () => {
    (0, vitest_1.beforeAll)(() => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret123456';
    });
    (0, vitest_1.beforeEach)(async () => {
        await (0, seedAssessmentsTestData_1.resetAssessmentsData)();
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, seedAssessmentsTestData_1.resetAssessmentsData)();
        await db_1.prisma.$disconnect();
    });
    (0, vitest_1.it)('student can start, answer, and submit worksheet attempt', { timeout: 15000 }, async () => {
        const seed = await (0, seedAssessmentsTestData_1.seedAssessmentsTestData)();
        const studentToken = makeToken({
            id: seed.studentUser.id,
            role: 'STUDENT',
            orgUnitId: seed.studentUser.orgUnitId,
            studentId: seed.studentUser.studentId,
        });
        const startRes = await (0, supertest_1.default)(app)
            .post(`/api/student/worksheets/${seed.worksheet.id}/start-attempt`)
            .set('Authorization', `Bearer ${studentToken}`);
        if (startRes.status !== 201) {
            console.error('start worksheet attempt failed', startRes.status, startRes.body);
        }
        (0, vitest_1.expect)(startRes.status).toBe(201);
        const attemptId = startRes.body?.data?.attempt?.id || startRes.body?.attempt?.id || startRes.body?.data?.id || startRes.body?.id;
        (0, vitest_1.expect)(attemptId).toBeTruthy();
        const qRes = await (0, supertest_1.default)(app)
            .get(`/api/student/worksheets/attempts/${attemptId}/questions`)
            .set('Authorization', `Bearer ${studentToken}`)
            .expect(200);
        const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
        (0, vitest_1.expect)(questions.length).toBe(3);
        const mcq = questions.find((q) => q.questionType === 'MCQ');
        const numeric = questions.find((q) => q.questionType === 'NUMERIC');
        const textQ = questions.find((q) => q.questionType === 'TEXT');
        const correctMcqOption = mcq.options.find((o) => o.text === '4');
        const submitRes = await (0, supertest_1.default)(app)
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
        (0, vitest_1.expect)(submitted.totalScore || submitted.score).toBe(3);
        (0, vitest_1.expect)(submitted.maxScore).toBe(3);
        const percentage = submitted.percentage ?? submitted?.percentage;
        (0, vitest_1.expect)(percentage).toBe(100);
    });
    (0, vitest_1.it)('teacher can review and override worksheet score', { timeout: 15000 }, async () => {
        const seed = await (0, seedAssessmentsTestData_1.seedAssessmentsTestData)();
        const studentToken = makeToken({
            id: seed.studentUser.id,
            role: 'STUDENT',
            orgUnitId: seed.studentUser.orgUnitId,
            studentId: seed.studentUser.studentId,
        });
        const startRes = await (0, supertest_1.default)(app)
            .post(`/api/student/worksheets/${seed.worksheet.id}/start-attempt`)
            .set('Authorization', `Bearer ${studentToken}`);
        const attemptId = startRes.body?.data?.attempt?.id || startRes.body?.attempt?.id || startRes.body?.data?.id || startRes.body?.id;
        const qRes = await (0, supertest_1.default)(app)
            .get(`/api/student/worksheets/attempts/${attemptId}/questions`)
            .set('Authorization', `Bearer ${studentToken}`);
        const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
        const mcq = questions.find((q) => q.questionType === 'MCQ');
        const numeric = questions.find((q) => q.questionType === 'NUMERIC');
        const textQ = questions.find((q) => q.questionType === 'TEXT');
        const correctMcqOption = mcq.options.find((o) => o.text === '4');
        await (0, supertest_1.default)(app)
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
        const reviewRes = await (0, supertest_1.default)(app)
            .get(`/api/teacher/worksheets/review/attempts/${attemptId}`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .expect(200);
        const reviewData = reviewRes.body?.data ?? reviewRes.body;
        (0, vitest_1.expect)(reviewData.questions?.length).toBe(3);
        (0, vitest_1.expect)(reviewData.questions[0]).toHaveProperty('correctAnswer');
        (0, vitest_1.expect)(reviewData.questions[0]).toHaveProperty('answerGiven');
        const overrideRes = await (0, supertest_1.default)(app)
            .post(`/api/teacher/worksheets/review/attempts/${attemptId}/override-score`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({ score: 2 })
            .expect(200);
        const overridden = overrideRes.body?.data ?? overrideRes.body;
        (0, vitest_1.expect)(overridden.totalScore ?? overridden.score).toBe(2);
    });
});
