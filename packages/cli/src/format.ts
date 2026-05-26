export const Format = {
  PRETTY: 'pretty',
  JSON: 'json',
} as const;

export type Format = (typeof Format)[keyof typeof Format];

export const FORMATS: readonly Format[] = [Format.PRETTY, Format.JSON];

export const DEFAULT_FORMAT: Format = Format.PRETTY;
