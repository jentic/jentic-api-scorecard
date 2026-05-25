import { platform } from 'node:os';

const CLOUD_PROVIDER_KEYS: string[] = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_BEARER_TOKEN_BEDROCK',
];

const AWS_SUPPORTING_VARS: string[] = ['AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION'];

export const CLOUD_CREDENTIAL_ENV_VARS: string[] = [...CLOUD_PROVIDER_KEYS, ...AWS_SUPPORTING_VARS];

export const LLM_ROUTING_ENV_VARS: string[] = [
  'LLM_PROVIDER',
  'LIGHT_LLM_PROVIDER',
  'LLM_MODEL',
  'LLM_LIGHT_MODEL',
  'LLM_MAX_TOKENS',
  'OPENAI_API_URL',
  'ANTHROPIC_API_URL',
  'GEMINI_API_URL',
];

export interface LlmEnvDetection {
  forwardEnvVars: string[];
  forwardEnvOverrides: Map<string, string>;
  needsHostNetwork: boolean;
  hasUsableProvider: boolean;
}

function isPresent(env: NodeJS.ProcessEnv, name: string): boolean {
  const val = env[name];
  return val !== undefined && val !== '';
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function needsDockerHostRewrite(value: string): boolean {
  try {
    const url = new URL(value);
    return isLoopbackHostname(url.hostname) || url.hostname === 'host.docker.internal';
  } catch {
    return false;
  }
}

function rewriteUrlForContainer(value: string): string {
  try {
    const url = new URL(value);
    if (platform() === 'linux') {
      if (url.hostname === 'host.docker.internal') {
        url.hostname = 'localhost';
      }
    } else {
      if (isLoopbackHostname(url.hostname)) {
        url.hostname = 'host.docker.internal';
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function hasAwsCredentials(env: NodeJS.ProcessEnv): boolean {
  const hasKeyPair = isPresent(env, 'AWS_ACCESS_KEY_ID') && isPresent(env, 'AWS_SECRET_ACCESS_KEY');
  const hasBearer = isPresent(env, 'AWS_BEARER_TOKEN_BEDROCK');
  return hasKeyPair || hasBearer;
}

const API_URL_SUFFIX = '_API_URL';

export function detectLlmEnv(env: NodeJS.ProcessEnv): LlmEnvDetection {
  const forwardEnvVars: string[] = [];
  const forwardEnvOverrides = new Map<string, string>();
  let needsHostNetwork = false;

  for (const name of CLOUD_CREDENTIAL_ENV_VARS) {
    if (isPresent(env, name)) {
      forwardEnvVars.push(name);
    }
  }

  for (const name of LLM_ROUTING_ENV_VARS) {
    if (isPresent(env, name)) {
      forwardEnvVars.push(name);
      if (name.endsWith(API_URL_SUFFIX)) {
        const val = env[name]!;
        if (needsDockerHostRewrite(val)) {
          needsHostNetwork = true;
          const rewritten = rewriteUrlForContainer(val);
          if (rewritten !== val) {
            forwardEnvOverrides.set(name, rewritten);
          }
        }
      }
    }
  }

  const hasNonAwsKey = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'].some((name) =>
    isPresent(env, name),
  );
  const hasCloudCredential = hasNonAwsKey || hasAwsCredentials(env);
  const hasLocalEndpoint =
    env['LLM_PROVIDER'] === 'OPENAI' &&
    isPresent(env, 'OPENAI_API_URL') &&
    isPresent(env, 'OPENAI_API_KEY');

  const hasUsableProvider = hasCloudCredential || hasLocalEndpoint;

  return { forwardEnvVars, forwardEnvOverrides, needsHostNetwork, hasUsableProvider };
}
