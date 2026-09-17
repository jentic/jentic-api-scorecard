// CDN-safe color helpers for signal metadata panels. Ported from the upstream v2
// renderer's grade-config, translated to standard Tailwind utilities. dark: variants
// are paired with each light-mode class so panels adapt when a .dark ancestor is
// present (wired via @custom-variant dark in index.css).

export type MetricColor = 'green' | 'yellow' | 'red' | 'orange' | 'muted';
export type ExtendedColor = MetricColor | 'blue' | 'amber';

export function getMetricColorClasses(color: MetricColor): string {
  switch (color) {
    case 'green':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'yellow':
      return 'text-amber-600 dark:text-amber-400';
    case 'red':
      return 'text-rose-600 dark:text-rose-400';
    case 'orange':
      return 'text-orange-600 dark:text-orange-400';
    case 'muted':
    default:
      return 'text-[var(--sc-text-primary,#111827)]';
  }
}

export function getProgressBarColorClass(percentage: number): string {
  if (percentage >= 80) return 'bg-emerald-500';
  if (percentage >= 60) return 'bg-amber-500';
  if (percentage >= 40) return 'bg-orange-500';
  return 'bg-rose-500';
}

export function getPercentageTextColorClass(percentage: number): string {
  if (percentage >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

export function getPercentageStrokeColorClass(percentage: number): string {
  if (percentage >= 80) return 'text-emerald-500 dark:text-emerald-400';
  if (percentage >= 60) return 'text-yellow-500 dark:text-yellow-400';
  return 'text-red-500 dark:text-red-400';
}

// 0-1 scale: >=0.8 green, >=0.6 yellow, else red.
export function getNormalizedScoreTextColorClass(score: number, maxScore = 1): string {
  const n = score / maxScore;
  if (n >= 0.8) return 'text-green-600 dark:text-green-400';
  if (n >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

// 0-1 scale: >=0.8 green, >=0.5 yellow, else red. Returns a MetricColor.
export function getNormalizedScoreColor(score: number, maxScore = 1): MetricColor {
  const n = score / maxScore;
  if (n >= 0.8) return 'green';
  if (n >= 0.5) return 'yellow';
  return 'red';
}

export function getColorClassesByType(color: MetricColor): { text: string; bg: string } {
  switch (color) {
    case 'green':
      return { text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500' };
    case 'yellow':
      return { text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500' };
    case 'red':
      return { text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500' };
    case 'orange':
      return { text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500' };
    case 'muted':
    default:
      return { text: 'text-[var(--sc-text-muted,#9ca3af)]', bg: 'bg-[var(--sc-section,#f3f4f6)]' };
  }
}

export function getBadgeColorClasses(color: ExtendedColor): { bg: string; text: string } {
  switch (color) {
    case 'green':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
      };
    case 'yellow':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
      };
    case 'red':
      return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
    case 'orange':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
      };
    case 'blue':
      return { bg: 'bg-blue-100 dark:bg-sky-900/30', text: 'text-blue-700 dark:text-sky-300' };
    case 'amber':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
      };
    case 'muted':
    default:
      return { bg: 'bg-[var(--sc-section,#f3f4f6)]', text: 'text-[var(--sc-text-muted,#9ca3af)]' };
  }
}

// --- Tooling readiness scale ---

export const TOOLING_READINESS_THRESHOLDS = { best: 3, ok: 8, poor: 14 } as const;
export type ToolingReadinessLevel = 'best' | 'ok' | 'poor' | 'critical';

export function getToolingReadinessLevel(errors: number): ToolingReadinessLevel {
  if (errors <= TOOLING_READINESS_THRESHOLDS.best) return 'best';
  if (errors <= TOOLING_READINESS_THRESHOLDS.ok) return 'ok';
  if (errors <= TOOLING_READINESS_THRESHOLDS.poor) return 'poor';
  return 'critical';
}

export const TOOLING_READINESS_SCALE_COLORS: Record<ToolingReadinessLevel, string> = {
  best: 'bg-emerald-500',
  ok: 'bg-amber-400',
  poor: 'bg-orange-400',
  critical: 'bg-rose-500',
};

export function getToolingReadinessScaleLabelColors(level: ToolingReadinessLevel): string {
  return {
    best: 'text-emerald-600 dark:text-emerald-400',
    ok: 'text-amber-600 dark:text-amber-400',
    poor: 'text-orange-600 dark:text-orange-400',
    critical: 'text-rose-600 dark:text-rose-400',
  }[level];
}

export function getToolingReadinessColors(level: ToolingReadinessLevel): {
  bg: string;
  text: string;
  icon: string;
} {
  return {
    best: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    ok: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: 'text-amber-600 dark:text-amber-400',
    },
    poor: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-400',
      icon: 'text-orange-600 dark:text-orange-400',
    },
    critical: {
      bg: 'bg-rose-100 dark:bg-rose-900/30',
      text: 'text-rose-700 dark:text-rose-400',
      icon: 'text-rose-600 dark:text-rose-400',
    },
  }[level];
}

export function getToolingReadinessMarkerPosition(errors: number): number {
  const { best, ok, poor } = TOOLING_READINESS_THRESHOLDS;
  if (errors <= best) return (errors / best) * 20;
  if (errors <= ok) return 20 + ((errors - best) / (ok - best)) * 27;
  if (errors <= poor) return 47 + ((errors - ok) / (poor - ok)) * 33;
  return Math.min(80 + ((errors - poor) / 6) * 20, 100);
}

// --- Spec validity ---

export function getSpecValidityColors(passed: boolean): {
  bg: string;
  text: string;
  icon: string;
} {
  return passed
    ? {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: 'text-emerald-600 dark:text-emerald-400',
      }
    : {
        bg: 'bg-rose-100 dark:bg-rose-900/30',
        text: 'text-rose-700 dark:text-rose-400',
        icon: 'text-rose-600 dark:text-rose-400',
      };
}

export function getSpecValidityFailureBoxColors(): {
  border: string;
  bg: string;
  icon: string;
  text: string;
} {
  return {
    border: 'border-rose-200 dark:border-rose-800/40',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    icon: 'text-rose-500 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
  };
}

export type DiagnosticSeverityName = 'error' | 'warning' | 'information' | 'hint';

export function getDiagnosticSeverityColors(severity: DiagnosticSeverityName): {
  bg: string;
  text: string;
  icon: string;
} {
  return {
    error: {
      bg: 'bg-rose-100 dark:bg-rose-950/30',
      text: 'text-rose-700 dark:text-rose-400',
      icon: 'text-rose-500 dark:text-rose-400',
    },
    warning: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      icon: 'text-amber-500 dark:text-amber-400',
    },
    information: {
      bg: 'bg-sky-100 dark:bg-sky-900/30',
      text: 'text-sky-700 dark:text-sky-400',
      icon: 'text-sky-500 dark:text-sky-400',
    },
    hint: {
      bg: 'bg-slate-100 dark:bg-slate-900/30',
      text: 'text-slate-700 dark:text-slate-400',
      icon: 'text-slate-500 dark:text-slate-400',
    },
  }[severity];
}

// --- Auth strength ---

export interface AuthStrengthInfo {
  rationale: string;
  baseStrength: number;
}

export function getAuthStrengthInfo(
  type: string,
  details?: Record<string, unknown>,
): AuthStrengthInfo {
  const scheme = details?.['scheme'] as string | undefined;
  const flowsRaw = details?.['flows'];
  const inLocation = details?.['in'] as string | undefined;
  const bearerFormat = details?.['bearerFormat'] as string | undefined;

  if (type === 'http') {
    if (scheme === 'basic')
      return { rationale: 'Plaintext credentials; easily leaked', baseStrength: 0.1 };
    if (scheme === 'digest')
      return { rationale: 'Outdated; limited protection', baseStrength: 0.2 };
    if (scheme === 'bearer') {
      if (bearerFormat === 'JWT')
        return {
          rationale: 'Cryptographically verifiable claims; supports scopes',
          baseStrength: 0.75,
        };
      return { rationale: 'Security depends on token distribution', baseStrength: 0.6 };
    }
    if (scheme === 'hoba')
      return { rationale: 'Asymmetric client-bound authentication', baseStrength: 0.8 };
    if (scheme === 'mutual')
      return {
        rationale: 'Cryptographically binding client/server identities',
        baseStrength: 0.95,
      };
    if (scheme === 'negotiate')
      return { rationale: 'Legacy; violates HTTP semantics (Kerberos/NTLM)', baseStrength: 0.35 };
    if (scheme === 'oauth')
      return { rationale: 'Deprecated; insecure signature model (OAuth 1.0)', baseStrength: 0.2 };
    if (scheme === 'scram-sha-1')
      return { rationale: 'Uses deprecated SHA-1 hashing', baseStrength: 0.25 };
    if (scheme === 'scram-sha-256')
      return { rationale: 'Modern and stronger, still password-based', baseStrength: 0.65 };
    if (scheme === 'vapid')
      return {
        rationale: 'Token model similar to bearer; moderate trust (WebPush)',
        baseStrength: 0.6,
      };
    if (scheme === 'dpop')
      return { rationale: 'Prevents replay; binds token to client', baseStrength: 0.9 };
    if (scheme === 'gnap')
      return { rationale: 'Modern alternative to OAuth 2.0', baseStrength: 0.9 };
    if (scheme === 'privatetoken')
      return { rationale: 'Strong privacy-preserving cryptographic identity', baseStrength: 0.75 };
    if (scheme === 'concealed')
      return {
        rationale: 'Modern, high-assurance privacy-preserving authentication',
        baseStrength: 0.85,
      };
    return { rationale: 'HTTP authentication scheme', baseStrength: 0.5 };
  }

  if (type === 'apiKey') {
    if (inLocation === 'query')
      return { rationale: 'Very high leakage risk (logs, proxies, URLs)', baseStrength: 0.15 };
    if (inLocation === 'header' || inLocation === 'cookie')
      return {
        rationale: 'Moderate security; lacks identity, scoping, or rotation controls',
        baseStrength: 0.5,
      };
    return { rationale: 'API key authentication', baseStrength: 0.4 };
  }

  if (type === 'oauth2') {
    const flows: string[] = Array.isArray(flowsRaw)
      ? (flowsRaw as string[])
      : flowsRaw && typeof flowsRaw === 'object'
        ? Object.keys(flowsRaw)
        : typeof flowsRaw === 'string'
          ? [flowsRaw]
          : [];
    if (flows.includes('password'))
      return { rationale: 'Deprecated; violates least-privilege; insecure', baseStrength: 0.3 };
    if (flows.includes('implicit'))
      return { rationale: 'Deprecated; exposes tokens via redirects', baseStrength: 0.35 };
    if (flows.includes('clientCredentials'))
      return {
        rationale: 'Strong, scoped, recommended for machine-to-machine',
        baseStrength: 0.85,
      };
    if (flows.includes('authorizationCode'))
      return {
        rationale: 'Most secure OAuth2 flow; protects public clients (PKCE)',
        baseStrength: 0.9,
      };
    return { rationale: 'OAuth 2.0 authentication', baseStrength: 0.7 };
  }

  if (type === 'openIdConnect')
    return {
      rationale: 'Gold-standard identity-bound access (OIDC Discovery + JWKs)',
      baseStrength: 1.0,
    };
  if (type === 'mutualTLS')
    return { rationale: 'Hardware-backed identity; strongest available', baseStrength: 1.0 };
  if (!type || type === 'none')
    return { rationale: 'Unsafe for sensitive APIs; no authentication', baseStrength: 0.0 };

  return { rationale: 'Authentication scheme', baseStrength: 0.5 };
}
