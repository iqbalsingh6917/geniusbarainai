const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedOrgUnits() {
  try {
    console.log('Seeding org units...');
    
    // Create SUPERADMIN user if not exists
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash('Test@12345', saltRounds);
    
    const superadmin = await prisma.user.upsert({
      where: { username: 'SA001' },
      update: {},
      create: {
        username: 'SA001',
        passwordHash,
        role: 'SUPERADMIN',
      },
    });
    
    console.log(`Created/Updated SUPERADMIN user with id: ${superadmin.id}`);
    
    // Create Org Units hierarchy
    console.log('\nCreating org units hierarchy...');
    
    // Create SUPERADMIN_ROOT org unit
    const saRoot = await prisma.orgUnit.upsert({
      where: { code: 'SA_ROOT' },
      update: {},
      create: {
        code: 'SA_ROOT',
        name: 'Superadmin Root',
        type: 'SUPERADMIN_ROOT',
      },
    });
    
    console.log(`Created/Updated SUPERADMIN_ROOT org unit with id: ${saRoot.id}`);
    
    // Create Business Partner org unit
    const bp001 = await prisma.orgUnit.upsert({
      where: { code: 'BP001' },
      update: {},
      create: {
        code: 'BP001',
        name: 'Business Partner 1',
        type: 'BUSINESS_PARTNER',
        parentId: saRoot.id,
      },
    });
    
    console.log(`Created/Updated BUSINESS_PARTNER org unit with id: ${bp001.id}`);
    
    // Create Franchise org unit
    const fr001 = await prisma.orgUnit.upsert({
      where: { code: 'FR001' },
      update: {},
      create: {
        code: 'FR001',
        name: 'Franchise 1',
        type: 'FRANCHISE',
        parentId: bp001.id,
      },
    });
    
    console.log(`Created/Updated FRANCHISE org unit with id: ${fr001.id}`);
    
    // Get or create demo center org unit
    const ce001 = await prisma.orgUnit.upsert({
      where: { code: 'CE001' },
      update: {},
      create: {
        code: 'CE001',
        name: 'Patiala Main Center',
        type: 'CENTER',
        parentId: fr001.id,
      },
    });
    
    console.log(`Created/Updated CENTER org unit with id: ${ce001.id}`);
    
    // Update the parent relationships if needed
    await prisma.orgUnit.update({
      where: { id: bp001.id },
      data: { parentId: saRoot.id },
    });
    
    await prisma.orgUnit.update({
      where: { id: fr001.id },
      data: { parentId: bp001.id },
    });
    
    await prisma.orgUnit.update({
      where: { id: ce001.id },
      data: { parentId: fr001.id },
    });
    
    console.log('Updated parent relationships');
    
    // Link SUPERADMIN user to SA_ROOT
    await prisma.user.update({
      where: { id: superadmin.id },
      data: { orgUnitId: saRoot.id },
    });
    
    console.log(`Linked SA001 to SA_ROOT`);
    
    // Create users for each org unit
    console.log('\nCreating users for org units...');
    
    // Create Business Partner user
    const bpPasswordHash = await bcrypt.hash('Test@12345', saltRounds);
    const bpUser = await prisma.user.upsert({
      where: { username: 'BP001' },
      update: {},
      create: {
        username: 'BP001',
        passwordHash: bpPasswordHash,
        role: 'BUSINESS_PARTNER',
        orgUnitId: bp001.id,
      },
    });
    
    console.log(`Created/Updated BUSINESS_PARTNER user with id: ${bpUser.id}`);
    
    // Create Franchise user
    const frPasswordHash = await bcrypt.hash('Test@12345', saltRounds);
    const frUser = await prisma.user.upsert({
      where: { username: 'FR001' },
      update: {},
      create: {
        username: 'FR001',
        passwordHash: frPasswordHash,
        role: 'FRANCHISE',
        orgUnitId: fr001.id,
      },
    });
    
    console.log(`Created/Updated FRANCHISE user with id: ${frUser.id}`);
    
    // Create Center Manager user
    const cePasswordHash = await bcrypt.hash('Test@12345', saltRounds);
    const ceUser = await prisma.user.upsert({
      where: { username: 'CE001' },
      update: {},
      create: {
        username: 'CE001',
        passwordHash: cePasswordHash,
        role: 'CENTER_MANAGER',
        orgUnitId: ce001.id,
      },
    });
    
    console.log(`Created/Updated CENTER_MANAGER user with id: ${ceUser.id}`);
    
    // Link all existing Students to CE001
    const students = await prisma.student.findMany();
    console.log(`Found ${students.length} students to link to CE001`);
    
    for (const student of students) {
      await prisma.student.update({
        where: { id: student.id },
        data: { orgUnitId: ce001.id },
      });
      console.log(`Linked student ${student.code} to CE001`);
    }
    
    // Link all existing Enrollments to CE001
    const enrollments = await prisma.abacusEnrollment.findMany();
    console.log(`Found ${enrollments.length} enrollments to link to CE001`);
    
    for (const enrollment of enrollments) {
      await prisma.abacusEnrollment.update({
        where: { id: enrollment.id },
        data: { orgUnitId: ce001.id },
      });
      console.log(`Linked enrollment ${enrollment.id} to CE001`);
    }
    
    console.log('\nSeeded org units hierarchy:');
    console.log('SA_ROOT');
    console.log('  └── BP001 (Business Partner)');
    console.log('        └── FR001 (Franchise)');
    console.log('              └── CE001 (Center)');
    console.log('\nSeeded users:');
    console.log('- SA001 (SUPERADMIN) → SA_ROOT');
    console.log('- BP001 (BUSINESS_PARTNER) → BP001');
    console.log('- FR001 (FRANCHISE) → FR001');
    console.log('- CE001 (CENTER_MANAGER) → CE001');
    console.log(`\nLinked ${students.length} students and ${enrollments.length} enrollments to CE001`);
    
  } catch (error) {
    console.error('Error seeding org units:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedOrgUnits();