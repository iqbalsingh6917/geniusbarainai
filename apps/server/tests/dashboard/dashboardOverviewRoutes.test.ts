import { createTestApp, clearTestData, createTestUser, createTestOrgUnits } from '../utils/testUtils';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Dashboard Overview Routes', () => {
  const app = createTestApp();
  
  beforeAll(async () => {
    await clearTestData();
    await createTestOrgUnits();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /api/dashboard/center/overview', () => {
    it('should allow CENTER_MANAGER to access center overview', async () => {
      const centerUser = await createTestUser('CENTER_MANAGER');
      
      const response = await request(app)
        .get('/api/dashboard/center/overview')
        .set('x-test-user', JSON.stringify(centerUser))
        .expect(200);

      expect(response.body).toHaveProperty('leadFunnel');
      expect(response.body).toHaveProperty('leadConversionRate');
      expect(response.body).toHaveProperty('followUpsDueToday');
      expect(response.body).toHaveProperty('convertedLeads');
    });

    it('should deny access to TEACHER', async () => {
      const teacherUser = await createTestUser('TEACHER');
      
      await request(app)
        .get('/api/dashboard/center/overview')
        .set('x-test-user', JSON.stringify(teacherUser))
        .expect(403);
    });

    it('should deny access to COORDINATOR', async () => {
      const coordinatorUser = await createTestUser('COORDINATOR');
      
      await request(app)
        .get('/api/dashboard/center/overview')
        .set('x-test-user', JSON.stringify(coordinatorUser))
        .expect(403);
    });
  });

  describe('GET /api/dashboard/franchise/overview', () => {
    it('should allow FRANCHISE to access franchise overview', async () => {
      const franchiseUser = await createTestUser('FRANCHISE');
      
      const response = await request(app)
        .get('/api/dashboard/franchise/overview')
        .set('x-test-user', JSON.stringify(franchiseUser))
        .expect(200);

      expect(response.body).toHaveProperty('leadFunnel');
      expect(response.body).toHaveProperty('leadConversionRate');
      expect(response.body).toHaveProperty('centerLeaderboard');
      expect(response.body).toHaveProperty('stalledLeads');
    });

    it('should deny access to TEACHER', async () => {
      const teacherUser = await createTestUser('TEACHER');
      
      await request(app)
        .get('/api/dashboard/franchise/overview')
        .set('x-test-user', JSON.stringify(teacherUser))
        .expect(403);
    });

    it('should deny access to COORDINATOR', async () => {
      const coordinatorUser = await createTestUser('COORDINATOR');
      
      await request(app)
        .get('/api/dashboard/franchise/overview')
        .set('x-test-user', JSON.stringify(coordinatorUser))
        .expect(403);
    });
  });

  describe('GET /api/dashboard/bp/overview', () => {
    it('should allow BUSINESS_PARTNER to access BP overview', async () => {
      const bpUser = await createTestUser('BUSINESS_PARTNER');
      
      const response = await request(app)
        .get('/api/dashboard/bp/overview')
        .set('x-test-user', JSON.stringify(bpUser))
        .expect(200);

      expect(response.body).toHaveProperty('leadFunnel');
      expect(response.body).toHaveProperty('leadConversionRate');
    });

    it('should deny access to TEACHER', async () => {
      const teacherUser = await createTestUser('TEACHER');
      
      await request(app)
        .get('/api/dashboard/bp/overview')
        .set('x-test-user', JSON.stringify(teacherUser))
        .expect(403);
    });

    it('should deny access to COORDINATOR', async () => {
      const coordinatorUser = await createTestUser('COORDINATOR');
      
      await request(app)
        .get('/api/dashboard/bp/overview')
        .set('x-test-user', JSON.stringify(coordinatorUser))
        .expect(403);
    });
  });
});