/**
 * LoadingSpinner component for displaying loading states
 * Optimized for code splitting and lazy loading scenarios
 */
const LoadingSpinner = ({
  message = 'Loading...',
  size = 'medium',
  className = '',
  showMessage = true,
  variant = 'primary',
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  };

  const variantClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-[200px] ${className}`}>
      <div className='flex items-center space-x-3'>
        <div
          className={`animate-spin rounded-full border-2 border-gray-300 border-t-current ${sizeClasses[size]} ${variantClasses[variant]}`}
          role='status'
          aria-label='Loading'
        />
        {showMessage && (
          <span className={`text-sm font-medium ${variantClasses[variant]}`}>{message}</span>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
