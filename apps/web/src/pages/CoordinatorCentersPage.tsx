import React, { useState, useEffect } from 'react';
import { CoordinatorCenter, fetchCoordinatorCenters } from '../api/coordinatorClient';
import Skeleton from '../components/ui/Skeleton';

const CoordinatorCentersPage: React.FC = () => {
  const [centers, setCenters] = useState<CoordinatorCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCenters = async () => {
      try {
        setLoading(true);
        const data = await fetchCoordinatorCenters();
        setCenters(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load centers', err);
        setError('Failed to load centers');
      } finally {
        setLoading(false);
      }
    };

    loadCenters();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Centers</h1>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Centers</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Centers</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {centers.map((center) => (
              <tr key={center.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.code}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{center.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{center.parentName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {centers.length === 0 && (
        <div className="mt-4 text-center text-gray-500">
          No centers found for your assigned organization units.
        </div>
      )}
    </div>
  );
};

export default CoordinatorCentersPage;