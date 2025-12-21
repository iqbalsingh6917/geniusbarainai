import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient';

interface OrgUnit {
  id: number;
  code: string;
  name: string;
  type: string;
  parentId: number | null;
}

const OrgManagement: React.FC = () => {
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgUnits();
  }, []);

  const fetchOrgUnits = async () => {
    try {
      setLoading(true);
      // For now, we'll fetch all org units
      // In a real implementation, we might want to fetch the org hierarchy
      const data = await apiClient.get('/api/org/units');
      setOrgUnits(data);
      setError(null);
    } catch (err) {
      setError('Failed to load organization units');
      console.error('Error fetching org units:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading organization data...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Organization Management</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Organization Units</h2>
        
        {orgUnits.length === 0 ? (
          <p>No organization units found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border-b text-left">Code</th>
                  <th className="py-2 px-4 border-b text-left">Name</th>
                  <th className="py-2 px-4 border-b text-left">Type</th>
                  <th className="py-2 px-4 border-b text-left">Parent</th>
                </tr>
              </thead>
              <tbody>
                {orgUnits.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 border-b">{unit.code}</td>
                    <td className="py-2 px-4 border-b">{unit.name}</td>
                    <td className="py-2 px-4 border-b">{unit.type}</td>
                    <td className="py-2 px-4 border-b">
                      {unit.parentId ? orgUnits.find(u => u.id === unit.parentId)?.code : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Organization Hierarchy</h3>
        <p className="text-gray-700">
          Current hierarchy: SA_ROOT → BP001 → FR001 → CE001
        </p>
        <p className="text-gray-700 mt-2">
          This page would typically show a visual representation of the organization hierarchy 
          and allow administrators to manage org units, but that functionality is not yet implemented.
        </p>
      </div>
    </div>
  );
};

export default OrgManagement;