import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SimpleErrorDisplay } from './SimpleErrorDisplay';
import { useAuthContext } from '../../contexts/MockAuthContext';

export const SimpleSignupForm = ({ onSuccess, onError, onLoginClick }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const { signup, isLoading, error } = useAuthContext();

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (formData.password && formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const response = await signup({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (response.success) {
        onSuccess?.(response);
      } else {
        onError?.(response.error || 'Signup failed');
      }
    } catch (err) {
      onError?.(err.message || 'Signup failed');
    }
  };

  return (
    <div className='max-w-md w-full space-y-8 bg-white rounded-xl shadow-lg p-8'>
      <div className='text-center'>
        <h2 className='text-3xl font-bold text-gray-900 mb-2'>Create account</h2>
        <p className='text-gray-600'>Join Agentic Workflow today</p>
      </div>

      <SimpleErrorDisplay error={error} />

      <form onSubmit={handleSubmit} className='space-y-6'>
        <Input
          type='text'
          name='name'
          label='Full name'
          placeholder='John Doe'
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          autoComplete='name'
          required
        />

        <Input
          type='email'
          name='email'
          label='Email address'
          placeholder='you@example.com'
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          autoComplete='email'
          required
        />

        <Input
          type='password'
          name='password'
          label='Password'
          placeholder='••••••••'
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          autoComplete='new-password'
          required
        />

        <Input
          type='password'
          name='confirmPassword'
          label='Confirm password'
          placeholder='••••••••'
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          autoComplete='new-password'
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
          {isLoading ? 'Creating account...' : 'Create account'}
        </Button>

        <div className='text-center'>
          <p className='text-sm text-gray-600'>
            Already have an account?{' '}
            <button
              type='button'
              onClick={onLoginClick}
              className='font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline'
            >
              Sign in
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};

export default SimpleSignupForm;
