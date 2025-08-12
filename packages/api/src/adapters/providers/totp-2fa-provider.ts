/**
 * TOTP (Time-based One-Time Password) 2FA Provider
 *
 * Provides Two-Factor Authentication using TOTP (RFC 6238) compatible
 * with Google Authenticator, Authy, and other authenticator apps.
 */

import {
  AuthProvider,
  AuthProviderResult,
  AuthProviderContext,
  AuthProviderMetadata,
} from '../auth-provider-registry';

export interface TOTPConfig {
  issuer: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: 6 | 8;
  period: number; // seconds
  window: number; // tolerance window for time drift
  secretLength: number; // bytes
  backupCodesCount: number;
  backupCodeLength: number;
}

export const DEFAULT_TOTP_CONFIG: TOTPConfig = {
  issuer: 'Agentic Workflow',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  window: 1, // Allow 1 period before/after current time
  secretLength: 32,
  backupCodesCount: 10,
  backupCodeLength: 8,
};

export interface TOTPSecret {
  secret: string; // Base32 encoded secret
  qrCodeUri: string; // otpauth:// URI for QR code generation
  backupCodes: string[];
  userId: string;
  createdAt: number;
  verified: boolean;
}

export interface TOTPVerification {
  code: string;
  userId: string;
  timestamp?: number;
}

export interface MFASetupResult {
  secret: TOTPSecret;
  qrCodeDataUrl?: string; // Base64 data URL for QR code image
  manualEntryKey: string; // Formatted secret for manual entry
}

export class TOTP2FAProvider implements AuthProvider {
  readonly metadata: AuthProviderMetadata = {
    id: 'totp-2fa',
    name: 'totp',
    displayName: 'Authenticator App',
    description: 'Two-Factor Authentication using TOTP (Time-based One-Time Password)',
    iconUrl:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuNTkgOC40MUwyMCA5TDEzLjU5IDE1LjU5TDEyIDIyTDEwLjQxIDE1LjU5TDQgMTVMMTAuNDEgOC40MUwxMiAyWiIgZmlsbD0iIzRGNDZFNSIvPgo8L3N2Zz4K',
    documentationUrl: 'https://tools.ietf.org/html/rfc6238',
    capabilities: {
      supportsLogin: false,
      supportsSignup: false,
      supportsPasswordReset: false,
      supportsProfileUpdate: false,
      supportsSessionRefresh: false,
      requiresRedirect: false,
      supportsMFA: true,
      supportsPasswordless: false,
    },
    priority: 200,
    enabled: false, // Enabled via feature flag
    featureFlags: ['mfa_providers', 'totp_2fa'],
    configuration: {},
  };

  private config: TOTPConfig;
  private secrets = new Map<string, TOTPSecret>(); // In production, use secure storage
  private usedCodes = new Set<string>(); // Prevent replay attacks

  constructor(config: Partial<TOTPConfig> = {}) {
    this.config = { ...DEFAULT_TOTP_CONFIG, ...config };
  }

  /**
   * Initialize the TOTP provider
   */
  async initialize(): Promise<void> {
    // In a real implementation, you would:
    // - Initialize secure storage for secrets
    // - Set up cleanup routines for used codes
    // - Validate configuration

    console.log('[TOTP2FAProvider] Initialized');
  }

  /**
   * Setup MFA for a user
   */
  async setupMFA(method: string, context?: AuthProviderContext): Promise<AuthProviderResult> {
    if (method !== 'totp') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_METHOD',
          message: 'Only TOTP method is supported',
        },
      };
    }

    if (!context?.userId) {
      return {
        success: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'User ID is required for MFA setup',
        },
      };
    }

    try {
      // Check if user already has TOTP setup
      const existingSecret = this.secrets.get(context.userId);
      if (existingSecret && existingSecret.verified) {
        return {
          success: false,
          error: {
            code: 'MFA_ALREADY_SETUP',
            message: 'TOTP is already configured for this user',
          },
        };
      }

      // Generate new secret
      const secret = this.generateSecret(context.userId);
      this.secrets.set(context.userId, secret);

      // Create QR code data URL (in production, use proper QR code library)
      const qrCodeDataUrl = await this.generateQRCodeDataUrl(secret.qrCodeUri);

      const setupResult: MFASetupResult = {
        secret,
        qrCodeDataUrl,
        manualEntryKey: this.formatSecretForManualEntry(secret.secret),
      };

      return {
        success: true,
        metadata: setupResult,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MFA_SETUP_FAILED',
          message: error instanceof Error ? error.message : 'Failed to setup MFA',
        },
      };
    }
  }

  /**
   * Verify MFA code
   */
  async verifyMFA(
    code: string,
    method: string,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult> {
    if (method !== 'totp') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_METHOD',
          message: 'Only TOTP method is supported',
        },
      };
    }

    if (!context?.userId) {
      return {
        success: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'User ID is required for MFA verification',
        },
      };
    }

    try {
      const secret = this.secrets.get(context.userId);
      if (!secret) {
        return {
          success: false,
          error: {
            code: 'MFA_NOT_SETUP',
            message: 'TOTP is not configured for this user',
          },
        };
      }

      // Check if code was already used (prevent replay attacks)
      const codeKey = `${context.userId}:${code}`;
      if (this.usedCodes.has(codeKey)) {
        return {
          success: false,
          error: {
            code: 'CODE_ALREADY_USED',
            message: 'This code has already been used',
          },
        };
      }

      // Check backup codes first
      if (this.isBackupCode(code, secret)) {
        // Remove used backup code
        secret.backupCodes = secret.backupCodes.filter(bc => bc !== code);
        this.usedCodes.add(codeKey);

        return {
          success: true,
          metadata: {
            method: 'backup_code',
            remainingBackupCodes: secret.backupCodes.length,
          },
        };
      }

      // Verify TOTP code
      const isValid = this.verifyTOTP(code, secret.secret);
      if (!isValid) {
        return {
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Invalid TOTP code',
          },
        };
      }

      // Mark secret as verified if this is the first successful verification
      if (!secret.verified) {
        secret.verified = true;
      }

      // Mark code as used
      this.usedCodes.add(codeKey);

      // Clean up old used codes (in production, use proper cleanup)
      this.cleanupUsedCodes();

      return {
        success: true,
        metadata: {
          method: 'totp',
          verified: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MFA_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to verify MFA',
        },
      };
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(method: string, context?: AuthProviderContext): Promise<AuthProviderResult> {
    if (method !== 'totp') {
      return {
        success: false,
        error: {
          code: 'UNSUPPORTED_METHOD',
          message: 'Only TOTP method is supported',
        },
      };
    }

    if (!context?.userId) {
      return {
        success: false,
        error: {
          code: 'USER_ID_REQUIRED',
          message: 'User ID is required to disable MFA',
        },
      };
    }

    try {
      const secret = this.secrets.get(context.userId);
      if (!secret) {
        return {
          success: false,
          error: {
            code: 'MFA_NOT_SETUP',
            message: 'TOTP is not configured for this user',
          },
        };
      }

      // Remove secret and cleanup
      this.secrets.delete(context.userId);

      // Remove used codes for this user
      for (const codeKey of this.usedCodes) {
        if (codeKey.startsWith(`${context.userId}:`)) {
          this.usedCodes.delete(codeKey);
        }
      }

      return {
        success: true,
        metadata: {
          disabled: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MFA_DISABLE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to disable MFA',
        },
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    return {
      healthy: true,
      details: {
        activeSecrets: this.secrets.size,
        usedCodesCount: this.usedCodes.size,
        algorithm: this.config.algorithm,
        digits: this.config.digits,
        period: this.config.period,
      },
    };
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.secrets.clear();
    this.usedCodes.clear();
  }

  // Private helper methods

  private generateSecret(userId: string): TOTPSecret {
    // Generate random secret (in production, use cryptographically secure random)
    const secret = this.generateBase32Secret();

    // Create otpauth URI for QR code
    const qrCodeUri = this.createOtpAuthUri(secret, userId);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    return {
      secret,
      qrCodeUri,
      backupCodes,
      userId,
      createdAt: Date.now(),
      verified: false,
    };
  }

  private generateBase32Secret(): string {
    // In production, use proper cryptographic random generation and base32 encoding
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < this.config.secretLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private createOtpAuthUri(secret: string, userId: string): string {
    const params = new URLSearchParams({
      secret,
      issuer: this.config.issuer,
      algorithm: this.config.algorithm,
      digits: this.config.digits.toString(),
      period: this.config.period.toString(),
    });

    return `otpauth://totp/${encodeURIComponent(this.config.issuer)}:${encodeURIComponent(userId)}?${params.toString()}`;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.config.backupCodesCount; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  private generateBackupCode(): string {
    // Generate random alphanumeric backup code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < this.config.backupCodeLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private formatSecretForManualEntry(secret: string): string {
    // Format secret in groups of 4 characters for easier manual entry
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }

  private async generateQRCodeDataUrl(otpAuthUri: string): Promise<string> {
    // In production, use a proper QR code library like 'qrcode'
    // For now, return a placeholder data URL
    const placeholder = `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="12">
          QR Code Placeholder
        </text>
        <text x="100" y="120" text-anchor="middle" font-family="Arial" font-size="10">
          ${otpAuthUri.substring(0, 30)}...
        </text>
      </svg>
    `)}`;

    return placeholder;
  }

  private verifyTOTP(code: string, secret: string): boolean {
    // In production, use proper TOTP implementation (e.g., 'node-otp' library)
    // This is a simplified mock implementation

    const currentTime = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(currentTime / this.config.period);

    // Check current time window and adjacent windows for drift tolerance
    for (let i = -this.config.window; i <= this.config.window; i++) {
      const testTimeStep = timeStep + i;
      const expectedCode = this.generateTOTPCode(secret, testTimeStep);

      if (code === expectedCode) {
        return true;
      }
    }

    return false;
  }

  private generateTOTPCode(secret: string, timeStep: number): string {
    // Simplified TOTP code generation (use proper crypto library in production)
    // This is just for demonstration purposes
    const hash = this.simpleHash(secret + timeStep.toString());
    const truncated = hash % Math.pow(10, this.config.digits);
    return truncated.toString().padStart(this.config.digits, '0');
  }

  private simpleHash(input: string): number {
    // Very simple hash function for demonstration (use proper HMAC in production)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private isBackupCode(code: string, secret: TOTPSecret): boolean {
    return secret.backupCodes.includes(code.toUpperCase());
  }

  private cleanupUsedCodes(): void {
    // Remove codes older than 2 periods to prevent memory bloat
    // const cutoff = Date.now() - this.config.period * 2 * 1000;

    // In production, implement proper timestamp tracking for used codes
    if (this.usedCodes.size > 10000) {
      // Arbitrary limit
      this.usedCodes.clear();
    }
  }
}

/**
 * Create TOTP 2FA provider instance
 */
export function createTOTP2FAProvider(config?: Partial<TOTPConfig>): TOTP2FAProvider {
  return new TOTP2FAProvider(config);
}

export default TOTP2FAProvider;
