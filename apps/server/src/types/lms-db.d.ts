declare module '@lms/db' {
  import { PrismaClient } from '@prisma/client';
  const prisma: PrismaClient;
  export { prisma };
}
