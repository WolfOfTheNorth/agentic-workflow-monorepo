import { useState, useCallback } from 'react';
import { AsyncState } from '@agentic-workflow/shared';
import { getDefaultApiClient } from '../client';
import { LoginRequest, RegisterRequest, ProfileResponse } from '../types/auth';

export interface UseAuthReturn {
  loginState: AsyncState<any>;
  registerState: AsyncState<any>;
  logoutState: AsyncState<any>;
  profileState: AsyncState<ProfileResponse>;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  updateProfile: (profileData: Partial<ProfileResponse>) => Promise<void>;
  clearState: () => void;
}

export function useAuth(): UseAuthReturn {
  const [loginState, setLoginState] = useState<AsyncState<any>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [registerState, setRegisterState] = useState<AsyncState<any>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [logoutState, setLogoutState] = useState<AsyncState<any>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [profileState, setProfileState] = useState<AsyncState<ProfileResponse>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoginState({ data: null, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      const response = await client.auth.login(credentials);

      // Set the auth token for future requests
      client.setAuthToken(response.data.access_token);

      setLoginState({ data: response.data, status: 'success', error: null });
    } catch (error: any) {
      setLoginState({ data: null, status: 'error', error: error.message });
      throw error;
    }
  }, []);

  const register = useCallback(async (userData: RegisterRequest) => {
    setRegisterState({ data: null, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      const response = await client.auth.register(userData);

      // Set the auth token for future requests
      client.setAuthToken(response.data.access_token);

      setRegisterState({ data: response.data, status: 'success', error: null });
    } catch (error: any) {
      setRegisterState({ data: null, status: 'error', error: error.message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    setLogoutState({ data: null, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      await client.auth.logout();

      // Clear the auth token
      client.setAuthToken(null);

      setLogoutState({ data: true, status: 'success', error: null });
      setProfileState({ data: null, status: 'idle', error: null });
    } catch (error: any) {
      setLogoutState({ data: null, status: 'error', error: error.message });
      throw error;
    }
  }, []);

  const getProfile = useCallback(async () => {
    setProfileState({ data: profileState.data, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      const response = await client.auth.getProfile();

      setProfileState({ data: response.data, status: 'success', error: null });
    } catch (error: any) {
      setProfileState({ data: null, status: 'error', error: error.message });
      throw error;
    }
  }, [profileState.data]);

  const updateProfile = useCallback(
    async (profileData: Partial<ProfileResponse>) => {
      setProfileState({ data: profileState.data, status: 'loading', error: null });

      try {
        const client = getDefaultApiClient();
        const response = await client.auth.updateProfile(profileData);

        setProfileState({ data: response.data, status: 'success', error: null });
      } catch (error: any) {
        setProfileState({ data: profileState.data, status: 'error', error: error.message });
        throw error;
      }
    },
    [profileState.data]
  );

  const clearState = useCallback(() => {
    setLoginState({ data: null, status: 'idle', error: null });
    setRegisterState({ data: null, status: 'idle', error: null });
    setLogoutState({ data: null, status: 'idle', error: null });
    setProfileState({ data: null, status: 'idle', error: null });
  }, []);

  return {
    loginState,
    registerState,
    logoutState,
    profileState,
    login,
    register,
    logout,
    getProfile,
    updateProfile,
    clearState,
  };
}
