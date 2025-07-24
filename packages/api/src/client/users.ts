import { API_ENDPOINTS } from '@agentic-workflow/shared';
import { ApiClient } from './base';
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  UserListResponse,
  UserListParams,
} from '../types/user';

export class UsersApiClient {
  constructor(private apiClient: ApiClient) {}

  async getUsers(params?: UserListParams) {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const endpoint = searchParams.toString()
      ? `${API_ENDPOINTS.USERS.LIST}?${searchParams.toString()}`
      : API_ENDPOINTS.USERS.LIST;

    return this.apiClient.get<UserListResponse>(endpoint);
  }

  async getUser(id: string) {
    return this.apiClient.get<User>(API_ENDPOINTS.USERS.DETAIL(id));
  }

  async createUser(userData: CreateUserRequest) {
    return this.apiClient.post<User>(API_ENDPOINTS.USERS.CREATE, userData);
  }

  async updateUser(id: string, userData: UpdateUserRequest) {
    return this.apiClient.patch<User>(API_ENDPOINTS.USERS.UPDATE(id), userData);
  }

  async deleteUser(id: string) {
    return this.apiClient.delete(API_ENDPOINTS.USERS.DELETE(id));
  }

  async activateUser(id: string) {
    return this.apiClient.patch<User>(API_ENDPOINTS.USERS.UPDATE(id), { is_active: true });
  }

  async deactivateUser(id: string) {
    return this.apiClient.patch<User>(API_ENDPOINTS.USERS.UPDATE(id), { is_active: false });
  }

  async makeStaff(id: string) {
    return this.apiClient.patch<User>(API_ENDPOINTS.USERS.UPDATE(id), { is_staff: true });
  }

  async removeStaff(id: string) {
    return this.apiClient.patch<User>(API_ENDPOINTS.USERS.UPDATE(id), { is_staff: false });
  }
}
