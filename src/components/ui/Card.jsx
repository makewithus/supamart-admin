import React from 'react';

export default function Card({ children, className = '', hover = false, style }) {
  return (
    <div
      style={style}
      className={`bg-white rounded-2xl border border-gray-100 shadow-2xs p-6 ${hover ? 'transition-shadow duration-200 hover:shadow-md hover:border-gray-200' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
