import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled';
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

const variantStyles = {
  default: 'border border-gray-300 bg-white focus:border-blue-500 focus:bg-white',
  filled: 'border-0 bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500',
};

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  variant = 'default',
  size = 'md',
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const baseStyles =
    'w-full rounded-md shadow-sm focus:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeClasses = sizeStyles[size];
  const variantClasses = variantStyles[variant];
  const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : '';

  const combinedClassName =
    `${baseStyles} ${variantClasses} ${sizeClasses} ${errorClasses} ${className}`.trim();

  return (
    <div className='w-full'>
      {label && (
        <label htmlFor={inputId} className='block text-sm font-medium text-gray-700 mb-1'>
          {label}
        </label>
      )}
      <input id={inputId} className={combinedClassName} {...props} />
      {error && <p className='mt-1 text-sm text-red-600'>{error}</p>}
      {helperText && !error && <p className='mt-1 text-sm text-gray-500'>{helperText}</p>}
    </div>
  );
};
