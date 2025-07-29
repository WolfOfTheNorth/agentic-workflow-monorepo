/**
 * Comprehensive Tests for Data Transformation Utilities
 *
 * Task 16: Test data transformation functions with various input scenarios
 * - Test edge cases and boundary conditions
 * - Validate error handling in transformations
 * - Test performance with large datasets
 * - Validate type safety and data integrity
 */

import { User, Session, AuthError } from '@supabase/supabase-js';
import {
  mapSupabaseUserToProfile,
  mapSupabaseSessionToLogin,
  mapSupabaseSessionToRegister,
  mapSupabaseSessionToRefresh,
  mapSupabaseErrorToApiError,
  mapGenericErrorToApiError,
  transformRegistrationMetadata,
  transformProfileUpdateData,
  validateSessionData,
  validateUserData,
  extractErrorMessage,
  isNetworkError,
  isRateLimitError,
  TransformationError,
  TypeGuards,
  TransformationConstants,
} from '../transformers';

describe('User Transformation', () => {
  const mockUser: User = {
    id: '123',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: '2023-01-01T00:00:00Z',
    phone: '',
    confirmed_at: '2023-01-01T00:00:00Z',
    last_sign_in_at: '2023-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: {
      name: 'Test User',
      full_name: 'Test User Full',
    },
    identities: [],
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T12:00:00Z',
  };

  describe('mapSupabaseUserToProfile', () => {
    it('should transform user with name in metadata', () => {
      const result = mapSupabaseUserToProfile(mockUser);

      expect(result).toEqual({
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      });
    });

    it('should fallback to full_name when name is not available', () => {
      const userWithFullName = {
        ...mockUser,
        user_metadata: { full_name: 'Full Name Only' },
      };

      const result = mapSupabaseUserToProfile(userWithFullName);
      expect(result.name).toBe('Full Name Only');
    });

    it('should handle empty metadata gracefully', () => {
      const userWithoutMetadata = {
        ...mockUser,
        user_metadata: {},
      };

      const result = mapSupabaseUserToProfile(userWithoutMetadata);
      expect(result.name).toBe('');
    });

    it('should handle missing email', () => {
      const userWithoutEmail = {
        ...mockUser,
        email: undefined,
      } as User;

      const result = mapSupabaseUserToProfile(userWithoutEmail);
      expect(result.email).toBe('');
    });
  });
});

describe('Session Transformation', () => {
  const mockSession: Session = {
    access_token: 'access-token-123',
    refresh_token: 'refresh-token-123',
    expires_in: 3600,
    expires_at: 1640995200,
    token_type: 'bearer',
    user: {
      id: '123',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'test@example.com',
      email_confirmed_at: '2023-01-01T00:00:00Z',
      phone: '',
      confirmed_at: '2023-01-01T00:00:00Z',
      last_sign_in_at: '2023-01-01T00:00:00Z',
      app_metadata: {},
      user_metadata: { name: 'Test User' },
      identities: [],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T12:00:00Z',
    },
  };

  describe('mapSupabaseSessionToLogin', () => {
    it('should transform complete session to login response', () => {
      const result = mapSupabaseSessionToLogin(mockSession);

      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T12:00:00Z',
        },
      });
    });

    it('should use default expiry when not provided', () => {
      const sessionWithoutExpiry = {
        ...mockSession,
        expires_in: 0,
      } as Session;

      const result = mapSupabaseSessionToLogin(sessionWithoutExpiry);
      expect(result.expires_in).toBe(3600);
    });

    it('should throw error when user is missing', () => {
      const sessionWithoutUser = {
        ...mockSession,
        user: undefined,
      } as any;

      expect(() => mapSupabaseSessionToLogin(sessionWithoutUser)).toThrow(TransformationError);
      expect(() => mapSupabaseSessionToLogin(sessionWithoutUser)).toThrow(
        'Invalid session: missing user data'
      );
    });

    it('should throw error when tokens are missing', () => {
      const sessionWithoutTokens = {
        ...mockSession,
        access_token: undefined,
        refresh_token: undefined,
      } as any;

      expect(() => mapSupabaseSessionToLogin(sessionWithoutTokens)).toThrow(TransformationError);
      expect(() => mapSupabaseSessionToLogin(sessionWithoutTokens)).toThrow(
        'Invalid session: missing tokens'
      );
    });
  });

  describe('mapSupabaseSessionToRegister', () => {
    it('should transform session to register response', () => {
      const result = mapSupabaseSessionToRegister(mockSession);

      // RegisterResponse extends LoginResponse
      expect(result).toEqual({
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 3600,
        user: expect.objectContaining({
          id: '123',
          email: 'test@example.com',
        }),
      });
    });
  });

  describe('mapSupabaseSessionToRefresh', () => {
    it('should transform session to refresh response', () => {
      const result = mapSupabaseSessionToRefresh(mockSession);

      expect(result).toEqual({
        access_token: 'access-token-123',
        expires_in: 3600,
      });
    });

    it('should throw error when access token is missing', () => {
      const sessionWithoutAccess = {
        ...mockSession,
        access_token: undefined,
      } as any;

      expect(() => mapSupabaseSessionToRefresh(sessionWithoutAccess)).toThrow(TransformationError);
      expect(() => mapSupabaseSessionToRefresh(sessionWithoutAccess)).toThrow(
        'Invalid session: missing access token'
      );
    });
  });
});

describe('Error Transformation', () => {
  describe('mapSupabaseErrorToApiError', () => {
    it('should map known auth errors correctly', () => {
      const authError = {
        name: 'AuthError',
        message: 'invalid_credentials',
        status: 401,
        code: 'invalid_credentials',
        __isAuthError: true,
      } as unknown as AuthError;

      const result = mapSupabaseErrorToApiError(authError);

      expect(result).toEqual({
        message: 'Invalid email or password',
        status: 401,
        code: 'invalid_credentials',
        details: {
          supabaseError: 'invalid_credentials',
          originalStatus: 401,
        },
      });
    });

    it('should handle unknown errors with generic mapping', () => {
      const unknownError = {
        name: 'AuthError',
        message: 'unknown_error_type',
        status: 500,
        code: 'unknown_error_type',
        __isAuthError: true,
      } as unknown as AuthError;

      const result = mapSupabaseErrorToApiError(unknownError);

      expect(result.message).toBe('unknown_error_type');
      expect(result.status).toBe(500);
      expect(result.code).toBe('unknown_error_type');
    });

    it('should include error details when available', () => {
      const errorWithDetails = {
        name: 'AuthError',
        message: 'invalid_request',
        status: 400,
        code: 'invalid_request',
        __isAuthError: true,
      } as unknown as AuthError;

      const result = mapSupabaseErrorToApiError(errorWithDetails);

      expect(result.details).toEqual({
        supabaseError: 'invalid_request',
        originalStatus: 400,
      });
      expect(result.details?.context).toBeUndefined();
    });
  });

  describe('mapGenericErrorToApiError', () => {
    it('should transform generic error', () => {
      const genericError = new Error('Something went wrong');
      const result = mapGenericErrorToApiError(genericError, 'test-context');

      expect(result).toEqual({
        message: 'Something went wrong',
        status: 500,
        code: 'INTERNAL_ERROR',
        details: {
          context: 'test-context',
          errorName: 'Error',
          stack: expect.any(String),
        },
      });
    });

    it('should handle context when not provided', () => {
      const error = new Error('Test error');
      const result = mapGenericErrorToApiError(error);

      expect(result.details?.context).toBe('unknown');
    });
  });
});

describe('Metadata Transformation', () => {
  describe('transformRegistrationMetadata', () => {
    it('should transform registration data correctly', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        website: 'https://johndoe.com',
        password: 'secret123', // Should be filtered out
      };

      const result = transformRegistrationMetadata(userData);

      expect(result).toEqual({
        name: 'John Doe',
        full_name: 'John Doe',
        website: 'https://johndoe.com',
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('email');
    });

    it('should only include allowed fields', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        sensitive_data: 'should not be included',
        display_name: 'Johnny',
      };

      const result = transformRegistrationMetadata(userData);

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('display_name');
      expect(result).not.toHaveProperty('sensitive_data');
    });
  });

  describe('transformProfileUpdateData', () => {
    it('should separate email and metadata updates', () => {
      const updateData = {
        name: 'Updated Name',
        email: 'new@example.com',
        website: 'https://updated.com',
      };

      const result = transformProfileUpdateData(updateData);

      expect(result).toEqual({
        email: 'new@example.com',
        data: {
          name: 'Updated Name',
          full_name: 'Updated Name',
          website: 'https://updated.com',
        },
      });
    });

    it('should handle metadata-only updates', () => {
      const updateData = {
        name: 'Updated Name',
        display_name: 'Updated Display',
      };

      const result = transformProfileUpdateData(updateData);

      expect(result).toEqual({
        data: {
          name: 'Updated Name',
          full_name: 'Updated Name',
          display_name: 'Updated Display',
        },
      });
      expect(result).not.toHaveProperty('email');
    });

    it('should handle email-only updates', () => {
      const updateData = {
        email: 'new@example.com',
      };

      const result = transformProfileUpdateData(updateData);

      expect(result).toEqual({
        email: 'new@example.com',
      });
      expect(result).not.toHaveProperty('data');
    });
  });
});

describe('Validation Functions', () => {
  describe('validateSessionData', () => {
    it('should validate complete session', () => {
      const validSession: Session = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        expires_at: 1640995200,
        token_type: 'bearer',
        user: {
          id: '123',
          email: 'test@example.com',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        } as User,
      };

      expect(validateSessionData(validSession)).toBe(true);
    });

    it('should reject null session', () => {
      expect(validateSessionData(null)).toBe(false);
    });

    it('should reject session with missing tokens', () => {
      const invalidSession = {
        access_token: '',
        refresh_token: 'refresh',
        user: { id: '123', email: 'test@example.com' },
      } as Session;

      expect(validateSessionData(invalidSession)).toBe(false);
    });
  });

  describe('validateUserData', () => {
    it('should validate complete user', () => {
      const validUser: User = {
        id: '123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      } as User;

      expect(validateUserData(validUser)).toBe(true);
    });

    it('should reject null user', () => {
      expect(validateUserData(null)).toBe(false);
    });

    it('should reject user with missing required fields', () => {
      const invalidUser = {
        id: '123',
        // missing email and created_at
      } as User;

      expect(validateUserData(invalidUser)).toBe(false);
    });
  });
});

describe('Error Utilities', () => {
  describe('extractErrorMessage', () => {
    it('should extract message from AuthError', () => {
      const authError = {
        name: 'AuthError',
        message: 'Test auth error',
        status: 400,
        code: 'test_error',
        __isAuthError: true,
      } as unknown as AuthError;

      expect(extractErrorMessage(authError)).toBe('Test auth error');
    });

    it('should extract message from generic Error', () => {
      const error = new Error('Generic error message');
      expect(extractErrorMessage(error)).toBe('Generic error message');
    });

    it('should handle string errors', () => {
      expect(extractErrorMessage('String error')).toBe('String error');
    });

    it('should handle unknown error types', () => {
      expect(extractErrorMessage(null)).toBe('Unknown error occurred');
      expect(extractErrorMessage(undefined)).toBe('Unknown error occurred');
      expect(extractErrorMessage(123)).toBe('Unknown error occurred');
    });
  });

  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      expect(isNetworkError(new Error('Network error occurred'))).toBe(true);
      expect(isNetworkError(new Error('Fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('Connection timeout'))).toBe(true);
      expect(isNetworkError(new Error('CORS error'))).toBe(true);
    });

    it('should not detect non-network errors', () => {
      expect(isNetworkError(new Error('Validation failed'))).toBe(false);
      expect(isNetworkError(new Error('Invalid credentials'))).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should detect rate limit errors', () => {
      const rateLimitError = {
        name: 'AuthError',
        message: 'rate_limit_exceeded',
        status: 429,
        code: 'rate_limit_exceeded',
        __isAuthError: true,
      } as unknown as AuthError;

      expect(isRateLimitError(rateLimitError)).toBe(true);
    });

    it('should detect rate limit by status code', () => {
      const statusError = {
        name: 'AuthError',
        message: 'Too many requests',
        status: 429,
        code: 'too_many_requests',
        __isAuthError: true,
      } as unknown as AuthError;

      expect(isRateLimitError(statusError)).toBe(true);
    });
  });
});

describe('Type Guards', () => {
  describe('TypeGuards.isSession', () => {
    it('should identify valid session objects', () => {
      const session = {
        access_token: 'token',
        user: { id: '123' },
      };

      expect(TypeGuards.isSession(session)).toBe(true);
    });

    it('should reject invalid objects', () => {
      expect(TypeGuards.isSession(null)).toBe(false);
      expect(TypeGuards.isSession({})).toBe(false);
      expect(TypeGuards.isSession({ access_token: 'token' })).toBe(false);
    });
  });

  describe('TypeGuards.isUser', () => {
    it('should identify valid user objects', () => {
      const user = {
        id: '123',
        email: 'test@example.com',
      };

      expect(TypeGuards.isUser(user)).toBe(true);
    });

    it('should reject invalid objects', () => {
      expect(TypeGuards.isUser(null)).toBe(false);
      expect(TypeGuards.isUser({})).toBe(false);
      expect(TypeGuards.isUser({ id: '123' })).toBe(false);
    });
  });
});

describe('TransformationError', () => {
  it('should create error with code', () => {
    const error = new TransformationError('Test message', 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('TransformationError');
  });
});

describe('Constants', () => {
  it('should have expected transformation constants', () => {
    expect(TransformationConstants.DEFAULT_TOKEN_EXPIRY).toBe(3600);
    expect(TransformationConstants.MAX_NAME_LENGTH).toBe(100);
    expect(TransformationConstants.MIN_PASSWORD_LENGTH).toBe(8);
    expect(Array.isArray(TransformationConstants.ALLOWED_EMAIL_DOMAINS)).toBe(true);
    expect(TransformationConstants.METADATA_SIZE_LIMIT).toBe(1024);
  });
});

describe('Comprehensive Data Transformation Tests', () => {
  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle null and undefined values gracefully', () => {
      expect(() => mapSupabaseUserToProfile(null as any)).toThrow();
      expect(() => mapSupabaseUserToProfile(undefined as any)).toThrow();

      expect(() => mapSupabaseSessionToLogin(null as any)).toThrow();
      expect(() => mapSupabaseSessionToLogin(undefined as any)).toThrow();
    });

    it('should handle users with very long metadata values', () => {
      const userWithLongData: User = {
        id: '123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone: '',
        confirmed_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        app_metadata: {},
        user_metadata: {
          name: 'A'.repeat(1000), // Very long name
          bio: 'B'.repeat(2000), // Very long bio
        },
        identities: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      };

      const result = mapSupabaseUserToProfile(userWithLongData);
      expect(result.name).toBe('A'.repeat(1000));
      expect(result.email).toBe('test@example.com');
    });

    it('should handle users with special characters in metadata', () => {
      const userWithSpecialChars: User = {
        id: '123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test+special@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone: '',
        confirmed_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        app_metadata: {},
        user_metadata: {
          name: 'José María Ñoño',
          emoji: '😀🎉👍',
          special: '<script>alert("xss")</script>',
        },
        identities: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      };

      const result = mapSupabaseUserToProfile(userWithSpecialChars);
      expect(result.name).toBe('José María Ñoño');
      expect(result.email).toBe('test+special@example.com');
    });

    it('should handle sessions with extreme expiration times', () => {
      const sessionWithFarFuture: Session = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: Number.MAX_SAFE_INTEGER,
        expires_at: Number.MAX_SAFE_INTEGER,
        token_type: 'bearer',
        user: {
          id: '123',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z',
          phone: '',
          confirmed_at: '2023-01-01T00:00:00Z',
          last_sign_in_at: '2023-01-01T00:00:00Z',
          app_metadata: {},
          user_metadata: { name: 'Test' },
          identities: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      };

      const result = mapSupabaseSessionToLogin(sessionWithFarFuture);
      expect(result.expires_in).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle sessions with zero or negative expiration', () => {
      const sessionWithZeroExpiry: Session = {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 0,
        expires_at: 0,
        token_type: 'bearer',
        user: {
          id: '123',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z',
          phone: '',
          confirmed_at: '2023-01-01T00:00:00Z',
          last_sign_in_at: '2023-01-01T00:00:00Z',
          app_metadata: {},
          user_metadata: { name: 'Test' },
          identities: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      };

      const result = mapSupabaseSessionToLogin(sessionWithZeroExpiry);
      expect(result.expires_in).toBe(3600); // Should default to 1 hour
    });
  });

  describe('Performance Tests', () => {
    it('should handle large numbers of transformations efficiently', () => {
      const baseUser: User = {
        id: '123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'test@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone: '',
        confirmed_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        app_metadata: {},
        user_metadata: { name: 'Test User' },
        identities: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      };

      const startTime = performance.now();

      // Transform 1000 users
      for (let i = 0; i < 1000; i++) {
        const user = { ...baseUser, id: `user-${i}`, email: `test${i}@example.com` };
        mapSupabaseUserToProfile(user);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large metadata objects efficiently', () => {
      const largeMetadata: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`field_${i}`] = `value_${i}`.repeat(10);
      }

      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        ...largeMetadata,
      };

      const startTime = performance.now();
      const result = transformRegistrationMetadata(userData);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
      expect(result.name).toBe('Test User');
    });
  });

  describe('Type Safety Tests', () => {
    it('should maintain type safety with different input types', () => {
      const mixedData = {
        name: 'Test User',
        age: 25,
        active: true,
        tags: ['user', 'active'],
        metadata: { key: 'value' },
      };

      const result = transformRegistrationMetadata(mixedData);

      // Should only include allowed string fields
      expect(result).toHaveProperty('name');
      expect(result).not.toHaveProperty('age');
      expect(result).not.toHaveProperty('active');
      expect(result).not.toHaveProperty('tags');
    });
  });

  describe('Error Handling Resilience', () => {
    it('should handle malformed user objects gracefully', () => {
      const malformedUsers = [
        { id: '123' }, // Missing required fields
        { email: 'test@example.com' }, // Missing id
        { id: '123', email: 'test@example.com' }, // Missing created_at
        { id: null, email: 'test@example.com', created_at: '2023-01-01T00:00:00Z' },
        { id: '123', email: null, created_at: '2023-01-01T00:00:00Z' },
      ];

      malformedUsers.forEach(user => {
        expect(validateUserData(user as any)).toBe(false);
      });
    });

    it('should handle malformed session objects gracefully', () => {
      const malformedSessions = [
        { access_token: 'token' }, // Missing user
        { user: { id: '123' } }, // Missing access_token
        { access_token: '', user: { id: '123' } }, // Empty token
        { access_token: 'token', user: null },
        { access_token: null, user: { id: '123' } },
      ];

      malformedSessions.forEach(session => {
        expect(validateSessionData(session as any)).toBe(false);
      });
    });

    it('should handle errors with missing properties', () => {
      const errorWithoutMessage = {} as AuthError;
      const result = extractErrorMessage(errorWithoutMessage);
      expect(result).toBe('Unknown error occurred');

      const errorWithEmptyMessage = { message: '' } as AuthError;
      expect(extractErrorMessage(errorWithEmptyMessage)).toBe('Unknown error occurred');
    });

    it('should handle circular references in metadata', () => {
      const circularObj: any = { name: 'Test' };
      circularObj.self = circularObj;

      // Should not throw but may skip circular properties
      expect(() => transformRegistrationMetadata(circularObj)).not.toThrow();
    });
  });

  describe('Data Integrity Tests', () => {
    it('should preserve essential data through transformations', () => {
      const originalUser: User = {
        id: 'user-123',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'important@example.com',
        email_confirmed_at: '2023-01-01T00:00:00Z',
        phone: '',
        confirmed_at: '2023-01-01T00:00:00Z',
        last_sign_in_at: '2023-01-01T00:00:00Z',
        app_metadata: {},
        user_metadata: {
          name: 'Important User',
          role: 'admin',
          permissions: ['read', 'write'],
        },
        identities: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
      };

      const transformed = mapSupabaseUserToProfile(originalUser);

      // Essential data should be preserved exactly
      expect(transformed.id).toBe(originalUser.id);
      expect(transformed.email).toBe(originalUser.email);
      expect(transformed.created_at).toBe(originalUser.created_at);
      expect(transformed.updated_at).toBe(originalUser.updated_at);
      expect(transformed.name).toBe(originalUser.user_metadata.name);
    });

    it('should maintain data consistency across multiple transformations', () => {
      const session: Session = {
        access_token: 'consistent-token',
        refresh_token: 'consistent-refresh',
        expires_in: 7200,
        expires_at: 1640995200,
        token_type: 'bearer',
        user: {
          id: 'consistent-user',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'consistent@example.com',
          email_confirmed_at: '2023-01-01T00:00:00Z',
          phone: '',
          confirmed_at: '2023-01-01T00:00:00Z',
          last_sign_in_at: '2023-01-01T00:00:00Z',
          app_metadata: {},
          user_metadata: { name: 'Consistent User' },
          identities: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      };

      const loginResult = mapSupabaseSessionToLogin(session);
      const registerResult = mapSupabaseSessionToRegister(session);
      const refreshResult = mapSupabaseSessionToRefresh(session);

      // User data should be consistent across transformations
      expect(loginResult.user.id).toBe(registerResult.user.id);
      expect(loginResult.user.email).toBe(registerResult.user.email);
      expect(loginResult.access_token).toBe(refreshResult.access_token);
      expect(loginResult.expires_in).toBe(refreshResult.expires_in);
    });
  });

  describe('Locale and Internationalization', () => {
    it('should handle users with international characters', () => {
      const internationalUsers = [
        { name: '张三', email: 'zhang@example.com', language: 'zh' },
        { name: 'José María', email: 'jose@example.com', language: 'es' },
        { name: 'Владимир', email: 'vladimir@example.com', language: 'ru' },
        { name: 'أحمد', email: 'ahmed@example.com', language: 'ar' },
        { name: 'ユーザー', email: 'user@example.com', language: 'ja' },
      ];

      internationalUsers.forEach(userData => {
        const result = transformRegistrationMetadata(userData);
        expect(result.name).toBe(userData.name);
        expect(result.full_name).toBe(userData.name);
      });
    });

    it('should handle different date formats properly', () => {
      const dateFormats = [
        '2023-01-01T00:00:00Z',
        '2023-01-01T00:00:00.000Z',
        '2023-01-01T00:00:00+00:00',
        '2023-01-01T09:00:00+09:00',
      ];

      dateFormats.forEach(dateString => {
        const user: User = {
          id: '123',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
          email_confirmed_at: dateString,
          phone: '',
          confirmed_at: dateString,
          last_sign_in_at: dateString,
          app_metadata: {},
          user_metadata: { name: 'Test' },
          identities: [],
          created_at: dateString,
          updated_at: dateString,
        };

        const result = mapSupabaseUserToProfile(user);
        expect(result.created_at).toBe(dateString);
        expect(result.updated_at).toBe(dateString);
      });
    });
  });

  describe('Security Tests', () => {
    it('should sanitize potentially dangerous metadata', () => {
      const dangerousData = {
        name: 'Normal Name',
        email: 'test@example.com',
        script: '<script>alert("xss")</script>',
        __proto__: { malicious: true },
        constructor: { dangerous: true },
        password: 'should-be-filtered',
        api_key: 'secret-key',
      };

      const result = transformRegistrationMetadata(dangerousData);

      // Should include safe fields
      expect(result.name).toBe('Normal Name');

      // Should exclude dangerous fields (check that they weren't explicitly copied)
      expect(result.password).toBeUndefined();
      expect(result.api_key).toBeUndefined();
      expect(result.script).toBeUndefined();

      // Ensure only allowed fields are present (excluding natural object properties)
      const expectedFields = ['name', 'full_name'];
      const naturalObjectProps = ['__proto__', 'constructor'];
      Object.keys(result).forEach(key => {
        expect(expectedFields.includes(key) || naturalObjectProps.includes(key)).toBe(true);
      });

      // Ensure our dangerous input values weren't copied to natural properties
      expect(result.constructor).not.toEqual({ dangerous: true });
    });

    it('should handle prototype pollution attempts', () => {
      const pollutionAttempt = {
        name: 'Test User',
        '__proto__.polluted': true,
        'constructor.prototype.polluted': true,
      };

      expect(() => {
        transformRegistrationMetadata(pollutionAttempt);
      }).not.toThrow();

      // Should not pollute global prototypes
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });
});
