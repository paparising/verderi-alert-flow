/**
 * Retry and Circuit Breaker Configuration
 *
 * This file contains all configurable settings for the retry and circuit breaker patterns
 * used throughout the application. You can adjust these values based on your deployment
 * environment and requirements.
 */

export const RETRY_CONFIG = {
  /**
   * Global retry configuration for all API endpoints
   */
  global: {
    maxRetries: 3,
    initialDelay: 100, // milliseconds
    maxDelay: 5000, // milliseconds
    timeout: 30000, // milliseconds
  },

  /**
   * Specialized retry configuration for alert operations
   * Alerts typically require more resilience due to their critical nature
   */
  alerts: {
    maxRetries: 5,
    initialDelay: 50, // milliseconds
    maxDelay: 3000, // milliseconds
    timeout: 30000, // milliseconds
  },

  /**
   * Configuration for organization operations
   */
  organizations: {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 5000,
    timeout: 30000,
  },

  /**
   * Configuration for user operations
   */
  users: {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 5000,
    timeout: 30000,
  },
};

export const CIRCUIT_BREAKER_CONFIG = {
  /**
   * Default circuit breaker configuration
   */
  default: {
    // Number of failures before opening the circuit
    failureThreshold: 5,
    // Number of successes in half-open state before closing
    successThreshold: 2,
    // Time in milliseconds before attempting recovery from open state
    timeout: 60000, // 60 seconds
  },

  /**
   * Stricter configuration for critical services (Database, Kafka)
   */
  critical: {
    failureThreshold: 3,
    successThreshold: 3,
    timeout: 30000, // 30 seconds - faster recovery attempts
  },

  /**
   * Lenient configuration for non-critical services
   */
  lenient: {
    failureThreshold: 10,
    successThreshold: 2,
    timeout: 120000, // 2 minutes
  },
};

/**
 * Retryable error conditions
 * These are the conditions under which a request will be automatically retried
 */
export const RETRYABLE_ERRORS = {
  // HTTP status codes that should trigger retry
  httpStatuses: [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ],

  // Error message patterns that should trigger retry
  errorPatterns: [
    'ECONNREFUSED', // Connection refused
    'ECONNRESET', // Connection reset
    'ETIMEDOUT', // Connection timeout
    'EHOSTUNREACH', // Host unreachable
    'timeout', // Generic timeout
  ],

  // Error names that should trigger retry
  errorNames: [
    'TimeoutError',
    'ConnectionError',
    'NetworkError',
  ],
};

/**
 * Non-retryable errors
 * These error conditions will not be retried and will fail immediately
 */
export const NON_RETRYABLE_ERRORS = {
  // HTTP status codes that should NOT be retried
  httpStatuses: [
    400, // Bad Request
    401, // Unauthorized
    403, // Forbidden
    404, // Not Found
    405, // Method Not Allowed
    406, // Not Acceptable
    409, // Conflict
    410, // Gone
    411, // Length Required
    412, // Precondition Failed
    413, // Payload Too Large
    414, // URI Too Long
    415, // Unsupported Media Type
    422, // Unprocessable Entity
  ],
};

/**
 * Commands for monitoring and debugging
 *
 * Add these endpoints to your controller if you want to expose circuit breaker metrics:
 *
 * @Get('_internal/health/circuit-breaker')
 * getCircuitBreakerStatus() {
 *   return this.circuitBreakerService.getMetrics('key');
 * }
 *
 * @Get('_internal/health/circuit-breaker/all')
 * getAllCircuitBreakerStatus() {
 *   // You would need to extend CircuitBreakerService to expose all metrics
 * }
 */
