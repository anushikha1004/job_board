'use client';

import React from 'react';

export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizeClasses[size]} animate-spin`}>
      <div className="h-full w-full border-4 border-glass-border border-t-cyber-purple rounded-full" />
    </div>
  );
};

export const SkeletonCard: React.FC = () => (
  <div className="job-card animate-pulse">
    <div className="h-6 bg-glass-border rounded w-3/4 mb-2" />
    <div className="h-4 bg-glass-border rounded w-1/2 mb-4" />
    <div className="h-3 bg-glass-border rounded w-full mb-2" />
    <div className="h-3 bg-glass-border rounded w-5/6 mb-4" />
    <div className="flex gap-2 mb-4">
      <div className="h-6 bg-glass-border rounded-full w-16" />
      <div className="h-6 bg-glass-border rounded-full w-20" />
      <div className="h-6 bg-glass-border rounded-full w-16" />
    </div>
    <div className="flex justify-between items-center pt-4 border-t border-glass-border">
      <div className="h-5 bg-glass-border rounded w-1/3" />
      <div className="h-10 bg-glass-border rounded w-20" />
    </div>
  </div>
);

export const LoadingGrid: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);
