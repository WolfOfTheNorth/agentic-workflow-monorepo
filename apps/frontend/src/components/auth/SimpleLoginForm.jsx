import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SimpleErrorDisplay } from './SimpleErrorDisplay';
import { useAuthContext } from '../../contexts/MockAuthContext';

export const SimpleLoginForm = ({ onSuccess, onError, onForgotPassword, onSignupClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const { login, isLoading, error } = useAuthContext();

  const handleSubmit = async e => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const response = await login({ email, password });

      if (response.success) {
        onSuccess?.(response);
      } else {
        onError?.(response.error || 'Login failed');
      }
    } catch (err) {
      onError?.(err.message || 'Login failed');
    }
  };

  return (
    <div className='max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold text-gray-900 mb-2'>Welcome back</h2>
        <p className='text-gray-600'>Sign in to your account</p>
      </div>

      <SimpleErrorDisplay error={error} />

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

        <Input
          type='password'
          label='Password'
          placeholder='••••••••'
          value={password}
          onChange={e => setPassword(e.target.value)}
          error={errors.password}
          autoComplete='current-password'
          required
        />

        <div className='flex items-center justify-between'>
          <div className='text-sm'>
            <button
              type='button'
              onClick={onForgotPassword}
              className='font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline'
            >
              Forgot your password?
            </button>
          </div>
        </div>

        <Button
          type='submit'
          variant='primary'
          size='lg'
          className='w-full'
          isLoading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>

        <div className='text-center'>
          <p className='text-sm text-gray-600'>
            Don&apos;t have an account?{' '}
            <button
              type='button'
              onClick={onSignupClick}
              className='font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline'
            >
              Sign up
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default SimpleLoginForm;
