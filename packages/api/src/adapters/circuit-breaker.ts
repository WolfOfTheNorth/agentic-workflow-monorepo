/**
 * Circuit Breaker Pattern Implementation for Supabase Authentication
 *
 * This module implements the circuit breaker pattern to provide resilience
 * against repeated failures and graceful degradation when Supabase services
 * are experiencing issues.
 */

import { EnhancedApiError, AuthErrorTypes, ErrorSeverity, getErrorMapper } from './error-handler';

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Circuit is open, calls fail fast
  HALF_OPEN = 'half_open', // Testing if service has recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeout: number; // Time to wait before trying recovery (ms)
  successThreshold: number; // Successes needed to close from half-open
  monitoringWindow: number; // Time window for failure counting (ms)
  fallbackEnabled: boolean; // Whether to enable fallback mechanisms
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  uptime: number;
}

/**
 * Fallback operation interface
 */
export interface FallbackOperation<T> {
  execute: () => Promise<T>;
  description: string;
  priority: number; // Lower number = higher priority
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private readonly startTime = Date.now();

  private readonly config: CircuitBreakerConfig;
  private readonly fallbackOperations = new Map<string, FallbackOperation<any>[]>();

  constructor(
    private readonly serviceName: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      successThreshold: 3,
      monitoringWindow: 300000, // 5 minutes
      fallbackEnabled: true,
      ...config,
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackOptions?: {
      enableFallback?: boolean;
      fallbackOperations?: FallbackOperation<T>[];
    }
  ): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.isOpen()) {
      if (this.shouldAttemptRecovery()) {
        this.transitionToHalfOpen();
      } else {
        // Circuit is open, try fallback if available
        if (this.config.fallbackEnabled && fallbackOptions?.enableFallback !== false) {
          return this.executeFallback(operationName, fallbackOptions?.fallbackOperations);
        }

        throw this.createCircuitOpenError(operationName);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      // If circuit is now open and fallback is enabled, try fallback
      if (
        this.isOpen() &&
        this.config.fallbackEnabled &&
        fallbackOptions?.enableFallback !== false
      ) {
        try {
          return await this.executeFallback(operationName, fallbackOptions?.fallbackOperations);
        } catch {
          // If fallback also fails, throw original error
          throw error;
        }
      }

      throw error;
    }
  }

  /**
   * Register fallback operations for a specific operation
   */
  registerFallback<T>(operationName: string, fallback: FallbackOperation<T>): void {
    if (!this.fallbackOperations.has(operationName)) {
      this.fallbackOperations.set(operationName, []);
    }

    const fallbacks = this.fallbackOperations.get(operationName)!;
    fallbacks.push(fallback);

    // Sort by priority (lower number = higher priority)
    fallbacks.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Force circuit breaker state (useful for testing)
   */
  forceState(state: CircuitBreakerState): void {
    this.state = state;
    console.warn(`[CircuitBreaker:${this.serviceName}] State forced to ${state}`);
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    console.info(`[CircuitBreaker:${this.serviceName}] Circuit breaker reset`);
  }

  /**
   * Check if circuit is open
   */
  private isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  /**
   * Check if circuit is half-open
   */
  private isHalfOpen(): boolean {
    return this.state === CircuitBreakerState.HALF_OPEN;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();

    if (this.isHalfOpen()) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.totalFailures++;
    this.lastFailureTime = Date.now();

    // Clear old failures outside monitoring window
    this.cleanOldFailures();

    if (this.state === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    } else if (this.isHalfOpen()) {
      // Any failure in half-open state immediately opens the circuit
      this.transitionToOpen();
    }

    console.warn(`[CircuitBreaker:${this.serviceName}] Failure recorded`, {
      error: error instanceof Error ? error.message : String(error),
      failureCount: this.failureCount,
      state: this.state,
    });
  }

  /**
   * Check if we should attempt recovery from open state
   */
  private shouldAttemptRecovery(): boolean {
    const timeSinceLastFailure = Date.now() - this.lastFailureTime;
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;

    console.info(`[CircuitBreaker:${this.serviceName}] Circuit closed - service recovered`);
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.successCount = 0;

    console.error(`[CircuitBreaker:${this.serviceName}] Circuit opened - service failing`, {
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
    });
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successCount = 0;
    this.failureCount = 0;

    console.info(`[CircuitBreaker:${this.serviceName}] Circuit half-open - testing recovery`);
  }

  /**
   * Clean failures outside monitoring window
   */
  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    if (this.lastFailureTime < cutoff && this.state === CircuitBreakerState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Execute fallback operations
   */
  private async executeFallback<T>(
    operationName: string,
    providedFallbacks?: FallbackOperation<T>[]
  ): Promise<T> {
    const fallbacks = providedFallbacks || this.fallbackOperations.get(operationName) || [];

    if (fallbacks.length === 0) {
      throw this.createNoFallbackError(operationName);
    }

    console.warn(`[CircuitBreaker:${this.serviceName}] Executing fallback for ${operationName}`, {
      availableFallbacks: fallbacks.length,
    });

    for (const fallback of fallbacks) {
      try {
        console.debug(
          `[CircuitBreaker:${this.serviceName}] Trying fallback: ${fallback.description}`
        );
        const result = await fallback.execute();

        console.info(
          `[CircuitBreaker:${this.serviceName}] Fallback successful: ${fallback.description}`
        );
        return result;
      } catch (error) {
        console.warn(
          `[CircuitBreaker:${this.serviceName}] Fallback failed: ${fallback.description}`,
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
        continue;
      }
    }

    throw this.createAllFallbacksFailedError(operationName, fallbacks.length);
  }

  /**
   * Create circuit open error
   */
  private createCircuitOpenError(operationName: string): EnhancedApiError {
    return getErrorMapper().mapGenericError(
      new Error(`Service ${this.serviceName} is currently unavailable (circuit breaker open)`),
      `circuitBreaker:${operationName}`
    );
  }

  /**
   * Create no fallback error
   */
  private createNoFallbackError(operationName: string): EnhancedApiError {
    return {
      message: `Service ${this.serviceName} is unavailable and no fallback is configured for ${operationName}`,
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      errorType: AuthErrorTypes.SUPABASE_SERVICE_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      userAction: 'Please try again in a few minutes. If the problem persists, contact support.',
      details: {
        serviceName: this.serviceName,
        operationName,
        circuitState: this.state,
        context: 'circuitBreaker:noFallback',
      },
      technicalDetails: {
        serviceName: this.serviceName,
        operationName,
        circuitState: this.state,
      },
    };
  }

  /**
   * Create all fallbacks failed error
   */
  private createAllFallbacksFailedError(
    operationName: string,
    fallbackCount: number
  ): EnhancedApiError {
    return {
      message: `Service ${this.serviceName} is unavailable and all ${fallbackCount} fallback options have failed`,
      status: 503,
      code: 'ALL_FALLBACKS_FAILED',
      errorType: AuthErrorTypes.SUPABASE_SERVICE_ERROR,
      severity: ErrorSeverity.CRITICAL,
      retryable: true,
      userAction: 'Please try again later. If the problem persists, contact support.',
      details: {
        serviceName: this.serviceName,
        operationName,
        fallbackCount,
        circuitState: this.state,
        context: 'circuitBreaker:allFallbacksFailed',
      },
      technicalDetails: {
        serviceName: this.serviceName,
        operationName,
        fallbackCount,
        circuitState: this.state,
      },
    };
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [serviceName, breaker] of this.breakers) {
      stats[serviceName] = breaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get health status of all services
   */
  getHealthStatus(): { healthy: string[]; degraded: string[]; failed: string[] } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const failed: string[] = [];

    for (const [serviceName, breaker] of this.breakers) {
      const stats = breaker.getStats();

      switch (stats.state) {
        case CircuitBreakerState.CLOSED:
          healthy.push(serviceName);
          break;
        case CircuitBreakerState.HALF_OPEN:
          degraded.push(serviceName);
          break;
        case CircuitBreakerState.OPEN:
          failed.push(serviceName);
          break;
      }
    }

    return { healthy, degraded, failed };
  }
}

// Default circuit breaker manager instance
let defaultManager: CircuitBreakerManager | null = null;

/**
 * Get default circuit breaker manager
 */
export function getCircuitBreakerManager(): CircuitBreakerManager {
  if (!defaultManager) {
    defaultManager = new CircuitBreakerManager();
  }
  return defaultManager;
}

/**
 * Get circuit breaker for Supabase service
 */
export function getSupabaseCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return getCircuitBreakerManager().getBreaker('supabase', config);
}

/**
 * Reset circuit breaker manager (useful for testing)
 */
export function resetCircuitBreakerManager(): void {
  defaultManager = null;
}
