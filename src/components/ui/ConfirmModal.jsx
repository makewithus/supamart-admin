import React from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', isDestructive = true }) {
  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button 
        variant="primary" 
        onClick={() => {
          onConfirm();
          onClose();
        }}
        className={isDestructive ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' : ''}
      >
        {confirmText}
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" footer={footer}>
      <p className="text-neutral-600 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}
