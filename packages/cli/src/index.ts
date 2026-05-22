import { Command } from 'commander';

import { runScore } from './commands/score.js';
import { cliVersion } from './version.js';

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = new Command();

  program
    .name('jentic-api-scorecard')
    .description('Score an OpenAPI document against the Jentic API AI Readiness Framework (JAIRF).')
    .version(cliVersion);

  program
    .command('score')
    .description('Score an OpenAPI document by URL or local file path.')
    .argument('<input>', 'https:// URL or local file path to an OpenAPI document')
    .option('--with-llm', 'Enable LLM-backed analysis in the engine', false)
    .action(async (input: string, opts: { withLlm?: boolean }) => {
      const exitCode = await runScore(input, { withLlm: opts.withLlm });
      process.exitCode = exitCode;
    });

  await program.parseAsync(argv);
}
