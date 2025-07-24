export type Environment = 'development' | 'staging' | 'production';

export type Theme = 'light' | 'dark' | 'auto';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T = any> {
  data: T | null;
  status: Status;
  error: string | null;
}
