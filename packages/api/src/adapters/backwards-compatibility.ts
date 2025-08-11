/**
 * Backwards Compatibility Layer
 *
 * Provides compatibility interfaces and adapters to ensure existing authentication
 * code continues to work during and after migration to Supabase authentication.
 */

import { AuthUser, LoginCredentials } from '@agentic-workflow/shared';
import { AuthClient } from '../clients/auth-client';

// Legacy Django-style interfaces that existing code might expect
export interface DjangoUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: Date;
  last_login: Date | null;
  get_full_name(): string;
  get_short_name(): string;
  has_perm(permission: string): boolean;
  has_module_perms(app_label: string): boolean;
}

export interface DjangoAuthBackend {
  authenticate(username: string, password: string): Promise<DjangoUser | null>;
  get_user(user_id: number): Promise<DjangoUser | null>;
}

export interface LegacyAuthService {
  login(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: DjangoUser; error?: string }>;
  logout(): Promise<void>;
  getCurrentUser(): DjangoUser | null;
  isAuthenticated(): boolean;
  checkPermission(permission: string): boolean;
  hasStaffAccess(): boolean;
  hasAdminAccess(): boolean;
}

export interface CompatibilityConfig {
  enableLegacySupport: boolean;
  strictCompatibility: boolean;
  logLegacyUsage: boolean;
  deprecationWarnings: boolean;
  migrationMode: 'django-only' | 'dual-auth' | 'supabase-only';
  legacySessionTimeout: number;
}

export const DEFAULT_COMPATIBILITY_CONFIG: CompatibilityConfig = {
  enableLegacySupport: true,
  strictCompatibility: false,
  logLegacyUsage: true,
  deprecationWarnings: true,
  migrationMode: 'dual-auth',
  legacySessionTimeout: 3600000, // 1 hour
};

/**
 * Django User Adapter
 *
 * Adapts Supabase AuthUser to Django-style user interface
 */
export class DjangoUserAdapter implements DjangoUser {
  private authUser: AuthUser;
  private userProfile: any; // Additional profile data from user_profiles table

  constructor(authUser: AuthUser, userProfile?: any) {
    this.authUser = authUser;
    this.userProfile = userProfile || {};
  }

  get id(): number {
    // Return Django ID if available, otherwise hash the Supabase UUID
    return this.userProfile.django_user_id || this.hashUUID(this.authUser.id);
  }

  get username(): string {
    return this.userProfile.username || this.authUser.email.split('@')[0];
  }

  get email(): string {
    return this.authUser.email;
  }

  get first_name(): string {
    return this.userProfile.first_name || this.authUser.name?.split(' ')[0] || '';
  }

  get last_name(): string {
    return this.userProfile.last_name || this.authUser.name?.split(' ').slice(1).join(' ') || '';
  }

  get is_active(): boolean {
    // In Supabase, banned users are considered inactive
    return !this.authUser.banned_until || (this.authUser.banned_until && new Date(this.authUser.banned_until) < new Date());
  }

  get is_staff(): boolean {
    return this.userProfile.is_staff || false;
  }

  get is_superuser(): boolean {
    return this.userProfile.is_superuser || false;
  }

  get date_joined(): Date {
    return new Date(this.authUser.createdAt || Date.now());
  }

  get last_login(): Date | null {
    return this.authUser.last_sign_in_at ? new Date(this.authUser.last_sign_in_at) : null;
  }

  get_full_name(): string {
    const firstName = this.first_name;
    const lastName = this.last_name;
    return `${firstName} ${lastName}`.trim() || this.username;
  }

  get_short_name(): string {
    return this.first_name || this.username;
  }

  has_perm(permission: string): boolean {
    // Basic permission checking - extend based on your permission system
    if (this.is_superuser) return true;

    // Map common Django permissions to Supabase roles/permissions
    const permissionMap: Record<string, boolean> = {
      'auth.add_user': this.is_staff,
      'auth.change_user': this.is_staff,
      'auth.delete_user': this.is_superuser,
      'auth.view_user': this.is_staff,
    };

    return permissionMap[permission] || false;
  }

  has_module_perms(app_label: string): boolean {
    // Check if user has any permissions for the given app
    if (this.is_superuser) return true;

    const modulePermissions: Record<string, boolean> = {
      auth: this.is_staff,
      admin: this.is_staff,
      contenttypes: this.is_staff,
      sessions: this.is_staff,
    };

    return modulePermissions[app_label] || false;
  }

  private hashUUID(uuid: string): number {
    // Simple hash function to convert UUID to number for legacy compatibility
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      const char = uuid.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * Legacy Authentication Service
 *
 * Provides Django-style authentication interface backed by Supabase
 */
export class LegacyAuthServiceAdapter implements LegacyAuthService {
  private authClient: AuthClient;
  private currentUser: DjangoUser | null = null;
  private config: CompatibilityConfig;

  constructor(authClient: AuthClient, config: Partial<CompatibilityConfig> = {}) {
    this.authClient = authClient;
    this.config = { ...DEFAULT_COMPATIBILITY_CONFIG, ...config };
  }

  async login(
    username: string,
    password: string
  ): Promise<{ success: boolean; user?: DjangoUser; error?: string }> {
    if (this.config.logLegacyUsage) {
      console.warn(
        '[LegacyAuthService] Using deprecated login method. Migrate to Supabase AuthClient.'
      );
    }

    try {
      // Determine if username is email or username
      const isEmail = username.includes('@');
      let email = username;

      if (!isEmail) {
        // Look up email by username if not already an email
        // This would require a database query in a real implementation
        const lookupResult = await this.lookupEmailByUsername(username);
        email = lookupResult!;
        if (!email) {
          return { success: false, error: 'User not found' };
        }
      }

      const credentials: LoginCredentials = {
        email: email!,
        password,
        rememberMe: false,
      };

      const result = await this.authClient.login(credentials);

      if (result.success && result.user) {
        // Fetch additional profile data
        const userProfile = await this.fetchUserProfile(result.user.id);
        this.currentUser = new DjangoUserAdapter(result.user, userProfile);

        return { success: true, user: this.currentUser };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Authentication failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication error',
      };
    }
  }

  async logout(): Promise<void> {
    if (this.config.logLegacyUsage) {
      console.warn(
        '[LegacyAuthService] Using deprecated logout method. Migrate to Supabase AuthClient.'
      );
    }

    try {
      await this.authClient.logout();
      this.currentUser = null;
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state even if remote logout fails
      this.currentUser = null;
    }
  }

  getCurrentUser(): DjangoUser | null {
    if (this.config.migrationMode === 'supabase-only') {
      // In Supabase-only mode, sync with current Supabase user
      const supabaseUser = this.authClient.getCurrentUser();
      if (supabaseUser && !this.currentUser) {
        // Lazy load user profile when needed
        this.syncCurrentUser();
      }
    }

    return this.currentUser;
  }

  isAuthenticated(): boolean {
    if (this.config.migrationMode === 'supabase-only') {
      return this.authClient.isAuthenticated();
    }

    return this.currentUser !== null && this.currentUser.is_active;
  }

  checkPermission(permission: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.has_perm(permission) : false;
  }

  hasStaffAccess(): boolean {
    const user = this.getCurrentUser();
    return user ? user.is_staff : false;
  }

  hasAdminAccess(): boolean {
    const user = this.getCurrentUser();
    return user ? user.is_superuser : false;
  }

  private async lookupEmailByUsername(_username: string): Promise<string | null> {
    // In a real implementation, this would query the user_profiles table
    // For now, return null to indicate username not found
    console.warn(`Username lookup not implemented: ${_username}`);
    return null;
  }

  private async fetchUserProfile(_userId: string): Promise<Record<string, unknown>> {
    // In a real implementation, this would fetch from user_profiles table
    // For now, return empty profile
    return {};
  }

  private async syncCurrentUser(): Promise<void> {
    const supabaseUser = this.authClient.getCurrentUser();
    if (supabaseUser) {
      const userProfile = await this.fetchUserProfile(supabaseUser.id);
      this.currentUser = new DjangoUserAdapter(supabaseUser, userProfile);
    }
  }
}

/**
 * Django Authentication Backend Adapter
 *
 * Provides Django-style authentication backend interface
 */
export class DjangoAuthBackendAdapter implements DjangoAuthBackend {
  private authClient: AuthClient;
  private config: CompatibilityConfig;

  constructor(authClient: AuthClient, config: Partial<CompatibilityConfig> = {}) {
    this.authClient = authClient;
    this.config = { ...DEFAULT_COMPATIBILITY_CONFIG, ...config };
  }

  async authenticate(username: string, password: string): Promise<DjangoUser | null> {
    if (this.config.deprecationWarnings) {
      console.warn(
        '[DjangoAuthBackend] This interface is deprecated. Migrate to Supabase authentication.'
      );
    }

    try {
      const isEmail = username.includes('@');
      const email = isEmail ? username : await this.lookupEmailByUsername(username);

      if (!email) {
        return null;
      }

      const credentials: LoginCredentials = {
        email,
        password,
        rememberMe: false,
      };

      const result = await this.authClient.login(credentials);

      if (result.success && result.user) {
        const userProfile = await this.fetchUserProfile(result.user.id);
        return new DjangoUserAdapter(result.user, userProfile);
      }

      return null;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  async get_user(user_id: number): Promise<DjangoUser | null> {
    try {
      // Look up user by Django ID or Supabase ID
      const userProfile = await this.fetchUserProfileByDjangoId(user_id);

      if (
        userProfile &&
        typeof userProfile === 'object' &&
        'supabase_id' in userProfile &&
        typeof userProfile.supabase_id === 'string'
      ) {
        // Fetch the Supabase user data
        const supabaseUser = await this.fetchSupabaseUser(userProfile.supabase_id);
        if (supabaseUser) {
          return new DjangoUserAdapter(supabaseUser, userProfile);
        }
      }

      return null;
    } catch (error) {
      console.error('User lookup error:', error);
      return null;
    }
  }

  private async lookupEmailByUsername(_username: string): Promise<string | null> {
    // Implementation would query user_profiles table
    return null;
  }

  private async fetchUserProfile(_userId: string): Promise<Record<string, unknown>> {
    // Implementation would fetch from user_profiles table
    return {};
  }

  private async fetchUserProfileByDjangoId(
    _djangoId: number
  ): Promise<Record<string, unknown> | null> {
    // Implementation would query user_profiles by django_user_id
    return null;
  }

  private async fetchSupabaseUser(_supabaseId: string): Promise<AuthUser | null> {
    // Implementation would fetch user data from Supabase
    return null;
  }
}

/**
 * Compatibility middleware for request/response handling
 */
export class AuthCompatibilityMiddleware {
  private legacyAuthService: LegacyAuthService;
  private config: CompatibilityConfig;

  constructor(legacyAuthService: LegacyAuthService, config: Partial<CompatibilityConfig> = {}) {
    this.legacyAuthService = legacyAuthService;
    this.config = { ...DEFAULT_COMPATIBILITY_CONFIG, ...config };
  }

  /**
   * Express/Node.js middleware for handling legacy authentication
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      // Add legacy user object to request
      req.user = this.legacyAuthService.getCurrentUser();
      req.is_authenticated = () => this.legacyAuthService.isAuthenticated();
      req.has_perm = (permission: string) => this.legacyAuthService.checkPermission(permission);

      // Add Django-style template context
      res.locals.user = req.user;
      res.locals.is_authenticated = req.is_authenticated();

      if (this.config.logLegacyUsage && req.user) {
        console.log(`[AuthCompatibility] Legacy user access: ${req.user.username}`);
      }

      next();
    };
  }

  /**
   * Decorator for protecting routes with legacy authentication
   */
  requiresAuth(permission?: string) {
    return (_req: any, res: any, next: any) => {
      if (!this.legacyAuthService.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (permission && !this.legacyAuthService.checkPermission(permission)) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      next();
    };
  }

  /**
   * Staff access decorator
   */
  requiresStaff() {
    return (_req: any, res: any, next: any) => {
      if (!this.legacyAuthService.hasStaffAccess()) {
        return res.status(403).json({ error: 'Staff access required' });
      }
      next();
    };
  }

  /**
   * Admin access decorator
   */
  requiresAdmin() {
    return (_req: any, res: any, next: any) => {
      if (!this.legacyAuthService.hasAdminAccess()) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    };
  }
}

/**
 * Session compatibility adapter
 */
export class SessionCompatibilityAdapter {
  private sessionStore = new Map<string, any>();
  private config: CompatibilityConfig;

  constructor(config: Partial<CompatibilityConfig> = {}) {
    this.config = { ...DEFAULT_COMPATIBILITY_CONFIG, ...config };
  }

  /**
   * Create a session-like interface for legacy code
   */
  createSessionInterface(sessionId: string) {
    return {
      get: (key: string) => {
        const session = this.sessionStore.get(sessionId);
        return session ? session[key] : undefined;
      },

      set: (key: string, value: any) => {
        const session = this.sessionStore.get(sessionId) || {};
        session[key] = value;
        session._last_activity = Date.now();
        this.sessionStore.set(sessionId, session);
      },

      delete: (key: string) => {
        const session = this.sessionStore.get(sessionId);
        if (session) {
          delete session[key];
          this.sessionStore.set(sessionId, session);
        }
      },

      clear: () => {
        this.sessionStore.delete(sessionId);
      },

      // Django-style session methods
      flush: () => {
        this.sessionStore.delete(sessionId);
      },

      cycle_key: () => {
        // In a real implementation, this would regenerate the session ID
        console.warn('Session key cycling not implemented');
      },

      get_expire_at_browser_close: () => {
        return true; // Default behavior
      },

      set_expire_at_browser_close: (value: boolean) => {
        const session = this.sessionStore.get(sessionId) || {};
        session['_expire_at_browser_close'] = value;
        session._last_activity = Date.now();
        this.sessionStore.set(sessionId, session);
      },
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const timeout = this.config.legacySessionTimeout;

    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session._last_activity && now - session._last_activity > timeout) {
        this.sessionStore.delete(sessionId);
      }
    }
  }
}

/**
 * Migration utility for gradual transition
 */
export class AuthMigrationUtility {
  private authClient: AuthClient;
  private config: CompatibilityConfig;

  constructor(authClient: AuthClient, config: Partial<CompatibilityConfig> = {}) {
    this.authClient = authClient;
    this.config = { ...DEFAULT_COMPATIBILITY_CONFIG, ...config };
  }

  /**
   * Get the auth client for direct access
   */
  getAuthClient(): AuthClient {
    return this.authClient;
  }

  /**
   * Check if a feature should use legacy or new implementation
   */
  shouldUseLegacy(_feature: string): boolean {
    if (this.config.migrationMode === 'django-only') return true;
    if (this.config.migrationMode === 'supabase-only') return false;

    // In dual-auth mode, use feature flags or gradual rollout logic
    return false; // Default to new implementation
  }

  /**
   * Create a dual-auth wrapper that tries both systems
   */
  createDualAuthWrapper<T>(
    legacyMethod: () => Promise<T>,
    supabaseMethod: () => Promise<T>
  ): () => Promise<T> {
    return async () => {
      if (this.config.migrationMode === 'django-only') {
        return legacyMethod();
      }

      if (this.config.migrationMode === 'supabase-only') {
        return supabaseMethod();
      }

      // Dual auth mode - try Supabase first, fallback to legacy
      try {
        return await supabaseMethod();
      } catch (error) {
        console.warn('Supabase auth failed, falling back to legacy:', error);
        return legacyMethod();
      }
    };
  }

  /**
   * Log usage patterns for migration analysis
   */
  logUsagePattern(method: string, success: boolean, duration: number): void {
    if (this.config.logLegacyUsage) {
      console.log(`[AuthMigration] ${method}: ${success ? 'SUCCESS' : 'FAILURE'} in ${duration}ms`);
    }
  }
}

/**
 * Factory functions for creating compatibility instances
 */
export function createLegacyAuthService(
  authClient: AuthClient,
  config?: Partial<CompatibilityConfig>
): LegacyAuthService {
  return new LegacyAuthServiceAdapter(authClient, config);
}

export function createDjangoAuthBackend(
  authClient: AuthClient,
  config?: Partial<CompatibilityConfig>
): DjangoAuthBackend {
  return new DjangoAuthBackendAdapter(authClient, config);
}

export function createAuthCompatibilityMiddleware(
  legacyAuthService: LegacyAuthService,
  config?: Partial<CompatibilityConfig>
): AuthCompatibilityMiddleware {
  return new AuthCompatibilityMiddleware(legacyAuthService, config);
}

export default {
  DjangoUserAdapter,
  LegacyAuthServiceAdapter,
  DjangoAuthBackendAdapter,
  AuthCompatibilityMiddleware,
  SessionCompatibilityAdapter,
  AuthMigrationUtility,
  createLegacyAuthService,
  createDjangoAuthBackend,
  createAuthCompatibilityMiddleware,
};
