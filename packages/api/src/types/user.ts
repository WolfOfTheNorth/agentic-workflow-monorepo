export interface User {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  is_staff?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
  is_active?: boolean;
  is_staff?: boolean;
}

export interface UserListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  is_staff?: boolean;
  ordering?: 'created_at' | '-created_at' | 'name' | '-name' | 'email' | '-email';
}
