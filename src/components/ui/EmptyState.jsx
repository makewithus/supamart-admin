import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', message, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-neutral-400" strokeWidth={1.5} />
      </div>
      <p className="text-base font-semibold text-primary-900 mb-1">{title}</p>
      {message && <p className="text-sm text-neutral-400 mb-6 max-w-xs">{message}</p>}
      {action && (
        <Button variant="outlined" size="sm" onClick={onAction}>{action}</Button>
      )}
    </div>
  );
}
