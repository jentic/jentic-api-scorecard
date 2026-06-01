export const ExitCode = {
  SUCCESS: 0,
  GENERIC_ERROR: 1,
  AUTH_INVALID_KEY: 2,
  GATE_REJECTED: 3,
  DOCKER_MISSING: 4,
  SPEC_FAILURE: 5,
  ENGINE_FAILURE: 6,
  RATE_LIMITED: 7,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
