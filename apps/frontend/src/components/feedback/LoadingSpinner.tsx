import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
  label?: string;
  inline?: boolean;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const colorClasses = {
  primary: 'text-blue-600',
  secondary: 'text-gray-600',
  white: 'text-white',
  gray: 'text-gray-400',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className = '',
  label = 'Loading...',
  inline = false,
}) => {
  const spinnerClasses = `
    animate-spin rounded-full border-2 border-current border-t-transparent
    ${sizeClasses[size]} ${colorClasses[color]} ${className}
  `.trim();

  const containerClasses = inline ? 'inline-flex items-center' : 'flex items-center justify-center';

  return (
    <div className={containerClasses} role='status' aria-label={label}>
      <div className={spinnerClasses} aria-hidden='true' />
      {!inline && <span className='sr-only'>{label}</span>}
    </div>
  );
};

// Preset spinner components for common use cases
export const ButtonSpinner: React.FC<{ className?: string }> = ({ className = '' }) => (
  <LoadingSpinner size='sm' color='white' inline className={`mr-2 ${className}`} />
);

export const PageSpinner: React.FC<{ label?: string; className?: string }> = ({
  label = 'Loading page...',
  className = '',
}) => (
  <div className={`min-h-[200px] flex items-center justify-center ${className}`}>
    <div className='text-center'>
      <LoadingSpinner size='lg' color='primary' label={label} />
      <p className='mt-4 text-gray-600'>{label}</p>
    </div>
  </div>
);

export const InlineSpinner: React.FC<{
  size?: LoadingSpinnerProps['size'];
  color?: LoadingSpinnerProps['color'];
  className?: string;
}> = ({ size = 'sm', color = 'primary', className = '' }) => (
  <LoadingSpinner size={size} color={color} inline className={className} />
);

export default LoadingSpinner;
