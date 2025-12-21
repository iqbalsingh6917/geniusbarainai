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
(0, vitest_1.describe)('Exams 2.0 delivery', () => {
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
    (0, vitest_1.it)('student can start, answer, and submit exam attempt', async () => {
        const seed = await (0, seedAssessmentsTestData_1.seedAssessmentsTestData)();
        const studentToken = makeToken({
            id: seed.studentUser.id,
            role: 'STUDENT',
            orgUnitId: seed.studentUser.orgUnitId,
            studentId: seed.studentUser.studentId,
        });
        const startRes = await (0, supertest_1.default)(app)
            .post(`/api/student/exams/${seed.exam.id}/start-attempt`)
            .set('Authorization', `Bearer ${studentToken}`);
        if (startRes.status !== 201) {
            console.error('start exam attempt failed', startRes.status, startRes.body);
        }
        (0, vitest_1.expect)(startRes.status).toBe(201);
        const attemptId = startRes.body?.data?.id ?? startRes.body?.id;
        (0, vitest_1.expect)(attemptId).toBeTruthy();
        const qRes = await (0, supertest_1.default)(app)
            .get(`/api/student/exams/attempts/${attemptId}/questions`)
            .set('Authorization', `Bearer ${studentToken}`)
            .expect(200);
        const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
        (0, vitest_1.expect)(questions).toHaveLength(2);
        const mcq = questions.find((q) => q.type === 'MCQ');
        const numeric = questions.find((q) => q.type === 'NUMERIC');
        const correctMcqOption = mcq.options.find((o) => o.text === '2');
        const submitRes = await (0, supertest_1.default)(app)
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
        (0, vitest_1.expect)(submitted.score).toBe(2);
        (0, vitest_1.expect)(submitted.maxScore).toBe(2);
        (0, vitest_1.expect)(submitted.percentage).toBe(100);
    });
    (0, vitest_1.it)('student cannot start exam without enrollment', async () => {
        const seed = await (0, seedAssessmentsTestData_1.seedAssessmentsTestData)();
        const suffix = Date.now();
        const otherStudent = await db_1.prisma.student.create({
            data: {
                code: `STU_NO_ENROLL_${suffix}`,
                firstName: 'Other',
                status: 'ACTIVE',
            },
        });
        const otherUser = await db_1.prisma.user.create({
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
        await (0, supertest_1.default)(app)
            .post(`/api/student/exams/${seed.exam.id}/start-attempt`)
            .set('Authorization', `Bearer ${token}`)
            .expect(403);
    });
    (0, vitest_1.it)('teacher can override score', async () => {
        const seed = await (0, seedAssessmentsTestData_1.seedAssessmentsTestData)();
        const studentToken = makeToken({
            id: seed.studentUser.id,
            role: 'STUDENT',
            orgUnitId: seed.studentUser.orgUnitId,
            studentId: seed.studentUser.studentId,
        });
        const startRes = await (0, supertest_1.default)(app)
            .post(`/api/student/exams/${seed.exam.id}/start-attempt`)
            .set('Authorization', `Bearer ${studentToken}`);
        const attemptId = startRes.body?.data?.id ?? startRes.body?.id;
        const qRes = await (0, supertest_1.default)(app)
            .get(`/api/student/exams/attempts/${attemptId}/questions`)
            .set('Authorization', `Bearer ${studentToken}`);
        const questions = qRes.body?.data?.questions ?? qRes.body?.questions ?? [];
        const mcq = questions.find((q) => q.type === 'MCQ');
        const numeric = questions.find((q) => q.type === 'NUMERIC');
        const correctMcqOption = mcq.options.find((o) => o.text === '2');
        await (0, supertest_1.default)(app)
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
        const overrideRes = await (0, supertest_1.default)(app)
            .post(`/api/teacher/exams/attempts/${attemptId}/override-score`)
            .set('Authorization', `Bearer ${teacherToken}`)
            .send({ score: 1 })
            .expect(200);
        const overridden = overrideRes.body?.data ?? overrideRes.body;
        (0, vitest_1.expect)(overridden.score).toBe(1);
    });
});
