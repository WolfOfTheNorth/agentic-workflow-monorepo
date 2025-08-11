export const SimpleErrorDisplay = ({ error, onDismiss, className = '' }) => {
  if (!error) return null;

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md p-4 ${className}`} role='alert'>
      <div className='flex'>
        <svg
          className='h-5 w-5 text-red-400 mr-2'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2'
            d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
          />
        </svg>
        <div className='flex-1'>
          <h3 className='text-sm font-medium text-red-800'>Error</h3>
          <p className='text-sm text-red-700 mt-1'>{error}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className='text-red-600 hover:text-red-500 ml-2'
            aria-label='Dismiss error'
          >
            <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleErrorDisplay;
