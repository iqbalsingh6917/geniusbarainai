import { apiClient } from '../utils/apiClient';

export interface CreateSeatAllocationPayload {
  parentOrgUnitId: number;
  childOrgUnitId: number;
  courseCode: string;
  allocatedSeats: number;
}

export interface SeatAllocationResponse {
  allocation: {
    id: string | number;
    parentOrgUnitId: number;
    childOrgUnitId: number;
    courseCode: string;
    allocatedSeats: number;
    createdAt: string;
  };
  parentLicenseSummary?: {
    totalSeats: number;
    usedSeats: number;
    alreadyAllocatedOut: number;
    remainingSeatsAfterAllocation: number;
  };
}

export async function createSeatAllocation(
  payload: CreateSeatAllocationPayload
): Promise<SeatAllocationResponse> {
  const res = await apiClient.post('/api/superadmin/licensing/allocations', payload);
  return res;
}
