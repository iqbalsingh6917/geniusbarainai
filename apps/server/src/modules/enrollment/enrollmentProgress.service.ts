import { prisma } from '@lms/db';

/**
 * Recompute course progress for an enrollment based on completed module attempts.
 */
export async function updateCourseProgressForEnrollment(enrollmentId: number): Promise<void> {
  // Fetch enrollment
  const enrollment = await prisma.abacusEnrollment.findUnique({
    where: { id: enrollmentId },
    select: {
      id: true,
      courseId: true,
      status: true,
    },
  });

  if (!enrollment) return;

  // Fetch all modules for this course
  const modules = await prisma.abacusModule.findMany({
    where: { courseId: enrollment.courseId },
    select: { id: true },
  });

  const totalModules = modules.length;
  if (totalModules === 0) return;

  // Count completed module attempts for this enrollment
  const completedModules = await prisma.moduleAttempt.count({
    where: {
      enrollmentId,
      status: 'COMPLETED',
    },
  });

  const progressPercent = Math.min(100, Math.round((completedModules / totalModules) * 100));

  const updateData: any = {
    progressPercent,
  };

  if (progressPercent === 100 && enrollment.status !== 'COMPLETED') {
    updateData.status = 'COMPLETED';
    updateData.completedAt = new Date();
  }

  await prisma.abacusEnrollment.update({
    where: { id: enrollmentId },
    data: updateData,
  });
}
