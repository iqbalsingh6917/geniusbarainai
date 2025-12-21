import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generates a StudentFeeRecord for an enrollment
 * @param enrollmentId The ID of the enrollment
 * @param studentId The ID of the student
 * @param orgUnitId The ID of the organization unit
 */
export const generateStudentFeeRecord = async (
  enrollmentId: number,
  studentId: number,
  orgUnitId: number
) => {
  try {
    // Get the current fee setting
    const feeSettings: any = await prisma.$queryRaw`
      SELECT * FROM "FeeSetting" ORDER BY "updatedAt" DESC LIMIT 1
    `;
    
    const feeSetting = feeSettings.length > 0 ? feeSettings[0] : null;

    // If no fee setting exists, don't create a fee record
    if (!feeSetting) {
      console.log('No fee setting found, skipping fee record creation');
      return null;
    }

    // Create the student fee record
    const studentFeeRecord: any = await prisma.$queryRaw`
      INSERT INTO "StudentFeeRecord" (
        "studentId", "enrollmentId", "orgUnitId", "amount", "status", "createdAt"
      ) VALUES (
        ${studentId}, ${enrollmentId}, ${orgUnitId}, ${feeSetting.amountPerStudent}, 'PENDING', NOW()
      ) RETURNING *
    `;
    
    return studentFeeRecord[0];
  } catch (error) {
    console.error('Error generating student fee record:', error);
    throw error;
  }
};

/**
 * Updates StudentFeeRecord status when enrollment status changes
 * @param enrollmentId The ID of the enrollment
 * @param newStatus The new status of the enrollment
 */
export const updateStudentFeeRecordStatus = async (
  enrollmentId: number,
  newStatus: string
) => {
  try {
    // Only update fee record if enrollment becomes ONGOING
    if (newStatus === 'ONGOING') {
      // Check if a fee record already exists for this enrollment
      const existingFeeRecords: any = await prisma.$queryRaw`
        SELECT * FROM "StudentFeeRecord" WHERE "enrollmentId" = ${enrollmentId} LIMIT 1
      `;
      
      const existingFeeRecord = existingFeeRecords.length > 0 ? existingFeeRecords[0] : null;

      // If no fee record exists, create one
      if (!existingFeeRecord) {
        // Get the enrollment with student and org unit info
        const enrollment: any = await prisma.$queryRaw`
          SELECT "id", "studentId", "orgUnitId" 
          FROM "AbacusEnrollment" 
          WHERE "id" = ${enrollmentId}
        `;

        if (enrollment.length > 0) {
          const enrollmentData = enrollment[0];
          return await generateStudentFeeRecord(
            enrollmentData.id,
            enrollmentData.studentId,
            enrollmentData.orgUnitId
          );
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error updating student fee record status:', error);
    throw error;
  }
};