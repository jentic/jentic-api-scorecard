export const CLOUD_CREDENTIAL_ENV_VARS: string[] = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_REGION',
  'AWS_BEARER_TOKEN_BEDROCK',
];

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
  needsHostNetwork: boolean;
  hasUsableProvider: boolean;
}

function isPresent(env: NodeJS.ProcessEnv, name: string): boolean {
  const val = env[name];
  return val !== undefined && val !== '';
}

function isHostLoopbackUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '0.0.0.0' ||
      url.hostname === 'host.docker.internal'
    );
  } catch {
    return false;
  }
}

const API_URL_SUFFIX = '_API_URL';

export function detectLlmEnv(env: NodeJS.ProcessEnv): LlmEnvDetection {
  const forwardEnvVars: string[] = [];
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
        if (isHostLoopbackUrl(val)) {
          needsHostNetwork = true;
        }
      }
    }
  }

  const hasCloudCredential = CLOUD_CREDENTIAL_ENV_VARS.some((name) => isPresent(env, name));
  const hasLocalEndpoint = env['LLM_PROVIDER'] === 'OPENAI' && isPresent(env, 'OPENAI_API_URL');

  const hasUsableProvider = hasCloudCredential || hasLocalEndpoint;

  return { forwardEnvVars, needsHostNetwork, hasUsableProvider };
}
