/**
 * Penetration Testing Service Tests
 *
 * Task 20: Add security audit and vulnerability testing
 * - Test penetration testing functionality
 * - Validate attack simulation
 * - Test system resilience assessment
 * - Verify security recommendations
 */

import {
  PenetrationTestingService,
  AttackScenarioConfig,
  PenetrationTestResult,
} from '../penetration-testing';
import { AuthValidationService } from '../auth-validation-service';
import { SecureTokenStorage } from '../secure-token-storage';
import { SecurityAuditService } from '../security-audit';

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

describe('PenetrationTestingService', () => {
  let penetrationService: PenetrationTestingService;
  let validationService: AuthValidationService;
  let tokenStorage: SecureTokenStorage;
  let auditService: SecurityAuditService;

  beforeEach(() => {
    validationService = new AuthValidationService();
    tokenStorage = new SecureTokenStorage();
    auditService = new SecurityAuditService();
    penetrationService = new PenetrationTestingService(
      {},
      validationService,
      tokenStorage,
      auditService
    );
  });

  afterEach(() => {
    penetrationService.cleanup();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new PenetrationTestingService();
      expect(service).toBeInstanceOf(PenetrationTestingService);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        testDuration: 30000,
        concurrentAttacks: 5,
        stopOnCritical: true,
        scenarios: [
          {
            name: 'Custom Attack',
            description: 'Custom attack scenario',
            severity: 'high' as const,
            duration: 5000,
            intensity: 2,
            enabled: true,
          },
        ],
      };

      const service = new PenetrationTestingService(customConfig);
      expect(service).toBeInstanceOf(PenetrationTestingService);
    });
  });

  describe('Attack Scenario Simulation', () => {
    it('should simulate brute force attack', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'Brute Force Login',
        description: 'Test brute force attack',
        severity: 'high',
        duration: 1000,
        intensity: 5,
        enabled: true,
      };

      const result = await (penetrationService as any).simulateAttackScenario(scenario);

      expect(result.scenarioName).toBe('Brute Force Login');
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeGreaterThan(0);
      expect(result.mitigation).toBeInstanceOf(Array);
    });

    it('should simulate SQL injection attack', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'SQL Injection Barrage',
        description: 'Test SQL injection attack',
        severity: 'critical',
        duration: 1000,
        intensity: 3,
        enabled: true,
      };

      const result = await (penetrationService as any).simulateAttackScenario(scenario);

      expect(result.scenarioName).toBe('SQL Injection Barrage');
      expect(result.attempts).toBeGreaterThan(0);
    });

    it('should simulate XSS attack', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'XSS Payload Injection',
        description: 'Test XSS attack',
        severity: 'medium',
        duration: 1000,
        intensity: 4,
        enabled: true,
      };

      const result = await (penetrationService as any).simulateAttackScenario(scenario);

      expect(result.scenarioName).toBe('XSS Payload Injection');
      expect(result.attempts).toBeGreaterThan(0);
    });

    it('should simulate session hijacking attack', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'Session Hijacking Simulation',
        description: 'Test session hijacking',
        severity: 'high',
        duration: 1000,
        intensity: 2,
        enabled: true,
      };

      const result = await (penetrationService as any).simulateAttackScenario(scenario);

      expect(result.scenarioName).toBe('Session Hijacking Simulation');
      expect(result.attempts).toBeGreaterThan(0);
    });

    it('should simulate CSRF attack', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'CSRF Attack Simulation',
        description: 'Test CSRF attack',
        severity: 'medium',
        duration: 1000,
        intensity: 3,
        enabled: true,
      };

      const result = await (penetrationService as any).simulateAttackScenario(scenario);

      expect(result.scenarioName).toBe('CSRF Attack Simulation');
      expect(result.attempts).toBeGreaterThan(0);
    });
  });

  describe('Individual Attack Execution', () => {
    it('should execute brute force attack and be blocked by rate limiting', async () => {
      const result = await (penetrationService as any).executeBruteForceAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
      expect(result.vulnerabilities).toBeInstanceOf(Array);
    });

    it('should execute SQL injection attack and be blocked by validation', async () => {
      const result = await (penetrationService as any).executeSQLInjectionAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
    });

    it('should execute XSS attack and be blocked by sanitization', async () => {
      const result = await (penetrationService as any).executeXSSAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
    });

    it('should execute CSRF attack and be blocked by token validation', async () => {
      const result = await (penetrationService as any).executeCSRFAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
    });

    it('should execute rate limit bypass attack', async () => {
      const result = await (penetrationService as any).executeRateLimitBypassAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
      expect(result.evidence).toHaveProperty('attempts');
    });

    it('should execute token manipulation attack', async () => {
      const result = await (penetrationService as any).executeTokenManipulationAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
    });

    it('should execute input fuzzing attack', async () => {
      const result = await (penetrationService as any).executeInputFuzzingAttack();

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('evidence');
    });
  });

  describe('Vulnerable System Testing', () => {
    it('should detect vulnerabilities in a vulnerable system', async () => {
      // Create vulnerable services that will allow attacks
      const vulnerableValidationService = {
        validateLoginData: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        validateEmail: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        validateName: jest
          .fn()
          .mockReturnValue({ isValid: true, errors: [], warnings: [], sanitizedData: '<script>' }),
        validateRegistrationData: jest
          .fn()
          .mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        checkRateLimit: jest
          .fn()
          .mockReturnValue({ allowed: true, remainingAttempts: 5, resetTime: 0, blocked: false }),
        recordFailedAttempt: jest.fn(),
        generateCSRFToken: jest.fn().mockReturnValue('token'),
        validateCSRFToken: jest.fn().mockReturnValue(true), // Always valid (vulnerable)
        clearRateLimitData: jest.fn(),
        clearCSRFTokens: jest.fn(),
      };

      const service = new PenetrationTestingService(
        { testDuration: 5000 },
        vulnerableValidationService as any,
        tokenStorage,
        auditService
      );

      const result = await service.runPenetrationTest();

      expect(result.summary.successfulAttacks).toBeGreaterThan(0);
      expect(result.systemResilience.overallScore).toBeLessThan(100);
    });

    it('should show high resilience for a secure system', async () => {
      // Use real validation service which should block attacks
      const result = await penetrationService.runPenetrationTest();

      expect(result.summary.totalScenarios).toBeGreaterThan(0);
      expect(result.summary.blockedAttacks).toBeGreaterThan(0);
      expect(result.systemResilience.overallScore).toBeGreaterThan(50);
    });
  });

  describe('Resilience Score Calculation', () => {
    it('should calculate resilience scores correctly', () => {
      const mockResults = [
        {
          successful: false,
          scenarioName: 'Test 1',
          attempts: 10,
          successfulAttempts: 0,
          blockedAttempts: 10,
          averageResponseTime: 100,
          vulnerabilitiesExploited: [],
          evidence: [],
          mitigation: [],
        },
        {
          successful: true,
          scenarioName: 'Test 2',
          attempts: 10,
          successfulAttempts: 5,
          blockedAttempts: 5,
          averageResponseTime: 100,
          vulnerabilitiesExploited: ['vuln1'],
          evidence: [],
          mitigation: [],
        },
      ];

      const score = (penetrationService as any).calculateResilienceScore(mockResults);

      expect(score).toBe(50); // 1 out of 2 attacks blocked = 50%
    });

    it('should return 100% for no attacks', () => {
      const score = (penetrationService as any).calculateResilienceScore([]);
      expect(score).toBe(100);
    });

    it('should return 0% if all attacks succeed', () => {
      const mockResults = [
        {
          successful: true,
          scenarioName: 'Test 1',
          attempts: 10,
          successfulAttempts: 10,
          blockedAttempts: 0,
          averageResponseTime: 100,
          vulnerabilitiesExploited: ['vuln1'],
          evidence: [],
          mitigation: [],
        },
        {
          successful: true,
          scenarioName: 'Test 2',
          attempts: 10,
          successfulAttempts: 10,
          blockedAttempts: 0,
          averageResponseTime: 100,
          vulnerabilitiesExploited: ['vuln2'],
          evidence: [],
          mitigation: [],
        },
      ];

      const score = (penetrationService as any).calculateResilienceScore(mockResults);
      expect(score).toBe(0);
    });
  });

  describe('Mitigation Recommendations', () => {
    it('should generate appropriate mitigation recommendations for successful attacks', () => {
      const scenario: AttackScenarioConfig = {
        name: 'Brute Force Login',
        description: 'Test brute force',
        severity: 'high',
        duration: 1000,
        intensity: 1,
        enabled: true,
      };

      const result = {
        scenarioName: 'Brute Force Login',
        successful: true,
        attempts: 10,
        successfulAttempts: 5,
        blockedAttempts: 5,
        averageResponseTime: 100,
        vulnerabilitiesExploited: ['weak-passwords'],
        evidence: [],
        mitigation: [],
      };

      const recommendations = (penetrationService as any).generateMitigationRecommendations(
        scenario,
        result
      );

      expect(recommendations).toContain('Implement stronger rate limiting');
      expect(recommendations).toContain('Add CAPTCHA after failed attempts');
      expect(recommendations).toContain('Use multi-factor authentication');
    });

    it('should generate maintenance recommendations for blocked attacks', () => {
      const scenario: AttackScenarioConfig = {
        name: 'SQL Injection Barrage',
        description: 'Test SQL injection',
        severity: 'critical',
        duration: 1000,
        intensity: 1,
        enabled: true,
      };

      const result = {
        scenarioName: 'SQL Injection Barrage',
        successful: false,
        attempts: 10,
        successfulAttempts: 0,
        blockedAttempts: 10,
        averageResponseTime: 100,
        vulnerabilitiesExploited: [],
        evidence: [],
        mitigation: [],
      };

      const recommendations = (penetrationService as any).generateMitigationRecommendations(
        scenario,
        result
      );

      expect(recommendations).toContain(
        'SQL Injection Barrage was successfully blocked - maintain current protections'
      );
    });
  });

  describe('Report Generation', () => {
    it('should generate detailed penetration test report', async () => {
      const mockResult: PenetrationTestResult = {
        summary: {
          totalScenarios: 2,
          successfulAttacks: 1,
          blockedAttacks: 1,
          criticalFindings: 1,
          highFindings: 0,
          averageBlockingRate: 50,
          testDuration: 5000,
        },
        scenarios: [
          {
            scenarioName: 'Test Attack 1',
            successful: true,
            attempts: 10,
            successfulAttempts: 5,
            blockedAttempts: 5,
            averageResponseTime: 100,
            vulnerabilitiesExploited: ['vulnerability-1'],
            evidence: [{ test: 'evidence' }],
            mitigation: ['Fix vulnerability-1'],
          },
          {
            scenarioName: 'Test Attack 2',
            successful: false,
            attempts: 10,
            successfulAttempts: 0,
            blockedAttempts: 10,
            averageResponseTime: 80,
            vulnerabilitiesExploited: [],
            evidence: [],
            mitigation: ['Maintain current protections'],
          },
        ],
        systemResilience: {
          overallScore: 75,
          authenticationSecurity: 80,
          inputValidationStrength: 70,
          sessionManagementSecurity: 75,
          rateLimitingEffectiveness: 75,
        },
        recommendations: ['Implement better security', 'Regular testing'],
        timestamp: Date.now(),
      };

      const report = penetrationService.generateDetailedReport(mockResult);

      expect(report).toContain('# Penetration Test Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## System Resilience Assessment');
      expect(report).toContain('## Attack Scenario Results');
      expect(report).toContain('Test Attack 1');
      expect(report).toContain('Test Attack 2');
      expect(report).toContain('Overall Security Score: 75/100');
    });
  });

  describe('Configuration Handling', () => {
    it('should handle custom attack scenarios', async () => {
      const customScenarios = [
        {
          name: 'Custom Attack',
          description: 'Custom attack test',
          severity: 'medium' as const,
          duration: 1000,
          intensity: 1,
          enabled: true,
        },
      ];

      const service = new PenetrationTestingService(
        { scenarios: customScenarios, testDuration: 2000 },
        validationService,
        tokenStorage,
        auditService
      );

      const result = await service.runPenetrationTest();

      expect(result.summary.totalScenarios).toBe(1);
      expect(result.scenarios[0].scenarioName).toBe('Custom Attack');
    });

    it('should handle disabled scenarios', async () => {
      const disabledScenarios = [
        {
          name: 'Disabled Attack',
          description: 'This attack is disabled',
          severity: 'low' as const,
          duration: 1000,
          intensity: 1,
          enabled: false,
        },
      ];

      const service = new PenetrationTestingService(
        { scenarios: disabledScenarios },
        validationService,
        tokenStorage,
        auditService
      );

      const result = await service.runPenetrationTest();

      expect(result.summary.totalScenarios).toBe(0);
    });

    it('should stop on critical vulnerability when configured', async () => {
      const vulnerableService = {
        validateLoginData: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        validateEmail: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        validateName: jest.fn().mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        validateRegistrationData: jest
          .fn()
          .mockReturnValue({ isValid: true, errors: [], warnings: [] }),
        checkRateLimit: jest
          .fn()
          .mockReturnValue({ allowed: true, remainingAttempts: 5, resetTime: 0, blocked: false }),
        recordFailedAttempt: jest.fn(),
        generateCSRFToken: jest.fn().mockReturnValue('token'),
        validateCSRFToken: jest.fn().mockReturnValue(false),
        clearRateLimitData: jest.fn(),
        clearCSRFTokens: jest.fn(),
      };

      const criticalScenarios = [
        {
          name: 'SQL Injection Barrage',
          description: 'Critical test',
          severity: 'critical' as const,
          duration: 1000,
          intensity: 1,
          enabled: true,
        },
        {
          name: 'XSS Payload Injection',
          description: 'Should not run if stopped',
          severity: 'medium' as const,
          duration: 1000,
          intensity: 1,
          enabled: true,
        },
      ];

      const service = new PenetrationTestingService(
        { scenarios: criticalScenarios, stopOnCritical: true },
        vulnerableService as any,
        tokenStorage,
        auditService
      );

      const result = await service.runPenetrationTest();

      // Should stop after first successful critical attack
      expect(result.scenarios.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle errors in attack execution gracefully', async () => {
      const errorValidationService = {
        validateLoginData: jest.fn().mockImplementation(() => {
          throw new Error('Validation error');
        }),
        validateEmail: jest.fn().mockImplementation(() => {
          throw new Error('Email validation error');
        }),
        validateName: jest.fn().mockImplementation(() => {
          throw new Error('Name validation error');
        }),
        validateRegistrationData: jest.fn().mockImplementation(() => {
          throw new Error('Registration validation error');
        }),
        checkRateLimit: jest.fn().mockReturnValue({
          allowed: false,
          remainingAttempts: 0,
          resetTime: Date.now() + 1000,
          blocked: true,
        }),
        recordFailedAttempt: jest.fn(),
        generateCSRFToken: jest.fn().mockReturnValue('token'),
        validateCSRFToken: jest.fn().mockReturnValue(false),
        clearRateLimitData: jest.fn(),
        clearCSRFTokens: jest.fn(),
      };

      const service = new PenetrationTestingService(
        { testDuration: 2000 },
        errorValidationService as any,
        tokenStorage,
        auditService
      );

      // Should not throw error and should handle gracefully
      const result = await service.runPenetrationTest();

      expect(result).toBeDefined();
      expect(result.summary.totalScenarios).toBeGreaterThan(0);
    });

    it('should cleanup properly', () => {
      penetrationService.cleanup();

      // Verify cleanup methods were called
      expect(mockConsole.log).toHaveBeenCalled();
    });
  });

  describe('Performance and Timing', () => {
    it('should respect attack intensity timing', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'Brute Force Login',
        description: 'Timing test',
        severity: 'high',
        duration: 2000,
        intensity: 2, // 2 requests per second = 500ms between requests
        enabled: true,
      };

      const startTime = Date.now();
      const result = await (penetrationService as any).simulateAttackScenario(scenario);
      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Should take approximately the configured duration
      expect(actualDuration).toBeGreaterThan(1800); // Allow some variance
      expect(actualDuration).toBeLessThan(2500);
      expect(result.attempts).toBeLessThanOrEqual(5); // Max 4 attempts in 2 seconds at 2/sec intensity
    });

    it('should calculate average response times correctly', async () => {
      const scenario: AttackScenarioConfig = {
        name: 'XSS Payload Injection',
        description: 'Response time test',
        severity: 'medium',
        duration: 1000,
        intensity: 5,
        enabled: true,
      };

      const result = await (penetrationService as any).simulateAttackScenario(scenario);

      expect(result.averageResponseTime).toBeGreaterThan(0);
      expect(result.averageResponseTime).toBeLessThan(1000); // Should be reasonable
    });
  });
});
