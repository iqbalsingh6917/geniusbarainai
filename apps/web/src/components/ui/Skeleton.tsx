import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '',
  width,
  height,
  rounded = true
}) => {
  const style: React.CSSProperties = {};
  
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`
        bg-gray-200 animate-pulse
        ${rounded ? 'rounded' : ''}
        ${className}
      `}
      style={style}
    />
  );
};

export default Skeleton;