const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();
  
  try {
    const users = await prisma.user.findMany();
    console.log('Current users in database:');
    users.forEach(user => {
      console.log(`- ${user.username} (${user.role}) - OrgUnit ID: ${user.orgUnitId}`);
    });
    
    console.log('\nOrg Units:');
    const orgUnits = await prisma.orgUnit.findMany();
    orgUnits.forEach(org => {
      console.log(`- ${org.code} (${org.type}): ${org.name}`);
    });
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();