/**
 * Authentication Capability Detector
 *
 * Detects and reports on available authentication capabilities in the
 * current environment, including WebAuthn, OAuth, and other auth methods.
 */

export interface AuthCapabilities {
  webauthn: WebAuthnCapabilities;
  oauth: OAuthCapabilities;
  biometric: BiometricCapabilities;
  security: SecurityCapabilities;
  browser: BrowserCapabilities;
  device: DeviceCapabilities;
  network: NetworkCapabilities;
}

export interface WebAuthnCapabilities {
  supported: boolean;
  platformAuthenticator: boolean;
  conditionalMediation: boolean;
  userVerifyingPlatformAuthenticator: boolean;
  residentKeySupport: boolean;
  supportedTransports: string[];
  supportedAlgorithms: number[];
  largeBlob: boolean;
  credentialManagement: boolean;
}

export interface OAuthCapabilities {
  supported: boolean;
  popupSupported: boolean;
  redirectSupported: boolean;
  pkceSupported: boolean;
  customSchemes: boolean;
  thirdPartyCookies: boolean;
  crossOriginIframes: boolean;
}

export interface BiometricCapabilities {
  fingerprint: boolean;
  faceId: boolean;
  touchId: boolean;
  platformBiometrics: boolean;
  deviceTrust: boolean;
}

export interface SecurityCapabilities {
  secureContext: boolean;
  cryptoAPI: boolean;
  webCrypto: boolean;
  csrfProtection: boolean;
  corsSupport: boolean;
  cspSupport: boolean;
  httpOnlyStorage: boolean;
  secureStorage: boolean;
}

export interface BrowserCapabilities {
  name: string;
  version: string;
  engine: string;
  mobile: boolean;
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  serviceWorker: boolean;
  pushNotifications: boolean;
  geolocation: boolean;
}

export interface DeviceCapabilities {
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  mobile: boolean;
  os: string;
  platform: string;
  touchScreen: boolean;
  camera: boolean;
  microphone: boolean;
  sensors: {
    accelerometer: boolean;
    gyroscope: boolean;
    magnetometer: boolean;
  };
  connectivity: string[];
}

export interface NetworkCapabilities {
  online: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface CapabilityReport {
  capabilities: AuthCapabilities;
  recommendations: string[];
  warnings: string[];
  compatibility: {
    score: number; // 0-100
    level: 'poor' | 'basic' | 'good' | 'excellent';
    supportedMethods: string[];
    unsupportedMethods: string[];
  };
  timestamp: number;
  environment: 'development' | 'production' | 'testing';
}

export class AuthCapabilityDetector {
  private cache = new Map<string, any>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Detect all authentication capabilities
   */
  async detectCapabilities(): Promise<AuthCapabilities> {
    const cacheKey = 'auth-capabilities';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const capabilities: AuthCapabilities = {
      webauthn: await this.detectWebAuthnCapabilities(),
      oauth: await this.detectOAuthCapabilities(),
      biometric: await this.detectBiometricCapabilities(),
      security: await this.detectSecurityCapabilities(),
      browser: await this.detectBrowserCapabilities(),
      device: await this.detectDeviceCapabilities(),
      network: await this.detectNetworkCapabilities(),
    };

    this.setCached(cacheKey, capabilities);
    return capabilities;
  }

  /**
   * Generate capability report with recommendations
   */
  async generateReport(): Promise<CapabilityReport> {
    const capabilities = await this.detectCapabilities();
    const compatibility = this.assessCompatibility(capabilities);
    const recommendations = this.generateRecommendations(capabilities);
    const warnings = this.generateWarnings(capabilities);

    return {
      capabilities,
      recommendations,
      warnings,
      compatibility,
      timestamp: Date.now(),
      environment: this.detectEnvironment(),
    };
  }

  /**
   * Detect WebAuthn capabilities
   */
  private async detectWebAuthnCapabilities(): Promise<WebAuthnCapabilities> {
    if (typeof window === 'undefined' || !window.navigator) {
      return this.getDefaultWebAuthnCapabilities();
    }

    try {
      const supported =
        'credentials' in navigator &&
        'create' in navigator.credentials &&
        typeof PublicKeyCredential !== 'undefined';

      if (!supported) {
        return { ...this.getDefaultWebAuthnCapabilities(), supported: false };
      }

      const [platformAuthenticator, conditionalMediation, userVerifyingPlatformAuthenticator] =
        await Promise.allSettled([
          typeof (globalThis as any).PublicKeyCredential !== 'undefined'
            ? (
                globalThis as any
              ).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            : Promise.resolve(false),
          this.checkConditionalMediation(),
          typeof (globalThis as any).PublicKeyCredential !== 'undefined'
            ? (
                globalThis as any
              ).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            : Promise.resolve(false),
        ]);

      return {
        supported: true,
        platformAuthenticator: this.getSettledValue(platformAuthenticator, false),
        conditionalMediation: this.getSettledValue(conditionalMediation, false),
        userVerifyingPlatformAuthenticator: this.getSettledValue(
          userVerifyingPlatformAuthenticator,
          false
        ),
        residentKeySupport: this.checkResidentKeySupport(),
        supportedTransports: ['usb', 'nfc', 'ble', 'internal'],
        supportedAlgorithms: [-7, -35, -36, -257, -258, -259],
        largeBlob: this.checkLargeBlobSupport(),
        credentialManagement: 'credentialsContainer' in window,
      };
    } catch (error) {
      console.warn('Error detecting WebAuthn capabilities:', error);
      return this.getDefaultWebAuthnCapabilities();
    }
  }

  /**
   * Detect OAuth capabilities
   */
  private async detectOAuthCapabilities(): Promise<OAuthCapabilities> {
    if (typeof window === 'undefined') {
      return {
        supported: false,
        popupSupported: false,
        redirectSupported: false,
        pkceSupported: false,
        customSchemes: false,
        thirdPartyCookies: false,
        crossOriginIframes: false,
      };
    }

    return {
      supported: true,
      popupSupported: typeof window.open === 'function',
      redirectSupported: typeof window.location === 'object',
      pkceSupported: 'crypto' in window && 'subtle' in window.crypto,
      customSchemes: this.checkCustomSchemeSupport(),
      thirdPartyCookies: await this.checkThirdPartyCookies(),
      crossOriginIframes: this.checkCrossOriginIframes(),
    };
  }

  /**
   * Detect biometric capabilities
   */
  private async detectBiometricCapabilities(): Promise<BiometricCapabilities> {
    if (typeof window === 'undefined' || !window.navigator) {
      return {
        fingerprint: false,
        faceId: false,
        touchId: false,
        platformBiometrics: false,
        deviceTrust: false,
      };
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isMac = /macintosh/.test(userAgent);

    let platformBiometrics = false;
    try {
      if (typeof (globalThis as any).PublicKeyCredential !== 'undefined') {
        platformBiometrics = await (
          globalThis as any
        ).PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      }
    } catch {
      // Ignore error
    }

    return {
      fingerprint: isAndroid || platformBiometrics,
      faceId: isIOS || isMac,
      touchId: isIOS || isMac,
      platformBiometrics,
      deviceTrust: platformBiometrics,
    };
  }

  /**
   * Detect security capabilities
   */
  private async detectSecurityCapabilities(): Promise<SecurityCapabilities> {
    if (typeof window === 'undefined') {
      return {
        secureContext: false,
        cryptoAPI: false,
        webCrypto: false,
        csrfProtection: false,
        corsSupport: false,
        cspSupport: false,
        httpOnlyStorage: false,
        secureStorage: false,
      };
    }

    return {
      secureContext: window.isSecureContext || false,
      cryptoAPI: 'crypto' in window,
      webCrypto: 'crypto' in window && 'subtle' in window.crypto,
      csrfProtection: true, // Application-level implementation
      corsSupport: 'fetch' in window,
      cspSupport: 'SecurityPolicyViolationEvent' in window,
      httpOnlyStorage: this.checkHttpOnlyStorage(),
      secureStorage: window.isSecureContext && 'localStorage' in window,
    };
  }

  /**
   * Detect browser capabilities
   */
  private async detectBrowserCapabilities(): Promise<BrowserCapabilities> {
    if (typeof window === 'undefined' || !window.navigator) {
      return {
        name: 'Unknown',
        version: 'Unknown',
        engine: 'Unknown',
        mobile: false,
        cookies: false,
        localStorage: false,
        sessionStorage: false,
        indexedDB: false,
        serviceWorker: false,
        pushNotifications: false,
        geolocation: false,
      };
    }

    const userAgent = navigator.userAgent;
    const browserInfo = this.parseBrowserInfo(userAgent);

    return {
      ...browserInfo,
      mobile: /Mobi|Android/i.test(userAgent),
      cookies: navigator.cookieEnabled,
      localStorage: 'localStorage' in window,
      sessionStorage: 'sessionStorage' in window,
      indexedDB: 'indexedDB' in window,
      serviceWorker: 'serviceWorker' in navigator,
      pushNotifications: 'PushManager' in window,
      geolocation: 'geolocation' in navigator,
    };
  }

  /**
   * Detect device capabilities
   */
  private async detectDeviceCapabilities(): Promise<DeviceCapabilities> {
    if (typeof window === 'undefined' || !window.navigator) {
      return {
        type: 'unknown',
        mobile: false,
        os: 'Unknown',
        platform: 'Unknown',
        touchScreen: false,
        camera: false,
        microphone: false,
        sensors: {
          accelerometer: false,
          gyroscope: false,
          magnetometer: false,
        },
        connectivity: [],
      };
    }

    const userAgent = navigator.userAgent;
    const deviceInfo = this.parseDeviceInfo(userAgent);

    return {
      ...deviceInfo,
      mobile: deviceInfo.type === 'mobile',
      touchScreen: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      camera: await this.checkCameraAccess(),
      microphone: await this.checkMicrophoneAccess(),
      sensors: {
        accelerometer: 'DeviceMotionEvent' in window,
        gyroscope: 'DeviceOrientationEvent' in window,
        magnetometer: 'ondeviceorientationabsolute' in window,
      },
      connectivity: this.getConnectivityTypes(),
    };
  }

  /**
   * Detect network capabilities
   */
  private async detectNetworkCapabilities(): Promise<NetworkCapabilities> {
    if (typeof window === 'undefined' || !window.navigator) {
      return {
        online: false,
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false,
      };
    }

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    return {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false,
    };
  }

  // Helper methods

  private getDefaultWebAuthnCapabilities(): WebAuthnCapabilities {
    return {
      supported: false,
      platformAuthenticator: false,
      conditionalMediation: false,
      userVerifyingPlatformAuthenticator: false,
      residentKeySupport: false,
      supportedTransports: [],
      supportedAlgorithms: [],
      largeBlob: false,
      credentialManagement: false,
    };
  }

  private async checkConditionalMediation(): Promise<boolean> {
    try {
      if (typeof (globalThis as any).PublicKeyCredential !== 'undefined') {
        return await (globalThis as any).PublicKeyCredential.isConditionalMediationAvailable();
      }
      return false;
    } catch {
      return false;
    }
  }

  private checkResidentKeySupport(): boolean {
    // Check if browser supports resident keys (discoverable credentials)
    return typeof (globalThis as any).PublicKeyCredential !== 'undefined';
  }

  private checkLargeBlobSupport(): boolean {
    // Check if browser supports large blob extension
    return typeof PublicKeyCredential !== 'undefined';
  }

  private checkCustomSchemeSupport(): boolean {
    // Check if custom URL schemes are supported
    return typeof window !== 'undefined' && 'location' in window;
  }

  private async checkThirdPartyCookies(): Promise<boolean> {
    // Simple third-party cookie test
    try {
      document.cookie = 'test-3p-cookie=test; SameSite=None; Secure';
      const supported = document.cookie.includes('test-3p-cookie');
      document.cookie = 'test-3p-cookie=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      return supported;
    } catch {
      return false;
    }
  }

  private checkCrossOriginIframes(): boolean {
    return typeof window !== 'undefined' && 'postMessage' in window;
  }

  private checkHttpOnlyStorage(): boolean {
    // Check if httpOnly storage is available (server-side only)
    return false; // Client-side cannot access httpOnly
  }

  private parseBrowserInfo(userAgent: string): { name: string; version: string; engine: string } {
    let name = 'Unknown';
    let version = 'Unknown';
    let engine = 'Unknown';

    if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      engine = 'Blink';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Firefox')) {
      name = 'Firefox';
      engine = 'Gecko';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Safari')) {
      name = 'Safari';
      engine = 'WebKit';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Edge')) {
      name = 'Edge';
      engine = 'Blink';
      const match = userAgent.match(/Edg\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    }

    return { name, version, engine };
  }

  private parseDeviceInfo(userAgent: string): {
    type: DeviceCapabilities['type'];
    os: string;
    platform: string;
  } {
    let type: DeviceCapabilities['type'] = 'unknown';
    let os = 'Unknown';
    let platform = 'Unknown';

    if (/Mobi|Android/i.test(userAgent)) {
      type = 'mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
      type = 'tablet';
    } else {
      type = 'desktop';
    }

    if (userAgent.includes('Windows')) {
      os = 'Windows';
      platform = 'PC';
    } else if (userAgent.includes('Mac')) {
      os = 'macOS';
      platform = 'Mac';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
      platform = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
      platform = 'Mobile';
    } else if (
      userAgent.includes('iOS') ||
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad')
    ) {
      os = 'iOS';
      platform = 'iOS';
    }

    return { type, os, platform };
  }

  private async checkCameraAccess(): Promise<boolean> {
    try {
      return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    } catch {
      return false;
    }
  }

  private async checkMicrophoneAccess(): Promise<boolean> {
    try {
      return 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    } catch {
      return false;
    }
  }

  private getConnectivityTypes(): string[] {
    const types: string[] = [];

    if (typeof navigator !== 'undefined') {
      const connection = (navigator as any).connection;
      if (connection) {
        if (connection.type) types.push(connection.type);
        if (connection.effectiveType) types.push(connection.effectiveType);
      }
    }

    return types;
  }

  private assessCompatibility(capabilities: AuthCapabilities): CapabilityReport['compatibility'] {
    let score = 0;
    const supportedMethods: string[] = [];
    const unsupportedMethods: string[] = [];

    // WebAuthn assessment (40 points)
    if (capabilities.webauthn.supported) {
      score += 20;
      supportedMethods.push('webauthn');
      if (capabilities.webauthn.platformAuthenticator) score += 10;
      if (capabilities.webauthn.conditionalMediation) score += 10;
    } else {
      unsupportedMethods.push('webauthn');
    }

    // OAuth assessment (20 points)
    if (capabilities.oauth.supported) {
      score += 10;
      supportedMethods.push('oauth');
      if (capabilities.oauth.pkceSupported) score += 5;
      if (capabilities.oauth.popupSupported) score += 5;
    } else {
      unsupportedMethods.push('oauth');
    }

    // Security assessment (25 points)
    if (capabilities.security.secureContext) score += 10;
    if (capabilities.security.webCrypto) score += 10;
    if (capabilities.security.secureStorage) score += 5;

    // Browser compatibility (15 points)
    if (capabilities.browser.localStorage) score += 5;
    if (capabilities.browser.sessionStorage) score += 5;
    if (capabilities.browser.serviceWorker) score += 5;

    let level: CapabilityReport['compatibility']['level'];
    if (score >= 80) level = 'excellent';
    else if (score >= 60) level = 'good';
    else if (score >= 40) level = 'basic';
    else level = 'poor';

    return { score, level, supportedMethods, unsupportedMethods };
  }

  private generateRecommendations(capabilities: AuthCapabilities): string[] {
    const recommendations: string[] = [];

    if (!capabilities.security.secureContext) {
      recommendations.push(
        'Use HTTPS to enable secure context and advanced authentication features'
      );
    }

    if (!capabilities.webauthn.supported) {
      recommendations.push('WebAuthn is not supported. Consider fallback authentication methods');
    } else if (!capabilities.webauthn.platformAuthenticator) {
      recommendations.push(
        'Platform authenticator not available. Consider cross-platform authenticators'
      );
    }

    if (!capabilities.oauth.pkceSupported) {
      recommendations.push(
        'PKCE not supported. Use secure OAuth implementation with state parameter'
      );
    }

    if (!capabilities.browser.serviceWorker) {
      recommendations.push('Service Worker not supported. Offline authentication not available');
    }

    if (capabilities.device.mobile && !capabilities.biometric.platformBiometrics) {
      recommendations.push(
        'Consider implementing PIN or pattern authentication for mobile devices'
      );
    }

    return recommendations;
  }

  private generateWarnings(capabilities: AuthCapabilities): string[] {
    const warnings: string[] = [];

    if (!capabilities.security.secureContext) {
      warnings.push('Insecure context detected. Some authentication features may not work');
    }

    if (!capabilities.oauth.thirdPartyCookies) {
      warnings.push('Third-party cookies blocked. OAuth flows may be affected');
    }

    if (capabilities.network.saveData) {
      warnings.push('Data saver mode detected. Optimize for reduced bandwidth');
    }

    if (capabilities.device.type === 'mobile' && !capabilities.device.touchScreen) {
      warnings.push('Mobile device without touch screen detected. Unusual configuration');
    }

    return warnings;
  }

  private detectEnvironment(): 'development' | 'production' | 'testing' {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'development') return 'development';
      if (process.env.NODE_ENV === 'test') return 'testing';
      if (process.env.NODE_ENV === 'production') return 'production';
    }

    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'development';
      }
    }

    return 'production';
  }

  private getSettledValue<T>(result: PromiseSettledResult<T>, defaultValue: T): T {
    return result.status === 'fulfilled' ? result.value : defaultValue;
  }

  private getCached(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCached(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}

/**
 * Create capability detector instance
 */
export function createAuthCapabilityDetector(): AuthCapabilityDetector {
  return new AuthCapabilityDetector();
}

export default AuthCapabilityDetector;
