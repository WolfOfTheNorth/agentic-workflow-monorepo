import { AsyncState } from '@agentic-workflow/shared';
import { useCallback, useState } from 'react';
import { getDefaultApiClient } from '../client';
import {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  UserListParams,
  UserListResponse,
} from '../types/user';

export interface UseUsersReturn {
  usersState: AsyncState<UserListResponse>;
  userState: AsyncState<User>;
  createState: AsyncState<User>;
  updateState: AsyncState<User>;
  deleteState: AsyncState<boolean>;
  getUsers: (params?: UserListParams) => Promise<void>;
  getUser: (id: string) => Promise<void>;
  createUser: (userData: CreateUserRequest) => Promise<void>;
  updateUser: (id: string, userData: UpdateUserRequest) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  activateUser: (id: string) => Promise<void>;
  deactivateUser: (id: string) => Promise<void>;
  clearState: () => void;
}

export function useUsers(): UseUsersReturn {
  const [usersState, setUsersState] = useState<AsyncState<UserListResponse>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [userState, setUserState] = useState<AsyncState<User>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [createState, setCreateState] = useState<AsyncState<User>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [updateState, setUpdateState] = useState<AsyncState<User>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const [deleteState, setDeleteState] = useState<AsyncState<boolean>>({
    data: null,
    status: 'idle',
    error: null,
  });

  const getUsers = useCallback(
    async (params?: UserListParams) => {
      setUsersState({ data: usersState.data, status: 'loading', error: null });

      try {
        const client = getDefaultApiClient();
        const response = await client.users.getUsers(params);

        setUsersState({ data: response.data, status: 'success', error: null });
      } catch (error) {
        const errorMsg =
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : String(error);
        setUsersState({ data: null, status: 'error', error: errorMsg });
        throw error;
      }
    },
    [usersState.data]
  );

  const getUser = useCallback(async (id: string) => {
    setUserState({ data: null, status: 'loading', error: null });

    try {
      const client = getDefaultApiClient();
      const response = await client.users.getUser(id);

      setUserState({ data: response.data, status: 'success', error: null });
    } catch (error) {
      const errorMsg =
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : String(error);
      setUserState({ data: null, status: 'error', error: errorMsg });
      throw error;
    }
  }, []);

  const createUser = useCallback(
    async (userData: CreateUserRequest) => {
      setCreateState({ data: null, status: 'loading', error: null });

      try {
        const client = getDefaultApiClient();
        const response = await client.users.createUser(userData);

        setCreateState({ data: response.data, status: 'success', error: null });

        // Refresh users list if it's already loaded
        if (usersState.data) {
          await getUsers();
        }
      } catch (error) {
        const errorMsg =
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as any).message
            : String(error);
        setCreateState({ data: null, status: 'error', error: errorMsg });
        throw error;
      }
    },
    [usersState.data, getUsers]
  );

  const updateUser = useCallback(
    async (id: string, userData: UpdateUserRequest) => {
      setUpdateState({ data: null, status: 'loading', error: null });

      try {
        const client = getDefaultApiClient();
        const response = await client.users.updateUser(id, userData);

        setUpdateState({ data: response.data, status: 'success', error: null });

        // Update the single user state if it matches
        if (userState.data?.id === id) {
          setUserState({ data: response.data, status: 'success', error: null });
        }

        // Refresh users list if it's already loaded
        if (usersState.data) {
          await getUsers();
        }
      } catch (error) {
        const errorMsg =
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as any).message
            : String(error);
        setUpdateState({ data: null, status: 'error', error: errorMsg });
        throw error;
      }
    },
    [userState.data, usersState.data, getUsers]
  );

  const deleteUser = useCallback(
    async (id: string) => {
      setDeleteState({ data: null, status: 'loading', error: null });

      try {
        const client = getDefaultApiClient();
        await client.users.deleteUser(id);

        setDeleteState({ data: true, status: 'success', error: null });

        // Clear single user state if it matches
        if (userState.data?.id === id) {
          setUserState({ data: null, status: 'idle', error: null });
        }

        // Refresh users list if it's already loaded
        if (usersState.data) {
          await getUsers();
        }
      } catch (error) {
        const errorMsg =
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as any).message
            : String(error);
        setDeleteState({ data: null, status: 'error', error: errorMsg });
        throw error;
      }
    },
    [userState.data, usersState.data, getUsers]
  );

  const activateUser = useCallback(
    async (id: string) => {
      await updateUser(id, { is_active: true });
    },
    [updateUser]
  );

  const deactivateUser = useCallback(
    async (id: string) => {
      await updateUser(id, { is_active: false });
    },
    [updateUser]
  );

  const clearState = useCallback(() => {
    setUsersState({ data: null, status: 'idle', error: null });
    setUserState({ data: null, status: 'idle', error: null });
    setCreateState({ data: null, status: 'idle', error: null });
    setUpdateState({ data: null, status: 'idle', error: null });
    setDeleteState({ data: null, status: 'idle', error: null });
  }, []);

  return {
    usersState,
    userState,
    createState,
    updateState,
    deleteState,
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    activateUser,
    deactivateUser,
    clearState,
  };
}
