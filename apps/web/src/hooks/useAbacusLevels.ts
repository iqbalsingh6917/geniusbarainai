import { useState, useEffect } from 'react';

// Import types from the shared types package
import { AbacusLevel, AbacusWorksheet } from '@lms/types';
import { apiClient } from '../utils/apiClient';

export const useAbacusLevels = () => {
  const [levels, setLevels] = useState<AbacusLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLevels();
  }, []);

  const fetchLevels = async (params?: { courseCode?: string; moduleId?: number }) => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/superadmin/abacus-levels';
      
      // Add query parameters if provided
      if (params) {
        const queryParams = new URLSearchParams();
        if (params.courseCode) queryParams.append('courseCode', params.courseCode);
        if (params.moduleId) queryParams.append('moduleId', params.moduleId.toString());
        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }
      }
      
      console.log('Fetching levels from:', url);
      
      const data = await apiClient.get(url);
      console.log('Received levels data:', data);
      setLevels(data);
    } catch (err) {
      console.error('Error fetching levels:', err);
      setError('An error occurred while fetching levels: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createLevel = async (levelData: Omit<AbacusLevel, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await apiClient.post('/superadmin/abacus-levels', levelData);
      await fetchLevels(); // Refresh the list
      return true;
    } catch (err) {
      setError('An error occurred while creating level');
      return false;
    }
  };

  const updateLevel = async (id: number, levelData: Partial<Omit<AbacusLevel, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      await apiClient.put(`/superadmin/abacus-levels/${id}`, levelData);
      await fetchLevels(); // Refresh the list
      return true;
    } catch (err) {
      setError('An error occurred while updating level');
      return false;
    }
  };

  const deleteLevel = async (id: number) => {
    try {
      await apiClient.delete(`/superadmin/abacus-levels/${id}`);
      await fetchLevels(); // Refresh the list
      return true;
    } catch (err) {
      setError('An error occurred while deleting level');
      return false;
    }
  };

  return {
    levels,
    loading,
    error,
    createLevel,
    updateLevel,
    deleteLevel,
    refetch: fetchLevels,
  };
};

// Add a new hook for worksheets
export const useAbacusWorksheets = () => {
  const [worksheets, setWorksheets] = useState<AbacusWorksheet[]>([]);
  const [loading, setLoading] = useState(false); // Initialize to false instead of true
  const [error, setError] = useState<string | null>(null);

  const fetchWorksheets = async (levelId: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await apiClient.get(`/superadmin/abacus-worksheets/abacus-levels/${levelId}/worksheets`);
      setWorksheets(data);
    } catch (err) {
      setError('An error occurred while fetching worksheets');
    } finally {
      setLoading(false);
    }
  };

  const createWorksheet = async (worksheetData: Omit<AbacusWorksheet, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const data = await apiClient.post('/superadmin/abacus-worksheets/worksheets', worksheetData);
      return data;
    } catch (err) {
      setError('An error occurred while creating worksheet');
      return null;
    }
  };

  const updateWorksheet = async (id: number, worksheetData: Partial<Omit<AbacusWorksheet, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const data = await apiClient.put(`/superadmin/abacus-worksheets/worksheets/${id}`, worksheetData);
      return data;
    } catch (err) {
      setError('An error occurred while updating worksheet');
      return null;
    }
  };

  const deleteWorksheet = async (id: number) => {
    try {
      await apiClient.delete(`/superadmin/abacus-worksheets/worksheets/${id}`);
      return true;
    } catch (err) {
      setError('An error occurred while deleting worksheet');
      return false;
    }
  };

  return {
    worksheets,
    loading,
    error,
    fetchWorksheets,
    createWorksheet,
    updateWorksheet,
    deleteWorksheet,
  };
};