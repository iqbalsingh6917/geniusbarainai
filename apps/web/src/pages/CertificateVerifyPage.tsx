import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Skeleton from '../components/ui/Skeleton';
import { formatDate } from '../utils/formatters';
import { parseErrorMessage } from '../utils/errorHandling';

interface CertificatePayload {
  certificateNumber: string;
  status: string;
  issuedOn: string;
  student: {
    name: string;
    code: string;
    org: string;
  };
  course: {
    code: string;
    name: string;
  };
  meta?: {
    lastAssessmentPercent?: number | null;
  };
}

const CertificateVerifyPage: React.FC = () => {
  const { number } = useParams<{ number: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CertificatePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/certificate/${number}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = body?.error?.message || 'Certificate not found';
          throw new Error(msg);
        }
        const payload = await res.json();
        setData((payload as any)?.data ?? payload);
        setError(null);
      } catch (err) {
        setError(parseErrorMessage(err, 'Certificate not found'));
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [number]);

  const onPrint = () => {
    window.print();
  };

  const onRetry = () => {
    navigate('/certificate/CERT-ST0001');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-lg shadow p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Certificate Verification</h1>
            <p className="text-sm text-gray-600">Enter via link /certificate/&lt;number&gt;</p>
          </div>
          <button
            className="btn btn-outline btn-sm print:hidden"
            onClick={() => navigate('/login')}
            aria-label="Go to login"
          >
            Back to login
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-6" />
            <Skeleton className="h-24" />
            <Skeleton className="h-20" />
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-200 bg-red-50 text-red-700 p-6 rounded">
            <h2 className="text-xl font-semibold mb-2">Certificate not found</h2>
            <p className="mb-4">{error}</p>
            <div className="flex gap-3">
              <button className="btn btn-primary btn-sm" onClick={onRetry}>
                Try demo cert
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>
                Go back
              </button>
            </div>
          </div>
        )}

        {!loading && data && (
          <div className="border border-green-200 bg-green-50 rounded p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Certificate Number</p>
                <p className="text-xl font-bold">{data.certificateNumber}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  data.status === 'VALID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {data.status === 'VALID' ? 'Valid' : 'Pending'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded border p-4">
                <p className="text-xs text-gray-500">Student</p>
                <p className="text-lg font-semibold">{data.student.name}</p>
                <p className="text-sm text-gray-600">Code: {data.student.code}</p>
                <p className="text-sm text-gray-600">Center: {data.student.org}</p>
              </div>
              <div className="bg-white rounded border p-4">
                <p className="text-xs text-gray-500">Course</p>
                <p className="text-lg font-semibold">{data.course.name}</p>
                <p className="text-sm text-gray-600">Code: {data.course.code}</p>
                <p className="text-sm text-gray-600">Issued on: {formatDate(data.issuedOn)}</p>
              </div>
            </div>
            {data.meta?.lastAssessmentPercent !== undefined && data.meta.lastAssessmentPercent !== null && (
              <div className="mt-4 text-sm text-gray-700">
                Last assessment score: {data.meta.lastAssessmentPercent}%
              </div>
            )}
            <div className="mt-6 flex gap-3 print:hidden">
              <button className="btn btn-primary btn-sm" onClick={onPrint}>
                Print / Save PDF
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigator.clipboard.writeText(window.location.href)}
              >
                Copy link
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateVerifyPage;
