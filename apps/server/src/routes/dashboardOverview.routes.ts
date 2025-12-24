import { Router } from 'express';
import prisma from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { getAllowedOrgUnitsForUser } from '../services/orgScopeEngine';
import { ok, fail } from '../utils/apiResponse';
import { 
  getLeadFunnelForScope, 
  getStalledLeadsForScope, 
  getConvertedLeadsForScope, 
  getFollowUpsDueTodayForScope, 
  getLeadConversionRateForScope 
} from '../modules/analytics/leadAnalytics.service';

const router = Router();

// GET /api/dashboard/center/overview
// Role: CENTER_MANAGER, ADMISSIONS
router.get('/center/overview', 
  requireAuth,
  requireRole(['CENTER_MANAGER', 'ADMISSIONS']),
  async (req: any, res: any) => {
    try {
      if (!req.user?.orgUnitId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
      }

      const allowedOrgUnits = await getAllowedOrgUnitsForUser(
        req.user.role, 
        req.user.orgUnitId, 
        req.user.id
      );

      // Get lead funnel for center scope
      const leadFunnel = await getLeadFunnelForScope({ allowedOrgUnits });
      
      // Get lead conversion rate
      const leadConversionRate = await getLeadConversionRateForScope(allowedOrgUnits);
      
      // Get follow-ups due today
      const followUpsDueToday = await getFollowUpsDueTodayForScope(allowedOrgUnits);
      
      // Get converted leads
      const convertedLeads = await getConvertedLeadsForScope(allowedOrgUnits);

      ok(res, {
        leadFunnel,
        leadConversionRate,
        followUpsDueToday,
        convertedLeads,
      });
    } catch (error) {
      console.error('Error fetching center overview:', error);
      fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }
);

// GET /api/dashboard/franchise/overview
// Role: FRANCHISE
router.get('/franchise/overview', 
  requireAuth,
  requireRole(['FRANCHISE']),
  async (req: any, res: any) => {
    try {
      if (!req.user?.orgUnitId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
      }

      const allowedOrgUnits = await getAllowedOrgUnitsForUser(
        req.user.role, 
        req.user.orgUnitId, 
        req.user.id
      );

      // Get lead funnel for franchise scope
      const leadFunnel = await getLeadFunnelForScope({ allowedOrgUnits });
      
      // Get lead conversion rate
      const leadConversionRate = await getLeadConversionRateForScope(allowedOrgUnits);
      
      // Get stalled leads
      const stalledLeads = await getStalledLeadsForScope(allowedOrgUnits);
      
      // Get center leaderboard data
      const centerLeaderboardQuery = `
        SELECT 
          o."code" as "centerCode",
          o."name" as "centerName",
          COUNT(l."id") as "totalLeads",
          COUNT(CASE WHEN l."stage" = 'CONVERTED' THEN 1 END) as "convertedLeads"
        FROM "OrgUnit" o
        LEFT JOIN "Lead" l ON o."id" = l."orgUnitId"
        WHERE o."type" = 'CENTER' AND o."parentId" = $1
        GROUP BY o."id", o."code", o."name"
        HAVING COUNT(l."id") > 0
        ORDER BY "convertedLeads" DESC NULLS LAST
        LIMIT 10
      `;
      
      const centerLeaderboardResult: any = await prisma.$queryRawUnsafe(centerLeaderboardQuery, req.user.orgUnitId);
      
      const centerLeaderboard = centerLeaderboardResult.map((row: any) => {
        const totalLeads = row.totalleads ? parseInt(row.totalleads.toString()) : 0;
        const convertedLeadsNum = row.convertedleads ? parseInt(row.convertedleads.toString()) : 0;
        const conversionRate = totalLeads > 0 ? parseFloat(((convertedLeadsNum / totalLeads) * 100).toFixed(2)) : 0;
        
        return {
          centerCode: row.centercode,
          centerName: row.centername,
          totalLeads,
          convertedLeads: convertedLeadsNum,
          conversionRate,
        };
      });

      ok(res, {
        leadFunnel,
        leadConversionRate,
        stalledLeads,
        centerLeaderboard,
      });
    } catch (error) {
      console.error('Error fetching franchise overview:', error);
      fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }
);

// GET /api/dashboard/bp/overview
// Role: BUSINESS_PARTNER
router.get('/bp/overview', 
  requireAuth,
  requireRole(['BUSINESS_PARTNER']),
  async (req: any, res: any) => {
    try {
      if (!req.user?.orgUnitId) {
        return fail(res, 400, 'VALIDATION_ERROR', 'User not associated with an organization unit');
      }

      const allowedOrgUnits = await getAllowedOrgUnitsForUser(
        req.user.role, 
        req.user.orgUnitId, 
        req.user.id
      );

      // Get lead funnel for BP scope
      const leadFunnel = await getLeadFunnelForScope({ allowedOrgUnits });
      
      // Get lead conversion rate
      const leadConversionRate = await getLeadConversionRateForScope(allowedOrgUnits);

      ok(res, {
        leadFunnel,
        leadConversionRate,
      });
    } catch (error) {
      console.error('Error fetching BP overview:', error);
      fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }
);

export default router;