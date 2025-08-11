/**
 * WebAuthn Biometric Authentication Provider
 *
 * Provides biometric authentication using the Web Authentication API (WebAuthn)
 * supporting fingerprint, face recognition, and hardware security keys.
 */

import {
  AuthProvider,
  AuthProviderResult,
  AuthProviderContext,
  AuthProviderMetadata,
} from '../auth-provider-registry';
import { AuthUser } from '@agentic-workflow/shared';

export interface WebAuthnConfig {
  rpName: string; // Relying Party name
  rpId: string; // Relying Party identifier (domain)
  origin: string; // Expected origin
  timeout: number; // Timeout in milliseconds
  userVerification: 'required' | 'preferred' | 'discouraged';
  authenticatorAttachment: 'platform' | 'cross-platform' | null;
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise';
  supportedAlgorithms: number[]; // COSE algorithm identifiers
  challengeLength: number; // bytes
  enableConditionalUI: boolean;
}

export const DEFAULT_WEBAUTHN_CONFIG: WebAuthnConfig = {
  rpName: 'Agentic Workflow',
  rpId: 'localhost', // Should be set to actual domain in production
  origin: 'http://localhost:3000',
  timeout: 60000, // 60 seconds
  userVerification: 'preferred',
  authenticatorAttachment: null, // Allow both platform and cross-platform
  attestation: 'none',
  supportedAlgorithms: [-7, -257], // ES256, RS256
  challengeLength: 32,
  enableConditionalUI: true,
};

export interface WebAuthnCapabilities {
  isSupported: boolean;
  isPlatformAuthenticatorAvailable: boolean;
  isConditionalMediationAvailable: boolean;
  supportedTransports: string[];
  browserInfo: {
    name: string;
    version: string;
    isSecureContext: boolean;
  };
}

export interface WebAuthnCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
  publicKey: ArrayBuffer;
  counter: number;
  userId: string;
  userHandle: ArrayBuffer;
  transports: string[];
  createdAt: number;
  lastUsed: number;
  nickname?: string;
  aaguid?: string; // Authenticator AAGUID
}

export interface RegistrationOptions {
  challenge: ArrayBuffer;
  rp: {
    name: string;
    id: string;
  };
  user: {
    id: ArrayBuffer;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number;
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification?: 'required' | 'preferred' | 'discouraged';
    requireResidentKey?: boolean;
  };
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise';
  excludeCredentials?: Array<{
    type: 'public-key';
    id: ArrayBuffer;
    transports?: string[];
  }>;
}

export interface AuthenticationOptions {
  challenge: ArrayBuffer;
  timeout?: number;
  rpId?: string;
  userVerification?: 'required' | 'preferred' | 'discouraged';
  allowCredentials?: Array<{
    type: 'public-key';
    id: ArrayBuffer;
    transports?: string[];
  }>;
}

export class WebAuthnProvider implements AuthProvider {
  readonly metadata: AuthProviderMetadata = {
    id: 'webauthn',
    name: 'webauthn',
    displayName: 'Biometric Authentication',
    description: 'Sign in using fingerprint, face recognition, or security keys',
    iconUrl:
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEwQzEzLjY1NjkgMTAgMTUgOC42NTY4NSAxNSA3QzE1IDUuMzQzMTUgMTMuNjU2OSA0IDEyIDRDMTAuMzQzMSA0IDkgNS4zNDMxNSA5IDdDOSA4LjY1Njg1IDEwLjM0MzEgMTAgMTIgMTBaIiBmaWxsPSIjNEY0NkU1Ii8+CjxwYXRoIGQ9Ik0xOSAxN0MxOSAxOS4yMDkxIDE3LjIwOTEgMjEgMTUgMjFIOU0xOSAxN0MxOSAxNC43OTA5IDE3LjIwOTEgMTMgMTUgMTNIOU0xOSAxN1YxOE0xNSAxM0MxNyAxMyAxOSAxNS43OTA5IDE5IDE3IiBzdHJva2U9IiM0RjQ2RTUiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K',
    documentationUrl: 'https://webauthn.guide/',
    capabilities: {
      supportsLogin: true,
      supportsSignup: true,
      supportsPasswordReset: false,
      supportsProfileUpdate: false,
      supportsSessionRefresh: false,
      requiresRedirect: false,
      supportsMFA: true,
      supportsPasswordless: true,
    },
    priority: 300,
    enabled: false, // Enabled via feature flag
    featureFlags: ['biometric_auth', 'webauthn'],
    configuration: {},
  };

  private config: WebAuthnConfig;
  private credentials = new Map<string, WebAuthnCredential[]>(); // userId -> credentials
  private challenges = new Map<string, { challenge: ArrayBuffer; expires: number }>(); // challengeId -> challenge

  constructor(config: Partial<WebAuthnConfig> = {}) {
    this.config = { ...DEFAULT_WEBAUTHN_CONFIG, ...config };
  }

  /**
   * Initialize WebAuthn provider
   */
  async initialize(): Promise<void> {
    // Validate browser support
    const capabilities = await this.detectCapabilities();

    if (!capabilities.isSupported) {
      console.warn('[WebAuthnProvider] WebAuthn is not supported in this environment');
    } else {
      console.log('[WebAuthnProvider] Initialized with capabilities:', capabilities);
    }
  }

  /**
   * Detect WebAuthn capabilities
   */
  async detectCapabilities(): Promise<WebAuthnCapabilities> {
    const isSupported = this.isWebAuthnSupported();

    if (!isSupported) {
      return {
        isSupported: false,
        isPlatformAuthenticatorAvailable: false,
        isConditionalMediationAvailable: false,
        supportedTransports: [],
        browserInfo: this.getBrowserInfo(),
      };
    }

    try {
      // Check for platform authenticator (biometric)
      const isPlatformAuthenticatorAvailable = await this.checkPlatformAuthenticator();

      // Check for conditional UI support
      const isConditionalMediationAvailable = await this.checkConditionalMediation();

      return {
        isSupported: true,
        isPlatformAuthenticatorAvailable,
        isConditionalMediationAvailable,
        supportedTransports: ['usb', 'nfc', 'ble', 'internal'],
        browserInfo: this.getBrowserInfo(),
      };
    } catch (error) {
      console.warn('[WebAuthnProvider] Error detecting capabilities:', error);
      return {
        isSupported: false,
        isPlatformAuthenticatorAvailable: false,
        isConditionalMediationAvailable: false,
        supportedTransports: [],
        browserInfo: this.getBrowserInfo(),
      };
    }
  }

  /**
   * Register a new biometric credential
   */
  async signup(
    userData: Record<string, any>,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult> {
    if (!this.isWebAuthnSupported()) {
      return {
        success: false,
        error: {
          code: 'WEBAUTHN_NOT_SUPPORTED',
          message: 'WebAuthn is not supported in this browser',
        },
      };
    }

    try {
      const { email, name, userId } = userData;

      if (!userId || !email || !name) {
        return {
          success: false,
          error: {
            code: 'INVALID_USER_DATA',
            message: 'User ID, email, and name are required',
          },
        };
      }

      // Generate registration options
      const options = this.generateRegistrationOptions(userId, email, name);

      return {
        success: true,
        metadata: {
          registrationOptions: this.serializeRegistrationOptions(options),
          step: 'registration_challenge',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initiate registration',
        },
      };
    }
  }

  /**
   * Authenticate with biometric credential
   */
  async login(
    credentials: Record<string, any>,
    context?: AuthProviderContext
  ): Promise<AuthProviderResult> {
    if (!this.isWebAuthnSupported()) {
      return {
        success: false,
        error: {
          code: 'WEBAUTHN_NOT_SUPPORTED',
          message: 'WebAuthn is not supported in this browser',
        },
      };
    }

    try {
      const { userId, email } = credentials;

      // Generate authentication options
      const options = this.generateAuthenticationOptions(userId);

      return {
        success: true,
        metadata: {
          authenticationOptions: this.serializeAuthenticationOptions(options),
          step: 'authentication_challenge',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initiate authentication',
        },
      };
    }
  }

  /**
   * Complete WebAuthn registration
   */
  async completeRegistration(
    attestationResponse: any,
    userId: string,
    challengeId: string
  ): Promise<AuthProviderResult> {
    try {
      // Verify challenge
      const storedChallenge = this.challenges.get(challengeId);
      if (!storedChallenge || storedChallenge.expires < Date.now()) {
        return {
          success: false,
          error: {
            code: 'INVALID_CHALLENGE',
            message: 'Challenge is invalid or expired',
          },
        };
      }

      // In production, perform full attestation verification
      const credential = this.processAttestationResponse(attestationResponse, userId);

      // Store credential
      const userCredentials = this.credentials.get(userId) || [];
      userCredentials.push(credential);
      this.credentials.set(userId, userCredentials);

      // Clean up challenge
      this.challenges.delete(challengeId);

      return {
        success: true,
        metadata: {
          credentialId: credential.id,
          transports: credential.transports,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REGISTRATION_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to verify registration',
        },
      };
    }
  }

  /**
   * Complete WebAuthn authentication
   */
  async completeAuthentication(
    assertionResponse: any,
    challengeId: string
  ): Promise<AuthProviderResult> {
    try {
      // Verify challenge
      const storedChallenge = this.challenges.get(challengeId);
      if (!storedChallenge || storedChallenge.expires < Date.now()) {
        return {
          success: false,
          error: {
            code: 'INVALID_CHALLENGE',
            message: 'Challenge is invalid or expired',
          },
        };
      }

      // In production, perform full assertion verification
      const { credentialId, userId } = this.processAssertionResponse(assertionResponse);

      // Update credential last used
      const userCredentials = this.credentials.get(userId);
      if (userCredentials) {
        const credential = userCredentials.find(c => c.id === credentialId);
        if (credential) {
          credential.lastUsed = Date.now();
          credential.counter++; // Increment signature counter
        }
      }

      // Clean up challenge
      this.challenges.delete(challengeId);

      // Create mock user for demonstration
      const user: AuthUser = {
        id: userId,
        email: `user-${userId}@example.com`,
        name: `WebAuthn User ${userId}`,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          provider: 'webauthn',
          authenticatorType: 'biometric',
        },
      };

      return {
        success: true,
        user,
        metadata: {
          credentialId,
          authenticatorType: 'biometric',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTHENTICATION_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to verify authentication',
        },
      };
    }
  }

  /**
   * Get user credentials
   */
  getUserCredentials(userId: string): WebAuthnCredential[] {
    return this.credentials.get(userId) || [];
  }

  /**
   * Remove a credential
   */
  async removeCredential(userId: string, credentialId: string): Promise<AuthProviderResult> {
    try {
      const userCredentials = this.credentials.get(userId);
      if (!userCredentials) {
        return {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'No credentials found for user',
          },
        };
      }

      const updatedCredentials = userCredentials.filter(c => c.id !== credentialId);
      this.credentials.set(userId, updatedCredentials);

      return {
        success: true,
        metadata: {
          removedCredentialId: credentialId,
          remainingCredentials: updatedCredentials.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREDENTIAL_REMOVAL_FAILED',
          message: error instanceof Error ? error.message : 'Failed to remove credential',
        },
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; details?: Record<string, any> }> {
    const capabilities = await this.detectCapabilities();

    return {
      healthy: capabilities.isSupported,
      details: {
        ...capabilities,
        registeredUsers: this.credentials.size,
        totalCredentials: Array.from(this.credentials.values()).reduce(
          (sum, creds) => sum + creds.length,
          0
        ),
        pendingChallenges: this.challenges.size,
      },
    };
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    this.credentials.clear();
    this.challenges.clear();
  }

  // Private helper methods

  private isWebAuthnSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'navigator' in window &&
      'credentials' in navigator &&
      'create' in navigator.credentials &&
      'get' in navigator.credentials &&
      typeof PublicKeyCredential !== 'undefined'
    );
  }

  private async checkPlatformAuthenticator(): Promise<boolean> {
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  private async checkConditionalMediation(): Promise<boolean> {
    try {
      return await PublicKeyCredential.isConditionalMediationAvailable();
    } catch {
      return false;
    }
  }

  private getBrowserInfo() {
    if (typeof window === 'undefined') {
      return { name: 'Unknown', version: 'Unknown', isSecureContext: false };
    }

    const isSecureContext = window.isSecureContext;
    const userAgent = navigator.userAgent;

    // Simple browser detection
    let name = 'Unknown';
    let version = 'Unknown';

    if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Firefox')) {
      name = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Safari')) {
      name = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    }

    return { name, version, isSecureContext };
  }

  private generateRegistrationOptions(
    userId: string,
    email: string,
    name: string
  ): RegistrationOptions {
    const challenge = this.generateChallenge();
    const challengeId = this.storeChallenge(challenge);

    const userIdBuffer = new TextEncoder().encode(userId);

    return {
      challenge,
      rp: {
        name: this.config.rpName,
        id: this.config.rpId,
      },
      user: {
        id: userIdBuffer,
        name: email,
        displayName: name,
      },
      pubKeyCredParams: this.config.supportedAlgorithms.map(alg => ({
        type: 'public-key' as const,
        alg,
      })),
      authenticatorSelection: {
        authenticatorAttachment: this.config.authenticatorAttachment || undefined,
        userVerification: this.config.userVerification,
        requireResidentKey: false,
      },
      timeout: this.config.timeout,
      attestation: this.config.attestation,
      excludeCredentials: this.getExistingCredentialsForExclusion(userId),
    };
  }

  private generateAuthenticationOptions(userId?: string): AuthenticationOptions {
    const challenge = this.generateChallenge();
    const challengeId = this.storeChallenge(challenge);

    return {
      challenge,
      timeout: this.config.timeout,
      rpId: this.config.rpId,
      userVerification: this.config.userVerification,
      allowCredentials: userId ? this.getAllowedCredentials(userId) : undefined,
    };
  }

  private generateChallenge(): ArrayBuffer {
    const challenge = new Uint8Array(this.config.challengeLength);
    crypto.getRandomValues(challenge);
    return challenge.buffer;
  }

  private storeChallenge(challenge: ArrayBuffer): string {
    const challengeId = Math.random().toString(36).substring(2);
    this.challenges.set(challengeId, {
      challenge,
      expires: Date.now() + this.config.timeout,
    });
    return challengeId;
  }

  private getExistingCredentialsForExclusion(userId: string) {
    const userCredentials = this.credentials.get(userId) || [];
    return userCredentials.map(cred => ({
      type: 'public-key' as const,
      id: cred.rawId,
      transports: cred.transports as AuthenticatorTransport[],
    }));
  }

  private getAllowedCredentials(userId: string) {
    const userCredentials = this.credentials.get(userId) || [];
    return userCredentials.map(cred => ({
      type: 'public-key' as const,
      id: cred.rawId,
      transports: cred.transports as AuthenticatorTransport[],
    }));
  }

  private processAttestationResponse(response: any, userId: string): WebAuthnCredential {
    // In production, perform full cryptographic verification
    return {
      id: response.id,
      rawId: response.rawId,
      type: 'public-key',
      publicKey: response.response.publicKey || new ArrayBuffer(0),
      counter: 0,
      userId,
      userHandle: new TextEncoder().encode(userId),
      transports: response.response.transports || [],
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
  }

  private processAssertionResponse(response: any): { credentialId: string; userId: string } {
    // In production, perform full cryptographic verification
    return {
      credentialId: response.id,
      userId: new TextDecoder().decode(response.response.userHandle),
    };
  }

  private serializeRegistrationOptions(options: RegistrationOptions): any {
    // Convert ArrayBuffers to base64 for JSON serialization
    return {
      ...options,
      challenge: this.arrayBufferToBase64(options.challenge),
      user: {
        ...options.user,
        id: this.arrayBufferToBase64(options.user.id),
      },
      excludeCredentials: options.excludeCredentials?.map(cred => ({
        ...cred,
        id: this.arrayBufferToBase64(cred.id),
      })),
    };
  }

  private serializeAuthenticationOptions(options: AuthenticationOptions): any {
    return {
      ...options,
      challenge: this.arrayBufferToBase64(options.challenge),
      allowCredentials: options.allowCredentials?.map(cred => ({
        ...cred,
        id: this.arrayBufferToBase64(cred.id),
      })),
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  }
}

/**
 * Create WebAuthn provider instance
 */
export function createWebAuthnProvider(config?: Partial<WebAuthnConfig>): WebAuthnProvider {
  return new WebAuthnProvider(config);
}

export default WebAuthnProvider;
