import { createContext, useContext, useState, ReactNode } from 'react';

// Simple mock types
interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthSession {
  id: string;
  expiresAt: number;
  userId: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: string;
}

export interface AuthContextValue {
  // Core auth state
  user: AuthUser | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;

  // Auth operations
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  signup: (userData: SignupData) => Promise<AuthResponse>;
  logout: () => Promise<AuthResponse>;
  refreshSession: () => Promise<AuthResponse>;

  // Profile operations
  updateProfile: (updates: Partial<AuthUser>) => Promise<AuthResponse>;
  updatePassword: (newPassword: string) => Promise<AuthResponse>;
  resetPassword: (email: string) => Promise<void>;

  // Session management
  hasValidSession: boolean;
  isSessionExpired: boolean;
  isSessionExpiring: boolean;
  getSessionTimeRemaining: () => number;

  // Utility functions
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!user && !!session;

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock login - simulate API call
      await new Promise(resolve => window.setTimeout(resolve, 1000));

      // For demo purposes, accept any email/password combination
      if (credentials.email && credentials.password) {
        const mockUser: AuthUser = {
          id: '1',
          email: credentials.email,
          name: credentials.email.split('@')[0],
        };

        const mockSession: AuthSession = {
          id: 'session-1',
          expiresAt: Date.now() + 3600000, // 1 hour
          userId: mockUser.id,
        };

        setUser(mockUser);
        setSession(mockSession);
        setIsLoading(false);

        return {
          success: true,
          user: mockUser,
          session: mockSession,
        };
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      setIsLoading(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const signup = async (userData: SignupData): Promise<AuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock signup - simulate API call
      await new Promise(resolve => window.setTimeout(resolve, 1000));

      const mockUser: AuthUser = {
        id: '1',
        email: userData.email,
        name: userData.name,
      };

      const mockSession: AuthSession = {
        id: 'session-1',
        expiresAt: Date.now() + 3600000, // 1 hour
        userId: mockUser.id,
      };

      setUser(mockUser);
      setSession(mockSession);
      setIsLoading(false);

      return {
        success: true,
        user: mockUser,
        session: mockSession,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
      setIsLoading(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = async (): Promise<AuthResponse> => {
    setUser(null);
    setSession(null);
    setError(null);
    return { success: true };
  };

  const refreshSession = async (): Promise<AuthResponse> => {
    return { success: true };
  };

  const updateProfile = async (updates: Partial<AuthUser>): Promise<AuthResponse> => {
    if (user) {
      setUser({ ...user, ...updates });
      return { success: true, user: { ...user, ...updates } };
    }
    return { success: false, error: 'No user logged in' };
  };

  const updatePassword = async (_newPassword: string): Promise<AuthResponse> => {
    return { success: true };
  };

  const resetPassword = async (_email: string): Promise<void> => {
    // Mock reset password
  };

  const clearError = () => {
    setError(null);
  };

  const contextValue: AuthContextValue = {
    // Core auth state
    user,
    session,
    isAuthenticated,
    isLoading,
    isInitializing,
    error,

    // Auth operations
    login,
    signup,
    logout,
    refreshSession,

    // Profile operations
    updateProfile,
    updatePassword,
    resetPassword,

    // Session management
    hasValidSession: isAuthenticated,
    isSessionExpired: false,
    isSessionExpiring: false,
    getSessionTimeRemaining: () => (session ? session.expiresAt - Date.now() : 0),

    // Utility functions
    clearError,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}

// Export a custom hook that provides better error handling
export function useAuthContextSafe(): AuthContextValue | null {
  const context = useContext(AuthContext);
  return context || null;
}
