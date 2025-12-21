import {
  PrismaClient,
  AbacusWorksheet,
  StudentWorksheetAnswer,
  StudentWorksheetAttempt,
  WorksheetQuestion,
} from '@prisma/client';
import prisma from '../prismaClient';
import { checkAndHandleModuleCompletion } from './moduleProgressService';

export class WorksheetEngineError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function getWorksheetQuestions(worksheetId: number): Promise<WorksheetQuestion[]> {
  return prisma.worksheetQuestion.findMany({
    where: { worksheetId },
    orderBy: { orderIndex: 'asc' },
    include: { options: true },
  });
}

type GenerationConfig = {
  questionCount?: number;
  maxDigits?: number;
  maxTerms?: number;
  operations?: ('ADD' | 'SUB')[];
};

type WorksheetWithContext = AbacusWorksheet & {
  level?: {
    maxDigits?: number | null;
    maxTerms?: number | null;
    operations?: string[] | null;
    module?: {
      course?: {
        variant?: string | null;
      } | null;
    } | null;
  } | null;
};

async function generateQuestionsForWorksheet(
  client: PrismaClient,
  worksheet: WorksheetWithContext
): Promise<void> {
  const config = ((worksheet.generationConfig as any) || {}) as GenerationConfig;

  const questionCount = config.questionCount ?? worksheet.questionCount ?? 20;
  const maxDigits = Math.max(1, config.maxDigits ?? worksheet.level?.maxDigits ?? 2);
  const maxTerms = Math.max(2, config.maxTerms ?? worksheet.level?.maxTerms ?? 2);

  const opsFromLevel = (worksheet.level?.operations ?? []) as string[];
  const operations: ('ADD' | 'SUB')[] =
    (config.operations as ('ADD' | 'SUB')[] | undefined) ??
    opsFromLevel
      .map((op) => (op === 'ADDITION' ? 'ADD' : op === 'SUBTRACTION' ? 'SUB' : null))
      .filter((op): op is 'ADD' | 'SUB' => Boolean(op));

  if (operations.length === 0) {
    operations.push('ADD');
  }

  const questions: {
    worksheetId: number;
    orderIndex: number;
    questionType: string;
    prompt: string;
    correctAnswer: string;
    correctNum?: number;
    maxMarks: number;
  }[] = [];

  for (let i = 0; i < questionCount; i += 1) {
    const op = operations[i % operations.length];
    const termCount = Math.max(2, Math.min(maxTerms, 3)); // keep 2–3 terms for stability
    const terms: number[] = [];

    for (let t = 0; t < termCount; t += 1) {
      const maxValue = Math.max(1, Math.pow(10, maxDigits) - 1);
      const value = Math.floor(Math.random() * maxValue) + 1;
      terms.push(value);
    }

    let prompt: string;
    let answer: number;

    if (op === 'ADD') {
      answer = terms.reduce((sum, v) => sum + v, 0);
      prompt = terms.join(' + ');
    } else {
      terms.sort((a, b) => b - a);
      answer = terms.slice(1).reduce((acc, v) => acc - v, terms[0]);
      prompt = terms.join(' - ');
    }

    questions.push({
      worksheetId: worksheet.id,
      orderIndex: i + 1,
      questionType: 'NUMERIC',
      prompt,
      correctAnswer: String(answer),
      correctNum: answer,
      maxMarks: 1,
    });
  }

  await client.worksheetQuestion.deleteMany({
    where: { worksheetId: worksheet.id },
  });

  if (questions.length > 0) {
    await client.worksheetQuestion.createMany({
      data: questions,
    });
  }

  await client.abacusWorksheet.update({
    where: { id: worksheet.id },
    data: {
      questionCount,
    },
  });
}

export async function refreshWorksheetQuestionCount(worksheetId: number): Promise<number> {
  const total = await prisma.worksheetQuestion.count({ where: { worksheetId } });
  await prisma.abacusWorksheet.update({
    where: { id: worksheetId },
    data: { questionCount: total },
  });
  return total;
}

export async function createOrGetAttemptForStudent(
  studentId: number,
  worksheetId: number,
  assignmentId?: number | null,
  enrollmentId?: number | null
): Promise<{ attempt: StudentWorksheetAttempt; questions: WorksheetQuestion[] }> {
  const worksheet = await prisma.abacusWorksheet.findUnique({
    where: { id: worksheetId },
    include: {
      level: {
        include: {
          module: {
            include: {
              course: true,
            },
          },
        },
      },
    },
  });

  if (!worksheet) {
    throw new WorksheetEngineError('WORKSHEET_NOT_FOUND', 'Worksheet not found', 404);
  }

  let questions = await getWorksheetQuestions(worksheetId);
  if (questions.length === 0) {
    const shouldGenerate =
      worksheet.generationMode !== 'STATIC' || worksheet.level?.module?.course?.variant === 'BEATS20';

    if (shouldGenerate) {
      await generateQuestionsForWorksheet(prisma, worksheet);
      questions = await getWorksheetQuestions(worksheetId);
    }

    if (questions.length === 0) {
      throw new WorksheetEngineError('NO_QUESTIONS', 'Worksheet has no questions to attempt', 400);
    }
  }

  const maxScore = questions.reduce((sum, q) => sum + (q.maxMarks || 1), 0);
  const inProgress = await prisma.studentWorksheetAttempt.findFirst({
    where: {
      studentId,
      worksheetId,
      assignmentId: assignmentId ?? null,
      status: 'IN_PROGRESS',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (inProgress) {
    if (inProgress.maxScore !== maxScore) {
      const updatedAttempt = await prisma.studentWorksheetAttempt.update({
        where: { id: inProgress.id },
        data: { maxScore },
      });
      return { attempt: updatedAttempt, questions };
    }
    return { attempt: inProgress, questions };
  }

  const attempt = await prisma.studentWorksheetAttempt.create({
    data: {
      studentId,
      worksheetId,
      assignmentId: assignmentId ?? null,
      enrollmentId: enrollmentId ?? null,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      maxScore,
    },
  });

  return { attempt, questions };
}

export async function saveAnswers(
  attemptId: number,
  answers: {
    questionId: number;
    answerGiven?: string;
    numericAns?: number | null;
    textAns?: string | null;
    optionIds?: number[];
  }[]
): Promise<{ saved: number }> {
  const attempt = await prisma.studentWorksheetAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) {
    throw new WorksheetEngineError('ATTEMPT_NOT_FOUND', 'Attempt not found', 404);
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw new WorksheetEngineError('ATTEMPT_NOT_EDITABLE', 'Attempt is not in progress', 400);
  }

  const questions = await prisma.worksheetQuestion.findMany({
    where: { worksheetId: attempt.worksheetId },
    include: { options: true },
  });
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const filtered = answers.filter((a) => questionMap.has(a.questionId));
  if (filtered.length !== answers.length) {
    throw new WorksheetEngineError('INVALID_QUESTION', 'One or more questions do not belong to this worksheet', 400);
  }

  const existing = await prisma.studentWorksheetAnswer.findMany({ where: { attemptId } });
  const existingMap = new Map<number, StudentWorksheetAnswer>();
  existing.forEach((ans) => existingMap.set(ans.questionId, ans));

  const operations = filtered.map((answer) => {
    const question = questionMap.get(answer.questionId)!;
    const optionIds = (answer.optionIds ?? []).filter((id) => question.options.some((o) => o.id === id));
    const numericAns =
      typeof answer.numericAns === 'number' && Number.isFinite(answer.numericAns)
        ? answer.numericAns
        : Number.isFinite(Number(answer.answerGiven))
          ? Number(answer.answerGiven)
          : null;
    const textAns = answer.textAns ?? (answer.answerGiven ?? null);
    const derivedAnswerGiven =
      answer.answerGiven ??
      (textAns !== null && textAns !== undefined && textAns !== ''
        ? textAns
        : Number.isFinite(numericAns)
          ? String(numericAns)
          : optionIds.length > 0
            ? optionIds.join(',')
            : '');
    const data = {
      answerGiven: derivedAnswerGiven,
      numericAns: Number.isFinite(numericAns) ? numericAns : null,
      textAns: textAns ?? null,
      optionIds,
    };

    const current = existingMap.get(answer.questionId);
    if (current) {
      return prisma.studentWorksheetAnswer.update({
        where: { id: current.id },
        data,
      });
    }
    return prisma.studentWorksheetAnswer.create({
      data: {
        attemptId,
        questionId: answer.questionId,
        ...data,
      },
    });
  });

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  await prisma.studentWorksheetAttempt.update({
    where: { id: attemptId },
    data: { updatedAt: new Date() },
  });

  return { saved: operations.length };
}

export async function getAttemptWithDetails(
  attemptId: number
): Promise<{
  attempt: StudentWorksheetAttempt;
  questions: WorksheetQuestion[];
  answers: StudentWorksheetAnswer[];
}> {
  const attempt = await prisma.studentWorksheetAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) {
    throw new WorksheetEngineError('ATTEMPT_NOT_FOUND', 'Attempt not found', 404);
  }
  const [questions, answers] = await Promise.all([
    getWorksheetQuestions(attempt.worksheetId),
    prisma.studentWorksheetAnswer.findMany({ where: { attemptId } }),
  ]);
  return { attempt, questions, answers };
}

export async function submitAttempt(
  attemptId: number,
  studentId: number
): Promise<{
  attempt: StudentWorksheetAttempt;
  totalScore: number;
  maxScore: number;
  percentage: number | null;
  questionSummaries: Array<{
    questionId: number;
    orderIndex: number;
    prompt: string;
    correctAnswer: string;
    answerGiven: string;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
  }>;
}> {
  const attempt = await prisma.studentWorksheetAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) {
    throw new WorksheetEngineError('ATTEMPT_NOT_FOUND', 'Attempt not found', 404);
  }
  if (attempt.studentId !== studentId) {
    throw new WorksheetEngineError('ACCESS_DENIED', 'Attempt does not belong to this student', 403);
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw new WorksheetEngineError('INVALID_STATUS', 'Attempt is not in progress', 400);
  }

  const questions = await prisma.worksheetQuestion.findMany({
    where: { worksheetId: attempt.worksheetId },
    orderBy: { orderIndex: 'asc' },
    include: { options: true },
  });
  if (questions.length === 0) {
    throw new WorksheetEngineError('NO_QUESTIONS', 'Worksheet has no questions to grade', 400);
  }

  const existingAnswers = await prisma.studentWorksheetAnswer.findMany({ where: { attemptId } });
  const answersByQuestion = new Map(existingAnswers.map((a) => [a.questionId, a]));

  const answerOperations: any[] = [];
  let totalScore = 0;
  const maxScore = questions.reduce((sum, q) => sum + (q.maxMarks || 1), 0);
  const epsilon = 1e-3;

  const questionSummaries = questions.map((question) => {
    const existing = answersByQuestion.get(question.id);
    const maxMarks = question.maxMarks || 1;
    const numericExpected =
      question.correctNum !== null && question.correctNum !== undefined
        ? question.correctNum
        : Number.isFinite(Number(question.correctAnswer))
          ? Number(question.correctAnswer)
          : null;
    const numericGiven =
      existing?.numericAns !== null && existing?.numericAns !== undefined && Number.isFinite(existing?.numericAns)
        ? (existing?.numericAns as number)
        : Number.isFinite(Number(existing?.answerGiven))
          ? Number(existing?.answerGiven)
          : null;
    const textExpected = (question.correctText ?? question.correctAnswer ?? '').trim().toLowerCase();
    const rawTextGiven = existing?.textAns ?? existing?.answerGiven ?? '';
    const textGiven = rawTextGiven.trim().toLowerCase();
    const correctOptionIds = question.options?.filter((o) => o.isCorrect).map((o) => o.id).sort() ?? [];
    const selectedOptionIds = (existing?.optionIds ?? []).slice().sort();

    let isCorrect = false;
    if (question.questionType === 'NUMERIC') {
      isCorrect =
        numericExpected !== null &&
        numericExpected !== undefined &&
        numericGiven !== null &&
        Math.abs(numericExpected - numericGiven) < epsilon;
    } else if (question.questionType === 'MCQ') {
      isCorrect =
        correctOptionIds.length === selectedOptionIds.length &&
        correctOptionIds.every((val, idx) => val === selectedOptionIds[idx]);
    } else {
      isCorrect = Boolean(textExpected) && Boolean(textGiven) && textExpected === textGiven;
    }

    const marksAwarded = isCorrect ? maxMarks : 0;
    totalScore += marksAwarded;

    const answerGiven =
      existing?.answerGiven ||
      (selectedOptionIds.length > 0
        ? selectedOptionIds.join(',')
        : numericGiven !== null
          ? String(numericGiven)
          : rawTextGiven);

    if (existing) {
      answerOperations.push(
        prisma.studentWorksheetAnswer.update({
          where: { id: existing.id },
          data: {
            answerGiven,
            numericAns: numericGiven,
            textAns: existing.textAns ?? existing.answerGiven ?? null,
            optionIds: selectedOptionIds,
            isCorrect,
            marksAwarded,
          },
        })
      );
    } else {
      answerOperations.push(
        prisma.studentWorksheetAnswer.create({
          data: {
            attemptId,
            questionId: question.id,
            answerGiven: answerGiven ?? '',
            numericAns: numericGiven,
            textAns: rawTextGiven || null,
            optionIds: selectedOptionIds,
            isCorrect,
            marksAwarded,
          },
        })
      );
    }

    const correctAnswerString =
      question.questionType === 'MCQ'
        ? correctOptionIds.join(',')
        : question.questionType === 'NUMERIC' && numericExpected !== null
          ? String(numericExpected)
          : question.correctText ?? question.correctAnswer;

    return {
      questionId: question.id,
      orderIndex: question.orderIndex,
      prompt: question.prompt,
      correctAnswer: correctAnswerString,
      answerGiven: answerGiven ?? '',
      isCorrect,
      marksAwarded,
      maxMarks,
    };
  });

  const updatedAttemptPromise = prisma.studentWorksheetAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      totalScore,
      maxScore,
      autoGraded: true,
      updatedAt: new Date(),
    },
  });

  await prisma.$transaction([...answerOperations, updatedAttemptPromise]);

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null;
  const updatedAttempt = await prisma.studentWorksheetAttempt.findUniqueOrThrow({ where: { id: attemptId } });

  // Fire-and-forget module completion check; do not block submission if it fails
  checkAndHandleModuleCompletion(studentId, updatedAttempt.worksheetId).catch((err) => {
    console.error('Module completion check failed', err);
  });

  return { attempt: updatedAttempt, totalScore, maxScore, percentage, questionSummaries };
}
