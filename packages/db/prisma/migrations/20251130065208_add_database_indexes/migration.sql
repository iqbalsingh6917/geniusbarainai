-- CreateIndex
CREATE INDEX "AbacusEnrollment_studentId_idx" ON "AbacusEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "AbacusEnrollment_orgUnitId_idx" ON "AbacusEnrollment"("orgUnitId");

-- CreateIndex
CREATE INDEX "AbacusEnrollment_courseId_idx" ON "AbacusEnrollment"("courseId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orgUnitId_idx" ON "PaymentTransaction"("orgUnitId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttendance_orgUnitId_idx" ON "StudentAttendance"("orgUnitId");

-- CreateIndex
CREATE INDEX "StudentFeeRecord_studentId_idx" ON "StudentFeeRecord"("studentId");

-- CreateIndex
CREATE INDEX "StudentFeeRecord_orgUnitId_idx" ON "StudentFeeRecord"("orgUnitId");

-- CreateIndex
CREATE INDEX "StudentFeeRecord_status_idx" ON "StudentFeeRecord"("status");
