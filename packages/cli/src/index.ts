import { Command, Option } from 'commander';

import { runScore } from './commands/score.ts';
import { DEFAULT_DETAIL, DETAIL_LEVELS, DetailLevel } from './detail.ts';
import { cliVersion } from './version.ts';

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
    .addOption(
      new Option('-d, --detail <level>', 'Payload depth')
        .choices([...DETAIL_LEVELS])
        .default(DEFAULT_DETAIL),
    )
    .action(async (input: string, opts: { withLlm?: boolean; detail: DetailLevel }) => {
      const exitCode = await runScore(input, { withLlm: opts.withLlm, detail: opts.detail });
      process.exitCode = exitCode;
    });

  await program.parseAsync(argv);
}
