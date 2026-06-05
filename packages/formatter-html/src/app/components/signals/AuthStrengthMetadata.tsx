import type { Diagnostic, Provenance } from '../../types.ts';

import DiagnosticsList from '../DiagnosticsList.tsx';

import Icon, { type IconName } from './shared/Icon.tsx';
import {
  getAuthStrengthInfo,
  getBadgeColorClasses,
  getNormalizedScoreTextColorClass,
  type ExtendedColor,
} from './shared/colors.ts';

interface AuthSchemeDetails {
  flows?: string[] | Record<string, unknown> | string;
  in?: string;
  name?: string;
  scheme?: string;
  bearerFormat?: string;
  openIdConnectUrl?: string;
}

interface AuthScheme {
  type: string;
  score: number;
  details?: AuthSchemeDetails;
}

interface AuthStrengthMeta {
  schemes_count: number;
  schemes?: AuthScheme[];
  provenance?: Provenance;
}

interface AuthStrengthMetadataProps {
  metadata: AuthStrengthMeta;
  diagnostics?: Diagnostic[];
}

const SCHEME_CONFIG: Record<string, { icon: IconName; color: ExtendedColor }> = {
  oauth2: { icon: 'shield', color: 'green' },
  openIdConnect: { icon: 'shield', color: 'green' },
  apiKey: { icon: 'key', color: 'blue' },
  http: { icon: 'lock', color: 'amber' },
  none: { icon: 'unlock', color: 'red' },
};

function formatSchemeDetails(details: AuthSchemeDetails): string {
  const parts: string[] = [];
  const { flows, in: inLoc, name, scheme, bearerFormat, openIdConnectUrl } = details;
  if (flows) {
    const list = Array.isArray(flows)
      ? flows
      : typeof flows === 'object'
        ? Object.keys(flows)
        : [flows];
    if (list.length) parts.push(`Flows: ${list.join(', ')}`);
  }
  if (inLoc) parts.push(name ? `In: ${inLoc} (${name})` : `In: ${inLoc}`);
  if (scheme) parts.push(`Scheme: ${scheme}`);
  if (bearerFormat) parts.push(`Format: ${bearerFormat}`);
  if (openIdConnectUrl) parts.push('OpenID URL configured');
  return parts.join(' • ');
}

export default function AuthStrengthMetadata({ metadata, diagnostics }: AuthStrengthMetadataProps) {
  const { schemes_count, schemes, provenance } = metadata;
  const displayCount = schemes_count >= 0 ? schemes_count : (schemes?.length ?? 0);
  const noSchemeColors = getBadgeColorClasses('red');

  return (
    <div
      className="mt-3 pt-3 border-t border-gray-100 cursor-default space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
        <span className="text-gray-500">Security Schemes</span>
        <span className="font-mono font-medium">{displayCount}</span>
      </div>

      {schemes && schemes.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">
              Configured Schemes
            </span>
            <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wide">
              Strength Score
            </span>
          </div>
          <div className="space-y-1.5">
            {schemes.map((scheme, index) => {
              const config = SCHEME_CONFIG[scheme.type] ?? SCHEME_CONFIG['none']!;
              const colors = getBadgeColorClasses(config.color);
              const details = scheme.details ? formatSchemeDetails(scheme.details) : '';
              const rationale = getAuthStrengthInfo(
                scheme.type,
                scheme.details as Record<string, unknown> | undefined,
              ).rationale;
              const label = scheme.type.replace(/([A-Z])/g, ' $1').trim();
              return (
                <div key={index} className={`rounded-md px-2 py-1.5 ${colors.bg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name={config.icon} className={`h-4 w-4 ${colors.text}`} />
                      <span className="text-xs font-medium capitalize">{label}</span>
                    </div>
                    <span
                      className={`font-mono text-xs font-semibold ${getNormalizedScoreTextColorClass(scheme.score)}`}
                    >
                      {(scheme.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {details && <div className="text-gray-500 text-[10px] mt-1 ml-6">{details}</div>}
                  <div className="text-[10px] mt-1 ml-6 italic text-gray-500">{rationale}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={`${noSchemeColors.bg} flex items-center gap-2 rounded-md p-2`}>
          <Icon name="unlock" className={`h-4 w-4 ${noSchemeColors.text}`} />
          <span className={`text-xs ${noSchemeColors.text}`}>No security schemes configured</span>
        </div>
      )}

      {diagnostics && provenance && (
        <DiagnosticsList diagnostics={diagnostics} provenance={provenance} />
      )}
    </div>
  );
}
