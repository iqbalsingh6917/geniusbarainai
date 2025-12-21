const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function addTeacherUser() {
  const prisma = new PrismaClient();
  
  try {
    // Get the CE001 org unit
    const ce001OrgUnit = await prisma.orgUnit.findUnique({
      where: { code: 'CE001' }
    });
    
    if (!ce001OrgUnit) {
      console.error('CE001 org unit not found!');
      return;
    }
    
    console.log(`Found CE001 org unit: ${ce001OrgUnit.name} (ID: ${ce001OrgUnit.id})`);
    
    // Create password hash
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('Test@12345', saltRounds);
    
    // Create TEACHER user
    const teacherUser = await prisma.user.upsert({
      where: { username: 'T001' },
      update: {},
      create: {
        username: 'T001',
        passwordHash: passwordHash,
        role: 'TEACHER',
        orgUnitId: ce001OrgUnit.id,
      },
    });
    
    console.log(`Created/Updated TEACHER user with id: ${teacherUser.id}`);
    console.log(`Username: ${teacherUser.username}`);
    console.log(`Role: ${teacherUser.role}`);
    console.log(`OrgUnit ID: ${teacherUser.orgUnitId}`);
    
  } catch (error) {
    console.error('Error creating teacher user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTeacherUser();