/**
 * Migration Utilities
 *
 * Provides utilities and interfaces for migrating from Django authentication
 * to Supabase authentication while maintaining data integrity and user experience.
 */

export interface DjangoUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  password: string; // Django hashed password
  email_verified?: boolean;
  phone_number?: string;
  avatar?: string;
  // Custom fields can be added here
  [key: string]: any;
}

export interface SupabaseUserData {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  user_metadata: Record<string, any>;
  app_metadata: Record<string, any>;
}

export interface UserProfileData {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  is_staff: boolean;
  is_superuser: boolean;
  django_user_id: number;
  migrated_at: string;
  created_at: string;
  updated_at: string;
}

export interface MigrationConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  skipExisting: boolean;
  validateData: boolean;
  sendPasswordResets: boolean;
  preserveTimestamps: boolean;
  dryRun: boolean;
}

export const DEFAULT_MIGRATION_CONFIG: MigrationConfig = {
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000,
  skipExisting: true,
  validateData: true,
  sendPasswordResets: true,
  preserveTimestamps: true,
  dryRun: false,
};

export interface MigrationResult {
  totalUsers: number;
  successfulMigrations: number;
  failedMigrations: number;
  skippedUsers: number;
  errors: MigrationError[];
  duration: number;
  summary: MigrationSummary;
}

export interface MigrationError {
  djangoUserId: number;
  email: string;
  error: string;
  step: 'validation' | 'auth_user_creation' | 'profile_creation' | 'password_reset';
  timestamp: string;
  retryCount: number;
}

export interface MigrationSummary {
  activeUsers: number;
  inactiveUsers: number;
  staffUsers: number;
  superUsers: number;
  verifiedEmails: number;
  unverifiedEmails: number;
  usersWithCustomData: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class MigrationUtils {
  /**
   * Validate Django user data before migration
   */
  static validateDjangoUser(user: DjangoUser): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!user.email || !this.isValidEmail(user.email)) {
      errors.push('Invalid or missing email address');
    }

    if (!user.username || user.username.trim().length === 0) {
      errors.push('Username is required');
    }

    // Username format validation
    if (user.username && !/^[a-zA-Z0-9_.-]+$/.test(user.username)) {
      warnings.push('Username contains special characters that may cause issues');
    }

    // Email uniqueness (would need to be checked against existing Supabase users)
    if (user.email && user.email.length > 254) {
      errors.push('Email address is too long (max 254 characters)');
    }

    // Name validation
    if (user.first_name && user.first_name.length > 150) {
      warnings.push('First name is longer than recommended (150 characters)');
    }

    if (user.last_name && user.last_name.length > 150) {
      warnings.push('Last name is longer than recommended (150 characters)');
    }

    // Date validation
    if (user.date_joined && !this.isValidISODate(user.date_joined)) {
      errors.push('Invalid date_joined format');
    }

    if (user.last_login && !this.isValidISODate(user.last_login)) {
      errors.push('Invalid last_login format');
    }

    // Phone number validation
    if (user.phone_number && !this.isValidPhoneNumber(user.phone_number)) {
      warnings.push('Phone number format may not be valid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Map Django user to Supabase user creation data
   */
  static mapDjangoToSupabaseAuth(user: DjangoUser): {
    email: string;
    email_confirm: boolean;
    user_metadata: Record<string, any>;
    app_metadata: Record<string, any>;
  } {
    return {
      email: user.email,
      email_confirm: user.email_verified || false,
      user_metadata: {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username,
        django_id: user.id,
        migrated_from: 'django',
        migration_timestamp: new Date().toISOString(),
        phone_number: user.phone_number || null,
        avatar_url: user.avatar || null,
      },
      app_metadata: {
        provider: 'email',
        providers: ['email'],
        django_user_id: user.id,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser,
        original_date_joined: user.date_joined,
        original_last_login: user.last_login,
      },
    };
  }

  /**
   * Map Django user to user profile data
   */
  static mapDjangoToUserProfile(
    user: DjangoUser,
    supabaseUserId: string
  ): Omit<UserProfileData, 'created_at' | 'updated_at'> {
    return {
      id: supabaseUserId,
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      avatar_url: user.avatar || null,
      phone_number: user.phone_number || null,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser,
      django_user_id: user.id,
      migrated_at: new Date().toISOString(),
    };
  }

  /**
   * Generate migration report
   */
  static generateMigrationReport(result: MigrationResult): string {
    const report = `
# Django to Supabase Migration Report

## Summary
- **Total Users**: ${result.totalUsers}
- **Successful Migrations**: ${result.successfulMigrations}
- **Failed Migrations**: ${result.failedMigrations}
- **Skipped Users**: ${result.skippedUsers}
- **Success Rate**: ${((result.successfulMigrations / result.totalUsers) * 100).toFixed(2)}%
- **Duration**: ${(result.duration / 1000).toFixed(2)} seconds

## User Breakdown
- **Active Users**: ${result.summary.activeUsers}
- **Inactive Users**: ${result.summary.inactiveUsers}
- **Staff Users**: ${result.summary.staffUsers}
- **Super Users**: ${result.summary.superUsers}
- **Verified Emails**: ${result.summary.verifiedEmails}
- **Unverified Emails**: ${result.summary.unverifiedEmails}
- **Users with Custom Data**: ${result.summary.usersWithCustomData}

## Errors (${result.errors.length})
${result.errors
  .map(
    error => `
### ${error.email} (Django ID: ${error.djangoUserId})
- **Step**: ${error.step}
- **Error**: ${error.error}
- **Retry Count**: ${error.retryCount}
- **Timestamp**: ${error.timestamp}
`
  )
  .join('')}

## Recommendations
${this.generateRecommendations(result)}

Generated on: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * Generate recommendations based on migration results
   */
  static generateRecommendations(result: MigrationResult): string {
    const recommendations: string[] = [];

    const errorRate = result.failedMigrations / result.totalUsers;

    if (errorRate > 0.05) {
      recommendations.push(
        '- High error rate detected. Review error logs and consider re-running migration for failed users.'
      );
    }

    if (result.summary.unverifiedEmails > 0) {
      recommendations.push('- Send email verification requests to users with unverified emails.');
    }

    if (result.summary.inactiveUsers > 0) {
      recommendations.push(
        '- Review inactive users and consider account cleanup or reactivation procedures.'
      );
    }

    const duplicateEmailErrors = result.errors.filter(
      e => e.error.includes('duplicate') || e.error.includes('unique')
    );
    if (duplicateEmailErrors.length > 0) {
      recommendations.push('- Handle duplicate email addresses before retrying migration.');
    }

    if (result.successfulMigrations > 0) {
      recommendations.push('- Send password reset emails to successfully migrated users.');
      recommendations.push('- Update user communication about the authentication system change.');
    }

    return recommendations.length > 0
      ? recommendations.join('\n')
      : '- No specific recommendations. Migration appears successful.';
  }

  /**
   * Create rollback data structure
   */
  static createRollbackData(users: DjangoUser[]): {
    version: string;
    timestamp: string;
    userCount: number;
    users: DjangoUser[];
    checksum: string;
  } {
    const rollbackData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userCount: users.length,
      users,
      checksum: '', // Would implement actual checksum
    };

    // Generate simple checksum (in production, use proper cryptographic hash)
    rollbackData.checksum = this.generateChecksum(JSON.stringify(rollbackData.users));

    return rollbackData;
  }

  /**
   * Validate rollback data integrity
   */
  static validateRollbackData(rollbackData: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rollbackData.version) {
      errors.push('Missing rollback data version');
    }

    if (!rollbackData.timestamp) {
      errors.push('Missing rollback timestamp');
    }

    if (!rollbackData.users || !Array.isArray(rollbackData.users)) {
      errors.push('Invalid or missing users array');
    }

    if (rollbackData.userCount !== rollbackData.users?.length) {
      errors.push('User count mismatch');
    }

    if (!rollbackData.checksum) {
      warnings.push('Missing data integrity checksum');
    } else {
      const calculatedChecksum = this.generateChecksum(JSON.stringify(rollbackData.users));
      if (calculatedChecksum !== rollbackData.checksum) {
        errors.push('Data integrity check failed - checksum mismatch');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Analyze migration compatibility
   */
  static analyzeMigrationCompatibility(users: DjangoUser[]): {
    compatible: number;
    incompatible: number;
    issues: Array<{ userId: number; email: string; issues: string[] }>;
    summary: {
      emailIssues: number;
      usernameIssues: number;
      dataFormatIssues: number;
    };
  } {
    let compatible = 0;
    let incompatible = 0;
    const issues: Array<{ userId: number; email: string; issues: string[] }> = [];
    const summary = {
      emailIssues: 0,
      usernameIssues: 0,
      dataFormatIssues: 0,
    };

    for (const user of users) {
      const validation = this.validateDjangoUser(user);
      const userIssues: string[] = [...validation.errors, ...validation.warnings];

      if (validation.isValid) {
        compatible++;
      } else {
        incompatible++;
        issues.push({
          userId: user.id,
          email: user.email,
          issues: userIssues,
        });

        // Categorize issues
        userIssues.forEach(issue => {
          if (issue.toLowerCase().includes('email')) {
            summary.emailIssues++;
          } else if (issue.toLowerCase().includes('username')) {
            summary.usernameIssues++;
          } else {
            summary.dataFormatIssues++;
          }
        });
      }
    }

    return {
      compatible,
      incompatible,
      issues,
      summary,
    };
  }

  /**
   * Generate migration timeline estimate
   */
  static estimateMigrationTime(
    userCount: number,
    config: MigrationConfig
  ): {
    estimatedDuration: number; // minutes
    phases: Array<{ name: string; duration: number; description: string }>;
  } {
    const usersPerMinute = config.batchSize / 2; // Conservative estimate
    const migrationTime = Math.ceil(userCount / usersPerMinute);

    const phases = [
      {
        name: 'Preparation',
        duration: 10,
        description: 'Data validation and setup',
      },
      {
        name: 'User Migration',
        duration: migrationTime,
        description: 'Bulk user data migration',
      },
      {
        name: 'Validation',
        duration: Math.ceil(migrationTime * 0.2),
        description: 'Data integrity validation',
      },
      {
        name: 'Password Resets',
        duration: config.sendPasswordResets ? Math.ceil(userCount / 1000) : 0,
        description: 'Send password reset emails',
      },
      {
        name: 'Cleanup',
        duration: 5,
        description: 'Final cleanup and reporting',
      },
    ];

    const totalDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);

    return {
      estimatedDuration: totalDuration,
      phases: phases.filter(phase => phase.duration > 0),
    };
  }

  // Private utility methods

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private static isValidISODate(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      return date.toISOString() === dateString || !isNaN(date.getTime());
    } catch {
      return false;
    }
  }

  private static isValidPhoneNumber(phone: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^[+]?[\d\s\-()]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
  }

  private static generateChecksum(data: string): string {
    // Simple checksum for demonstration (use proper crypto hash in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Progress tracker for migration operations
 */
export class MigrationProgressTracker {
  private totalItems: number;
  private processedItems: number = 0;
  private startTime: number;
  private onProgress?: (progress: MigrationProgress) => void;

  constructor(totalItems: number, onProgress?: (progress: MigrationProgress) => void) {
    this.totalItems = totalItems;
    this.startTime = Date.now();
    this.onProgress = onProgress;
  }

  updateProgress(increment: number = 1): void {
    this.processedItems += increment;

    const progress = this.getProgress();
    this.onProgress?.(progress);
  }

  getProgress(): MigrationProgress {
    const elapsed = Date.now() - this.startTime;
    const percentComplete = (this.processedItems / this.totalItems) * 100;
    const itemsPerSecond = this.processedItems / (elapsed / 1000);
    const remainingItems = this.totalItems - this.processedItems;
    const estimatedTimeRemaining = (remainingItems / itemsPerSecond) * 1000;

    return {
      totalItems: this.totalItems,
      processedItems: this.processedItems,
      percentComplete: Math.round(percentComplete * 100) / 100,
      elapsedTime: elapsed,
      estimatedTimeRemaining: isFinite(estimatedTimeRemaining) ? estimatedTimeRemaining : 0,
      itemsPerSecond: Math.round(itemsPerSecond * 100) / 100,
    };
  }
}

export interface MigrationProgress {
  totalItems: number;
  processedItems: number;
  percentComplete: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  itemsPerSecond: number;
}

export default MigrationUtils;
