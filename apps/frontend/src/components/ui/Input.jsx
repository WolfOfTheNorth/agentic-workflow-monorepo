export const Input = ({
  type = 'text',
  label,
  error,
  placeholder,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const baseStyles =
    'block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';
  const errorStyles = error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : '';

  const combinedClassName = `${baseStyles} ${errorStyles} ${className}`.trim();

  return (
    <div className='mb-4'>
      {label && (
        <label htmlFor={inputId} className='block text-sm font-medium text-gray-700 mb-1'>
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        className={combinedClassName}
        {...props}
      />
      {error && (
        <p className='mt-1 text-sm text-red-600' id={`${inputId}-error`}>
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
