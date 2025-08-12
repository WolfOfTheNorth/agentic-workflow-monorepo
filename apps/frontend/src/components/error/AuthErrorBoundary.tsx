import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export interface AuthErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

export class AuthErrorBoundary extends Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  private retryTimeoutId: number | null = null;

  constructor(props: AuthErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AuthErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Auth Error Boundary caught an error:', error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for monitoring (in production, this would go to error tracking service)
    this.logError(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    // In production, this would send to error tracking service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    console.error('Authentication Error Log:', errorData);
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;

    if (this.state.retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached for auth error boundary`);
      return;
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      return (
        <div
          className='auth-error-boundary'
          role='alert'
          aria-live='assertive'
          style={{
            padding: '20px',
            margin: '20px',
            border: '1px solid #dc3545',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
          }}
        >
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Authentication Error
          </h2>

          <p style={{ margin: '0 0 16px 0' }}>
            Something went wrong with the authentication system. This could be due to:
          </p>

          <ul style={{ margin: '0 0 16px 0', paddingLeft: '20px' }}>
            <li>Network connectivity issues</li>
            <li>Server-side authentication problems</li>
            <li>Browser storage limitations</li>
            <li>Session expiration</li>
          </ul>

          <div style={{ marginBottom: '16px' }}>
            <strong>Error:</strong> {this.state.error.message}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleRetry}
              disabled={this.state.retryCount >= (this.props.maxRetries || 3)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor:
                  this.state.retryCount >= (this.props.maxRetries || 3) ? 'not-allowed' : 'pointer',
                opacity: this.state.retryCount >= (this.props.maxRetries || 3) ? 0.6 : 1,
              }}
            >
              Retry ({this.state.retryCount}/{this.props.maxRetries || 3})
            </button>

            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ marginTop: '16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Development Details
              </summary>
              <pre
                style={{
                  margin: '8px 0 0 0',
                  padding: '8px',
                  backgroundColor: '#f1f3f4',
                  borderRadius: '4px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}
              >
                {this.state.error.stack}
                {'\n\nComponent Stack:'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error handler for functional components
export interface UseAuthErrorHandlerOptions {
  onError?: (error: Error) => void;
  maxRetries?: number;
}

export function useAuthErrorHandler(options: UseAuthErrorHandlerOptions = {}) {
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const handleError = React.useCallback(
    (error: Error) => {
      console.error('Auth error handled:', error);
      setError(error);

      if (options.onError) {
        options.onError(error);
      }
    },
    [options]
  );

  const retry = React.useCallback(() => {
    const maxRetries = options.maxRetries || 3;

    if (retryCount >= maxRetries) {
      console.warn(`Max retries (${maxRetries}) reached`);
      return false;
    }

    setError(null);
    setRetryCount(prev => prev + 1);
    return true;
  }, [retryCount, options.maxRetries]);

  const reset = React.useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    error,
    retryCount,
    maxRetries: options.maxRetries || 3,
    handleError,
    retry,
    reset,
    hasError: error !== null,
    canRetry: retryCount < (options.maxRetries || 3),
  };
}
