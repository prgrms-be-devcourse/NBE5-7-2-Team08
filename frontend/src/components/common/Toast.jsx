import React from 'react';
import { FaExclamationCircle } from 'react-icons/fa';

const Toast = ({ open, message }) => {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '4px',
        fontSize: '14px',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <FaExclamationCircle size={16} />
      {message}
    </div>
  );
};

export default Toast;
