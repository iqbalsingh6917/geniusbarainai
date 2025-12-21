import React from 'react';

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}

const ErrorCard: React.FC<ErrorCardProps> = ({ message, onRetry, actionLabel }) => {
  return (
    <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
      <div className="card-header">
        <div className="card-title">Something went wrong</div>
      </div>
      <div className="muted" style={{ marginBottom: '0.5rem' }}>{message}</div>
      {onRetry && (
        <button className="btn btn-primary btn-sm" onClick={onRetry}>
          {actionLabel || 'Try again'}
        </button>
      )}
    </div>
  );
};

export default ErrorCard;
