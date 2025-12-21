import React from 'react';

interface StandardTableProps {
  headers: Array<{
    key: string;
    label: string;
    className?: string;
    sortable?: boolean;
  }>;
  data: any[];
  renderCell: (item: any, headerKey: string) => React.ReactNode;
  className?: string;
  sortConfig?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort?: (key: string) => void;
}

const StandardTable: React.FC<StandardTableProps> = ({
  headers,
  data,
  renderCell,
  className = '',
  sortConfig = null,
  onSort,
}) => {
  return (
    <div className={`card ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header.key}
                className={header.className || ''}
                onClick={header.sortable && onSort ? () => onSort(header.key) : undefined}
                style={{ cursor: header.sortable ? 'pointer' : 'default' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {header.label}
                  {header.sortable && sortConfig && sortConfig.key === header.key && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              {headers.map((header) => (
                <td key={header.key}>{renderCell(item, header.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
          No data available
        </div>
      )}
    </div>
  );
};

export default StandardTable;
