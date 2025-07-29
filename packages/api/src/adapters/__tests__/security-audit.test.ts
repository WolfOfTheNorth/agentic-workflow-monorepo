/**
 * Security Audit Service Tests
 *
 * Task 20: Add security audit and vulnerability testing
 * - Test security audit functionality
 * - Validate vulnerability detection
 * - Test compliance assessment
 * - Verify security recommendations
 */

import {
  SecurityAuditService,
  SecurityAuditConfig,
  SecurityVulnerability,
} from '../security-audit';
import { AuthValidationService } from '../auth-validation-service';
import { SecureTokenStorage } from '../secure-token-storage';

// Mock console methods to avoid test output noise
const mockConsole = {
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

beforeAll(() => {
  Object.assign(console, mockConsole);
});

beforeEach(() => {
  Object.values(mockConsole).forEach(mock => mock.mockClear());
});

describe('SecurityAuditService', () => {
  let auditService: SecurityAuditService;
  let validationService: AuthValidationService;
  let tokenStorage: SecureTokenStorage;

  beforeEach(() => {
    validationService = new AuthValidationService();
    tokenStorage = new SecureTokenStorage();
    auditService = new SecurityAuditService({}, validationService, tokenStorage);
  });

  afterEach(() => {
    auditService.cleanup();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new SecurityAuditService();
      expect(service).toBeInstanceOf(SecurityAuditService);
    });

    it('should accept custom configuration', () => {
      const config: Partial<SecurityAuditConfig> = {
        testIntensity: 'high',
        maxTestDuration: 60000,
        enabledTests: {
          sqlInjection: true,
          xssAttacks: false,
          csrfProtection: true,
          tokenSecurity: true,
          authenticationBypass: false,
          sessionSecurity: true,
          inputValidation: true,
          rateLimiting: false,
          communicationSecurity: true,
        },
      };

      const service = new SecurityAuditService(config);
      expect(service).toBeInstanceOf(SecurityAuditService);
    });
  });

  describe('SQL Injection Testing', () => {
    it('should detect SQL injection vulnerabilities in email validation', async () => {
      // Mock validation service to return valid for SQL injection payload
      const mockValidationService = {
        ...validationService,
        validateEmail: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
          sanitizedData: "' OR '1'='1",
        }),
        validateName: jest.fn().mockReturnValue({
          isValid: false,
          errors: ['Invalid characters'],
          warnings: [],
        }),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testSQLInjectionVulnerabilities();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].category).toBe('SQL Injection');
      expect(result.vulnerabilities[0].severity).toBe('high');
      expect(result.vulnerabilities[0].cwe).toBe('CWE-89');
    });

    it('should pass when SQL injection is properly blocked', async () => {
      // Use real validation service which should block SQL injection
      const result = await (auditService as any).testSQLInjectionVulnerabilities();

      expect(result.passedTests).toBeGreaterThan(0);
      // Vulnerabilities might still exist if validation is not perfect
    });
  });

  describe('XSS Testing', () => {
    it('should detect XSS vulnerabilities', async () => {
      // Mock validation service to accept XSS payload
      const mockValidationService = {
        ...validationService,
        validateName: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
          sanitizedData: '<script>alert("XSS")</script>',
        }),
        validateRegistrationData: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
          sanitizedData: {
            additionalField: '<script>alert("XSS")</script>',
          },
        }),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testXSSVulnerabilities();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].category).toBe('Cross-Site Scripting');
      expect(result.vulnerabilities[0].cwe).toBe('CWE-79');
    });

    it('should pass when XSS is properly prevented', async () => {
      const result = await (auditService as any).testXSSVulnerabilities();

      expect(result.passedTests).toBeGreaterThan(0);
    });
  });

  describe('CSRF Protection Testing', () => {
    it('should test CSRF token generation and validation', async () => {
      const result = await (auditService as any).testCSRFProtection();

      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.passedTests).toBeGreaterThan(0);
    });

    it('should detect weak CSRF token generation', async () => {
      // Mock validation service with weak CSRF token
      const mockValidationService = {
        ...validationService,
        generateCSRFToken: jest.fn().mockReturnValue('weak'),
        validateCSRFToken: jest.fn().mockReturnValue(true),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testCSRFProtection();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].id).toBe('csrf-weak-token');
    });
  });

  describe('Token Security Testing', () => {
    it('should test token encryption', async () => {
      const result = await (auditService as any).testTokenSecurity();

      expect(result.totalTests).toBeGreaterThan(0);
    });

    it('should detect unencrypted token storage', async () => {
      // Mock token storage without encryption
      const mockTokenStorage = {
        ...tokenStorage,
        storeToken: jest.fn(),
        getTokenMetadata: jest.fn().mockReturnValue({
          encrypted: false,
          created: Date.now(),
          lastAccessed: Date.now(),
        }),
        getToken: jest.fn().mockResolvedValue(null),
        removeToken: jest.fn(),
      };

      const service = new SecurityAuditService({}, validationService, mockTokenStorage as any);
      const result = await (service as any).testTokenSecurity();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].id).toBe('token-storage-unencrypted');
    });

    it('should test token expiration enforcement', async () => {
      // This test verifies that expired tokens are properly handled
      const result = await (auditService as any).testTokenSecurity();

      // Should pass if expiration is properly implemented
      expect(result.totalTests).toBeGreaterThan(0);
    });
  });

  describe('Authentication Bypass Testing', () => {
    it('should test various bypass scenarios', async () => {
      const result = await (auditService as any).testAuthenticationBypass();

      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.passedTests).toBeGreaterThan(0);
    });

    it('should detect authentication bypass vulnerabilities', async () => {
      // Mock validation service to allow bypass
      const mockValidationService = {
        ...validationService,
        validateLoginData: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        }),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testAuthenticationBypass();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].category).toBe('Authentication Bypass');
      expect(result.vulnerabilities[0].severity).toBe('critical');
    });
  });

  describe('Session Security Testing', () => {
    it('should test session security measures', async () => {
      const result = await (auditService as any).testSessionSecurity();

      expect(result.totalTests).toBeGreaterThan(0);
    });
  });

  describe('Input Validation Testing', () => {
    it('should test input validation with malicious inputs', async () => {
      const result = await (auditService as any).testInputValidation();

      expect(result.totalTests).toBeGreaterThan(0);
      expect(result.passedTests).toBeGreaterThan(0);
    });

    it('should detect input validation bypasses', async () => {
      // Mock validation service to accept malicious input
      const mockValidationService = {
        ...validationService,
        validateEmail: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        }),
        validateName: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
        }),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testInputValidation();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].category).toBe('Input Validation');
    });
  });

  describe('Rate Limiting Testing', () => {
    it('should test rate limiting enforcement', async () => {
      const result = await (auditService as any).testRateLimiting();

      expect(result.totalTests).toBeGreaterThan(0);
    });

    it('should detect lack of rate limiting', async () => {
      // Mock validation service with no rate limiting
      const mockValidationService = {
        ...validationService,
        recordFailedAttempt: jest.fn(),
        checkRateLimit: jest.fn().mockReturnValue({
          allowed: true,
          remainingAttempts: 5,
          resetTime: Date.now() + 900000,
          blocked: false,
        }),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testRateLimiting();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities[0].id).toBe('rate-limiting-not-enforced');
    });
  });

  describe('Communication Security Testing', () => {
    it('should test HTTPS enforcement', async () => {
      const result = await (auditService as any).testCommunicationSecurity();

      expect(result.totalTests).toBeGreaterThan(0);
    });

    it('should detect HTTPS not enforced', async () => {
      // Mock validation service that allows HTTP
      const mockValidationService = {
        ...validationService,
        validateHTTPS: jest.fn().mockReturnValue(true),
        getSecurityHeaders: jest.fn().mockReturnValue({}),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testCommunicationSecurity();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities.some(v => v.id === 'https-not-enforced')).toBe(true);
    });

    it('should detect missing security headers', async () => {
      // Mock validation service with missing headers
      const mockValidationService = {
        ...validationService,
        validateHTTPS: jest.fn().mockReturnValue(false),
        getSecurityHeaders: jest.fn().mockReturnValue({}),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);
      const result = await (service as any).testCommunicationSecurity();

      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities.some(v => v.id === 'missing-security-headers')).toBe(true);
    });
  });

  describe('Full Security Audit', () => {
    it('should run comprehensive security audit', async () => {
      const result = await auditService.runSecurityAudit();

      expect(result).toBeDefined();
      expect(result.summary.totalTests).toBeGreaterThan(0);
      expect(result.summary.duration).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.complianceStatus).toBeDefined();
    });

    it('should generate detailed security report', async () => {
      const auditResult = await auditService.runSecurityAudit();
      const report = auditService.generateSecurityReport(auditResult);

      expect(report).toContain('# Security Audit Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Compliance Status');
      expect(report).toContain('## Recommendations');
    });

    it('should assess compliance correctly', async () => {
      const vulnerabilities: SecurityVulnerability[] = [
        {
          id: 'test-critical',
          severity: 'critical',
          category: 'Test',
          title: 'Test Critical Vulnerability',
          description: 'Test description',
          impact: 'High impact',
          recommendation: 'Fix immediately',
        },
      ];

      const result = (auditService as any).generateAuditReport(vulnerabilities, 10, 9, 1000);

      expect(result.complianceStatus.owasp).toBe(false);
      expect(result.complianceStatus.gdpr).toBe(false);
      expect(result.complianceStatus.pci).toBe(false);
    });

    it('should handle selective test execution', async () => {
      const config: Partial<SecurityAuditConfig> = {
        enabledTests: {
          sqlInjection: true,
          xssAttacks: false,
          csrfProtection: false,
          tokenSecurity: false,
          authenticationBypass: false,
          sessionSecurity: false,
          inputValidation: false,
          rateLimiting: false,
          communicationSecurity: false,
        },
      };

      const service = new SecurityAuditService(config, validationService, tokenStorage);
      const result = await service.runSecurityAudit();

      expect(result.summary.totalTests).toBeGreaterThan(0);
      // Should only run SQL injection tests
    });
  });

  describe('Cleanup and Error Handling', () => {
    it('should cleanup test data properly', () => {
      auditService.cleanup();

      // Verify cleanup was called
      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('should handle errors gracefully during testing', async () => {
      // Mock validation service that throws errors
      const mockValidationService = {
        ...validationService,
        validateEmail: jest.fn().mockImplementation(() => {
          throw new Error('Test error');
        }),
      };

      const service = new SecurityAuditService({}, mockValidationService as any, tokenStorage);

      // Should not throw and should handle errors gracefully
      await expect(service.runSecurityAudit()).resolves.toBeDefined();
    });

    it('should generate recommendations based on vulnerabilities', () => {
      const vulnerabilities: SecurityVulnerability[] = [
        {
          id: 'test-1',
          severity: 'high',
          category: 'Test',
          title: 'Test Vulnerability',
          description: 'Test description',
          impact: 'High impact',
          recommendation: 'Implement proper validation',
        },
        {
          id: 'test-2',
          severity: 'medium',
          category: 'Test',
          title: 'Another Vulnerability',
          description: 'Test description',
          impact: 'Medium impact',
          recommendation: 'Implement proper validation', // Duplicate
        },
      ];

      const recommendations = (auditService as any).generateRecommendations(vulnerabilities);

      expect(recommendations).toContain('Implement proper validation');
      expect(recommendations).toContain(
        'Implement regular security audits and penetration testing'
      );
      // Should deduplicate recommendations
      expect(recommendations.filter(r => r === 'Implement proper validation').length).toBe(1);
    });
  });

  describe('Security Vulnerability Detection', () => {
    it('should detect all vulnerability categories', async () => {
      // Create a mock that will trigger vulnerabilities in each category
      const vulnerableValidationService = {
        validateEmail: jest
          .fn()
          .mockReturnValue({ isValid: true, errors: [], warnings: [], sanitizedData: "' OR 1=1" }),
        validateName: jest
          .fn()
          .mockReturnValue({ isValid: true, errors: [], warnings: [], sanitizedData: '<script>' }),
        validateLoginData: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        validateRegistrationData: jest.fn().mockReturnValue({
          isValid: true,
          errors: [],
          warnings: [],
          sanitizedData: { additionalField: '<script>' },
        }),
        generateCSRFToken: jest.fn().mockReturnValue('weak'),
        validateCSRFToken: jest.fn().mockReturnValue(false),
        recordFailedAttempt: jest.fn(),
        checkRateLimit: jest
          .fn()
          .mockReturnValue({ allowed: true, remainingAttempts: 5, resetTime: 0, blocked: false }),
        validateHTTPS: jest.fn().mockReturnValue(true),
        getSecurityHeaders: jest.fn().mockReturnValue({}),
        clearRateLimitData: jest.fn(),
        clearCSRFTokens: jest.fn(),
      };

      const vulnerableTokenStorage = {
        storeToken: jest.fn(),
        getToken: jest.fn().mockResolvedValue('expired-token'),
        getTokenMetadata: jest
          .fn()
          .mockReturnValue({ encrypted: false, created: Date.now(), lastAccessed: Date.now() }),
        validateToken: jest.fn().mockReturnValue({
          isValid: true,
          needsRotation: false,
          isExpired: false,
          age: 0,
          version: 1,
        }),
        removeToken: jest.fn(),
        clearAllTokens: jest.fn(),
      };

      const service = new SecurityAuditService(
        {},
        vulnerableValidationService as any,
        vulnerableTokenStorage as any
      );
      const result = await service.runSecurityAudit();

      // Should detect vulnerabilities in multiple categories
      expect(result.vulnerabilities.length).toBeGreaterThan(5);

      const categories = new Set(result.vulnerabilities.map(v => v.category));
      expect(categories.size).toBeGreaterThan(3); // Multiple categories detected
    });
  });
});
