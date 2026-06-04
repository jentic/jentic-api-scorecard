import { expect } from 'chai';

import { buildDockerArgs, IMAGE_NAME } from '../src/docker.ts';
import { cliVersion } from '../src/version.ts';

const IMAGE_REF = `${IMAGE_NAME}:${cliVersion}`;

function baseOptions(): Parameters<typeof buildDockerArgs>[0] {
  return {
    args: ['score'],
    forwardJenticKey: false,
    forwardEnvVars: [],
    forwardEnvOverrides: new Map(),
    needsHostNetwork: false,
  };
}

function containsAdjacent(args: string[], pair: [string, string]): boolean {
  for (let i = 0; i < args.length - 1; i += 1) {
    if (args[i] === pair[0] && args[i + 1] === pair[1]) return true;
  }
  return false;
}

describe('buildDockerArgs', function () {
  it('builds the minimal invocation', function () {
    expect(buildDockerArgs(baseOptions(), 'linux')).to.deep.equal([
      'run',
      '--rm',
      IMAGE_REF,
      'score',
    ]);
  });

  it('adds -i when a stdin payload is set', function () {
    const args = buildDockerArgs({ ...baseOptions(), stdinPayload: '{}' }, 'linux');
    expect(args.slice(0, 3)).to.deep.equal(['run', '--rm', '-i']);
  });

  it('passes JENTIC_API_KEY through by name only when forwardJenticKey is true', function () {
    const args = buildDockerArgs({ ...baseOptions(), forwardJenticKey: true }, 'linux');
    expect(containsAdjacent(args, ['-e', 'JENTIC_API_KEY'])).to.equal(true);
    expect(args.some((a) => a.startsWith('JENTIC_API_KEY='))).to.equal(false);
  });

  it('forwards env names without overrides as -e NAME (passthrough)', function () {
    const args = buildDockerArgs({ ...baseOptions(), forwardEnvVars: ['OPENAI_API_KEY'] }, 'linux');
    expect(containsAdjacent(args, ['-e', 'OPENAI_API_KEY'])).to.equal(true);
    expect(args.some((a) => a.startsWith('OPENAI_API_KEY='))).to.equal(false);
  });

  it('forwards env names with overrides as -e NAME=VALUE (explicit value)', function () {
    const args = buildDockerArgs(
      {
        ...baseOptions(),
        forwardEnvVars: ['OPENAI_API_URL'],
        forwardEnvOverrides: new Map([['OPENAI_API_URL', 'http://host.docker.internal:11434']]),
      },
      'linux',
    );
    expect(
      containsAdjacent(args, ['-e', 'OPENAI_API_URL=http://host.docker.internal:11434']),
    ).to.equal(true);
    expect(args).not.to.include('OPENAI_API_URL');
  });

  it('preserves forwardEnvVars order in the emitted -e flags', function () {
    const args = buildDockerArgs({ ...baseOptions(), forwardEnvVars: ['A', 'B', 'C'] }, 'linux');
    const names = args.filter((a) => a === 'A' || a === 'B' || a === 'C');
    expect(names).to.deep.equal(['A', 'B', 'C']);
  });

  it('adds --network host on Linux when needsHostNetwork is true', function () {
    const args = buildDockerArgs({ ...baseOptions(), needsHostNetwork: true }, 'linux');
    expect(containsAdjacent(args, ['--network', 'host'])).to.equal(true);
    expect(args.some((a) => a.startsWith('--add-host='))).to.equal(false);
  });

  it('adds --add-host=host.docker.internal on darwin when needsHostNetwork is true', function () {
    const args = buildDockerArgs({ ...baseOptions(), needsHostNetwork: true }, 'darwin');
    expect(args).to.include('--add-host=host.docker.internal:host-gateway');
    expect(args).not.to.include('--network');
  });

  it('places the image ref before the container args', function () {
    const args = buildDockerArgs(
      { ...baseOptions(), args: ['score', '--url', 'https://example.test/spec.yaml'] },
      'linux',
    );
    const imageIdx = args.indexOf(IMAGE_REF);
    const scoreIdx = args.indexOf('score');
    expect(imageIdx).to.be.greaterThan(-1);
    expect(scoreIdx).to.be.greaterThan(imageIdx);
    expect(args.slice(imageIdx + 1)).to.deep.equal([
      'score',
      '--url',
      'https://example.test/spec.yaml',
    ]);
  });
});
