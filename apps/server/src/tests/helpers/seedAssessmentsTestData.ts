import { prisma } from '@lms/db';
import bcrypt from 'bcryptjs';

export async function resetAssessmentsData() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ExamAnswer","ExamOption","ExamQuestion","ExamAttempt","Exam",
      "StudentWorksheetAnswer","StudentWorksheetAttempt","StudentWorksheetAssignment",
      "WorksheetOption","WorksheetQuestion","AbacusWorksheet","WorksheetAttempt",
      "TeacherStudentAssignment","AbacusAssessment","StudentAttendance","StudentFeeRecord",
      "PaymentTransaction","CourseLicense","LicenseAllocation","LicenseOrder","AbacusClassSchedule",
      "AbacusEnrollment","AbacusLevel","AbacusModule","AbacusCourse",
      "Student","PasswordResetToken","User","OrgUnit"
    RESTART IDENTITY CASCADE;
  `);
}

export async function seedAssessmentsTestData() {
  await resetAssessmentsData();

  const suffix = Date.now();
  const orgCode = `TEST_CENTER_${suffix}`;
  const courseCode = `COURSE_TEST_${suffix}`;
  const superadminUsername = `superadmin_${suffix}`;
  const teacherUsername = `teacher_${suffix}`;
  const studentUsername = `student_${suffix}`;
  const studentCode = `STU_${suffix}`;

  const org = await prisma.orgUnit.create({
    data: {
      code: orgCode,
      name: 'Test Center',
      type: 'CENTER',
      isActive: true,
    },
  });

  const superadminPassword = await bcrypt.hash('supersecret', 10);
  const teacherPassword = await bcrypt.hash('teachersecret', 10);
  const studentPassword = await bcrypt.hash('studentsecret', 10);

  const superadminUser = await prisma.user.create({
    data: {
      username: superadminUsername,
      passwordHash: superadminPassword,
      role: 'SUPERADMIN',
      orgUnitId: null,
      isActive: true,
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      username: teacherUsername,
      passwordHash: teacherPassword,
      role: 'TEACHER',
      orgUnitId: org.id,
      isActive: true,
    },
  });

  const student = await prisma.student.create({
    data: {
      code: studentCode,
      firstName: 'Test',
      lastName: 'Student',
      status: 'ACTIVE',
      orgUnitId: org.id,
    },
  });

  const studentUser = await prisma.user.create({
    data: {
      username: studentUsername,
      passwordHash: studentPassword,
      role: 'STUDENT',
      orgUnitId: org.id,
      studentId: student.id,
      isActive: true,
    },
  });

  const course = await prisma.abacusCourse.create({
    data: {
      code: courseCode,
      name: 'Test Course',
      variant: 'REGULAR',
    },
  });

  const module = await prisma.abacusModule.create({
    data: {
      courseId: course.id,
      index: 1,
      title: 'Module 1',
    },
  });

  const level = await prisma.abacusLevel.create({
    data: {
      moduleId: module.id,
      order: 1,
      name: 'Level 1',
      difficulty: 'EASY',
      operations: [],
      formulas: [],
      examDurationMin: 30,
      passingPercent: 60,
      isActive: true,
    },
  });

  const worksheet = await prisma.abacusWorksheet.create({
    data: {
      levelId: level.id,
      title: 'Worksheet 1',
      kind: 'PRACTICE',
      questionCount: 3,
      generationMode: 'STATIC',
    },
  });

  const worksheetMcq = await prisma.worksheetQuestion.create({
    data: {
      worksheetId: worksheet.id,
      orderIndex: 1,
      questionType: 'MCQ',
      prompt: 'What is 2+2?',
      correctAnswer: '4',
      correctNum: 4,
      maxMarks: 1,
      options: {
        create: [
          { text: '3', isCorrect: false },
          { text: '4', isCorrect: true },
          { text: '5', isCorrect: false },
        ],
      },
    },
    include: { options: true },
  });

  const worksheetNumeric = await prisma.worksheetQuestion.create({
    data: {
      worksheetId: worksheet.id,
      orderIndex: 2,
      questionType: 'NUMERIC',
      prompt: 'What is 10-3?',
      correctAnswer: '7',
      correctNum: 7,
      maxMarks: 1,
    },
  });

  const worksheetText = await prisma.worksheetQuestion.create({
    data: {
      worksheetId: worksheet.id,
      orderIndex: 3,
      questionType: 'TEXT',
      prompt: 'Spell CAT',
      correctAnswer: 'cat',
      correctText: 'cat',
      maxMarks: 1,
    },
  });

  const exam = await prisma.exam.create({
    data: {
      title: 'Test Exam',
      courseCode: course.code,
    },
  });

  const examMcq = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      order: 1,
      type: 'MCQ',
      text: 'Pick 2',
      correctNum: null,
      options: {
        create: [
          { text: '2', isCorrect: true },
          { text: '3', isCorrect: false },
        ],
      },
    },
    include: { options: true },
  });

  const examNumeric = await prisma.examQuestion.create({
    data: {
      examId: exam.id,
      order: 2,
      type: 'NUMERIC',
      text: '3+4',
      correctNum: 7,
    },
  });

  const enrollment = await prisma.abacusEnrollment.create({
    data: {
      studentId: student.id,
      courseId: course.id,
      status: 'ONGOING',
      orgUnitId: org.id,
      startDate: new Date(),
    },
  });

  await prisma.teacherStudentAssignment.create({
    data: {
      teacherUserId: teacherUser.id,
      studentId: student.id,
      enrollmentId: enrollment.id,
      orgUnitId: org.id,
    },
  });

  return {
    superadminUser,
    teacherUser,
    studentUser,
    student,
    course,
    module,
    level,
    worksheet,
    exam,
    enrollment,
    examQuestions: [examMcq, examNumeric],
    worksheetQuestions: [worksheetMcq, worksheetNumeric, worksheetText],
  };
}
