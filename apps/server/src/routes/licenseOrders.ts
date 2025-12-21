import { Router, Response } from 'express';
import prisma from '../prismaClient';
import { authRequired, superadminOnly, AuthRequest } from '../middleware/auth';
import { ok, fail } from '../utils/apiResponse';
import { addSeatsFromPaidOrder } from '../services/licensingService';

const router = Router();

// GET /superadmin/license-orders
router.get('/superadmin/license-orders', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status, courseCode, buyerOrgUnitId } = req.query;
    const filters: any = {};
    if (status) filters.status = String(status);
    if (courseCode) filters.courseCode = String(courseCode);
    if (buyerOrgUnitId) {
      const parsed = Number(buyerOrgUnitId);
      if (!Number.isNaN(parsed)) {
        filters.buyerOrgUnitId = parsed;
      }
    }

    const orders = await prisma.licenseOrder.findMany({
      where: filters,
      include: {
        buyerOrgUnit: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    ok(res, orders);
  } catch (err) {
    console.error('Error fetching license orders:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// GET /superadmin/license-orders/:id
router.get('/superadmin/license-orders/:id', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.licenseOrder.findUnique({
      where: { id },
      include: {
        buyerOrgUnit: true,
      },
    });
    if (!order) {
      return fail(res, 404, 'NOT_FOUND', 'License order not found');
    }
    ok(res, order);
  } catch (err) {
    console.error('Error fetching license order:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// POST /superadmin/license-orders
router.post('/superadmin/license-orders', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
  const { buyerOrgUnitId, courseCode, seatQuantity, unitPrice, currency, status } = req.body || {};

    if (!buyerOrgUnitId || !courseCode || seatQuantity === undefined || unitPrice === undefined) {
      return fail(res, 400, 'VALIDATION_ERROR', 'buyerOrgUnitId, courseCode, seatQuantity, unitPrice are required');
    }

    if (Number(seatQuantity) <= 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'seatQuantity must be greater than 0');
    }

    const buyerOrgIdNum = Number(buyerOrgUnitId);
    const seatQtyNum = Number(seatQuantity);
    const unitPriceNum = Number(unitPrice);
    const totalPrice = seatQtyNum * unitPriceNum;

    const order = await prisma.licenseOrder.create({
      data: {
        buyerOrgUnitId: buyerOrgIdNum,
        courseCode: String(courseCode),
        seatQuantity: seatQtyNum,
        unitPrice: unitPriceNum,
        currency: currency || 'INR',
        totalPrice,
        status: status || 'PENDING',
      },
      include: {
        buyerOrgUnit: true,
      },
    });

    if ((status || 'PENDING') === 'PAID') {
      await addSeatsFromPaidOrder(order.buyerOrgUnitId, order.courseCode, order.seatQuantity);
    }

    ok(res, order, 201);
  } catch (err) {
    console.error('Error creating license order:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// PUT /superadmin/license-orders/:id
router.put('/superadmin/license-orders/:id', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.licenseOrder.findUnique({ where: { id } });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'License order not found');
    }

    const { seatQuantity, unitPrice, currency, status } = req.body || {};
    const updateData: any = {};

    if (seatQuantity !== undefined) {
      if (Number(seatQuantity) <= 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'seatQuantity must be greater than 0');
      }
      updateData.seatQuantity = Number(seatQuantity);
    }

    if (unitPrice !== undefined) {
      if (Number(unitPrice) < 0) {
        return fail(res, 400, 'VALIDATION_ERROR', 'unitPrice must be non-negative');
      }
      updateData.unitPrice = Number(unitPrice);
    }

    if (currency !== undefined) {
      updateData.currency = String(currency);
    }

    if (status !== undefined) {
      updateData.status = String(status);
    }

    if (updateData.seatQuantity !== undefined || updateData.unitPrice !== undefined) {
      const seatQty = updateData.seatQuantity ?? existing.seatQuantity;
      const unit = updateData.unitPrice ?? existing.unitPrice;
      updateData.totalPrice = seatQty * unit;
    }

    const updated = await prisma.licenseOrder.update({
      where: { id },
      data: updateData,
      include: {
        buyerOrgUnit: true,
      },
    });

    if (existing.status !== 'PAID' && updated.status === 'PAID') {
      await addSeatsFromPaidOrder(updated.buyerOrgUnitId, updated.courseCode, updated.seatQuantity);
    }

    ok(res, updated);
  } catch (err) {
    console.error('Error updating license order:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

// DELETE /superadmin/license-orders/:id
router.delete('/superadmin/license-orders/:id', authRequired, superadminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.licenseOrder.findUnique({ where: { id } });
    if (!existing) {
      return fail(res, 404, 'NOT_FOUND', 'License order not found');
    }

    await prisma.licenseOrder.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting license order:', err);
    fail(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
