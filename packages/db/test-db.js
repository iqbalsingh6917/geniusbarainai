const { PrismaClient } = require('@prisma/client');

async function testDbConnection() {
  const prisma = new PrismaClient();
  
  try {
    // Test database connection by querying for the superadmin user
    const user = await prisma.user.findUnique({
      where: { username: 'SA001' }
    });
    
    console.log('Database connection successful!');
    console.log('User found:', user);
    
    if (user) {
      console.log('Username:', user.username);
      console.log('Role:', user.role);
      // Note: passwordHash won't be shown for security reasons
    } else {
      console.log('User SA001 not found in database');
    }
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDbConnection();