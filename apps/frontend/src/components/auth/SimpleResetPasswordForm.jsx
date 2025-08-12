import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuthContext } from '../../contexts/MockAuthContext';

export const SimpleResetPasswordForm = ({ onSuccess, onError, onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const { resetPassword, isLoading, error } = useAuthContext();

  const handleSubmit = async e => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    if (!email) {
      setErrors({ email: 'Email is required' });
      return;
    }

    try {
      await resetPassword(email);
      setIsSubmitted(true);
      onSuccess?.();
    } catch (err) {
      onError?.(err.message || 'Reset password failed');
    }
  };

  if (isSubmitted) {
    return (
      <div className='max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-8'>
        <div className='text-center'>
          <div className='mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4'>
            <svg
              className='h-8 w-8 text-green-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M5 13l4 4L19 7'
              />
            </svg>
          </div>
          <h2 className='text-3xl font-bold text-gray-900 mb-2'>Check your email</h2>
          <p className='text-gray-600 mb-6'>We&apos;ve sent a password reset link to {email}</p>
          <Button onClick={onBackToLogin} variant='outline' size='lg' className='w-full'>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold text-gray-900 mb-2'>Reset password</h2>
        <p className='text-gray-600'>Enter your email to receive a reset link</p>
      </div>

      {error && (
        <div className='bg-red-50 border border-red-200 rounded-md p-4'>
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
            <div>
              <h3 className='text-sm font-medium text-red-800'>Reset Error</h3>
              <p className='text-sm text-red-700 mt-1'>{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6'>
        <Input
          type='email'
          label='Email address'
          placeholder='you@example.com'
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={errors.email}
          autoComplete='email'
          required
        />

        <Button
          type='submit'
          variant='primary'
          size='lg'
          className='w-full'
          isLoading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Sending...' : 'Send reset link'}
        </Button>

        <div className='text-center'>
          <button
            type='button'
            onClick={onBackToLogin}
            className='font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline'
          >
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
};

export default SimpleResetPasswordForm;
