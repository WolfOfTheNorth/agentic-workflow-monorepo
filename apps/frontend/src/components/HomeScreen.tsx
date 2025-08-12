import React, { useEffect } from 'react';
import { Button } from './ui/Button';
import { useAuthContextSafe } from '../contexts/MockAuthContext';

export interface HomeScreenProps {
  onLoginClick?: () => void;
  onSignupClick?: () => void;
  onDashboardRedirect?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onLoginClick,
  onSignupClick,
  onDashboardRedirect,
}) => {
  const auth = useAuthContextSafe();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (auth?.isAuthenticated && !auth.isLoading && onDashboardRedirect) {
      onDashboardRedirect();
    }
  }, [auth?.isAuthenticated, auth?.isLoading, onDashboardRedirect]);

  // Show loading state during initialization
  if (!auth || auth?.isInitializing) {
    return (
      <div
        className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100'
        role='main'
        aria-label='Loading application'
      >
        <div className='text-center'>
          <div
            className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'
            aria-hidden='true'
          />
          <p className='text-gray-600 text-lg'>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render home screen if user is authenticated (should redirect)
  if (auth?.isAuthenticated) {
    return null;
  }

  return (
    <div
      className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8 py-8'
      role='main'
    >
      <div className='max-w-md w-full space-y-6 sm:space-y-8 bg-white rounded-xl shadow-lg p-6 sm:p-8'>
        {/* Header */}
        <div className='text-center'>
          <div className='mx-auto h-14 w-14 sm:h-16 sm:w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4'>
            <svg
              className='h-7 w-7 sm:h-8 sm:w-8 text-white'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
              aria-hidden='true'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M13 10V3L4 14h7v7l9-11h-7z'
              />
            </svg>
          </div>

          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2'>
            Welcome to Agentic Workflow
          </h1>

          <p className='text-base sm:text-lg text-gray-600'>
            Your AI-powered productivity platform
          </p>
        </div>

        {/* Features */}
        <div className='space-y-3 sm:space-y-4'>
          <div className='text-center text-gray-700'>
            <h2 className='text-base sm:text-lg font-semibold mb-3'>Get started today</h2>
            <ul className='space-y-2 text-sm'>
              <li className='flex items-center justify-center'>
                <svg
                  className='h-4 w-4 text-green-500 mr-2 flex-shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
                Automate your workflows
              </li>
              <li className='flex items-center justify-center'>
                <svg
                  className='h-4 w-4 text-green-500 mr-2 flex-shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
                AI-powered assistance
              </li>
              <li className='flex items-center justify-center'>
                <svg
                  className='h-4 w-4 text-green-500 mr-2 flex-shrink-0'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M5 13l4 4L19 7'
                  />
                </svg>
                Secure and reliable
              </li>
            </ul>
          </div>
        </div>

        {/* Error Display */}
        {auth?.error && (
          <div
            className='bg-red-50 border border-red-200 rounded-md p-3 sm:p-4'
            role='alert'
            aria-live='polite'
          >
            <div className='flex'>
              <svg
                className='h-5 w-5 text-red-400 mr-2 mt-0.5'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
              <div>
                <h3 className='text-sm font-medium text-red-800'>Authentication Error</h3>
                <p className='text-sm text-red-700 mt-1'>{auth.error}</p>
                {auth.clearError && (
                  <button
                    onClick={auth.clearError}
                    className='text-sm text-red-600 hover:text-red-500 underline mt-2 touch-manipulation'
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className='space-y-4'>
          <div className='space-y-3'>
            <Button
              onClick={onLoginClick}
              variant='primary'
              size='lg'
              className='w-full min-h-[48px] touch-manipulation'
              disabled={auth?.isLoading}
              isLoading={auth?.isLoading}
            >
              Sign In
            </Button>

            <Button
              onClick={onSignupClick}
              variant='outline'
              size='lg'
              className='w-full min-h-[48px] touch-manipulation'
              disabled={auth?.isLoading}
            >
              Create Account
            </Button>
          </div>

          <div className='text-center'>
            <p className='text-sm text-gray-500 leading-relaxed'>
              New to Agentic Workflow?{' '}
              <button
                onClick={onSignupClick}
                className='font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline transition-colors touch-manipulation py-1'
                disabled={auth?.isLoading}
              >
                Get started for free
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className='text-center pt-4 border-t border-gray-200'>
          <p className='text-xs text-gray-500 leading-relaxed px-2'>
            By signing in, you agree to our{' '}
            <a
              href='/terms'
              className='text-blue-600 hover:text-blue-500 underline touch-manipulation'
              target='_blank'
              rel='noopener noreferrer'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='text-blue-600 hover:text-blue-500 underline touch-manipulation'
              target='_blank'
              rel='noopener noreferrer'
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
