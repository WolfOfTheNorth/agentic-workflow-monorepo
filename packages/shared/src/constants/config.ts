export const APP_CONFIG = {
  NAME: 'Agentic Workflow',
  VERSION: '0.0.0',
  DESCRIPTION: 'AI-First Modular Monorepo for Rapid Prototyping',
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PREFERENCES: 'user_preferences',
  THEME: 'theme',
  SESSION_ID: 'session_id',
  USER_SESSION: 'user_session',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
} as const;

export const AUTH_CONFIG = {
  SESSION_TIMEOUT: parseInt(process.env.AUTH_TOKEN_EXPIRATION || '3600', 10) * 1000,
  REFRESH_THRESHOLD: parseInt(process.env.AUTH_REFRESH_THRESHOLD || '300', 10) * 1000,
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || '5', 10),
  RATE_LIMIT_WINDOW: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW || '300', 10) * 1000,
  REMEMBER_ME_DURATION: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  TOKEN_REFRESH_BUFFER: 60 * 1000, // 1 minute in milliseconds
} as const;

export const SUPABASE_CONFIG = {
  URL: process.env.SUPABASE_URL || '',
  ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
} as const;

export const API_CONFIG = {
  BASE_URL: process.env.VITE_API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:8000',
  VERSION: process.env.VITE_API_VERSION || 'v1',
  TIMEOUT: parseInt(process.env.API_TIMEOUT || '30000', 10),
  RETRY_ATTEMPTS: parseInt(process.env.API_RETRY_ATTEMPTS || '3', 10),
} as const;
