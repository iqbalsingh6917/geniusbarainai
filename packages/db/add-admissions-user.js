const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function addAdmissionsUser() {
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
    
    // Create ADMISSIONS user
    const admissionsUser = await prisma.user.upsert({
      where: { username: 'ADM001' },
      update: {},
      create: {
        username: 'ADM001',
        passwordHash: passwordHash,
        role: 'ADMISSIONS',
        orgUnitId: ce001OrgUnit.id,
      },
    });
    
    console.log(`Created/Updated ADMISSIONS user with id: ${admissionsUser.id}`);
    console.log(`Username: ${admissionsUser.username}`);
    console.log(`Role: ${admissionsUser.role}`);
    console.log(`OrgUnit ID: ${admissionsUser.orgUnitId}`);
    
  } catch (error) {
    console.error('Error creating admissions user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addAdmissionsUser();