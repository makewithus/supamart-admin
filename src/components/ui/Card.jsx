import React from 'react';

export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-card p-6 ${hover ? 'transition-shadow duration-200 hover:shadow-card-hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
