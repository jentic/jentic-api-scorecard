import { Command, Option } from 'commander';

import { runScore } from './commands/score.ts';
import { DEFAULT_DETAIL, DETAIL_LEVELS, DetailLevel } from './detail.ts';
import { DEFAULT_FORMAT, FORMATS, Format } from './format.ts';
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
    .option(
      '--bundle',
      'Force CLI-side bundling: fetch and bundle the URL on the host, pipe to the container via stdin. Use for URLs only the host can reach. Requires JENTIC_API_KEY. No-op for local files.',
      false,
    )
    .addOption(
      new Option('-d, --detail <level>', 'Payload depth')
        .choices([...DETAIL_LEVELS])
        .default(DEFAULT_DETAIL),
    )
    .addOption(
      new Option('-f, --format <fmt>', 'Output encoding')
        .choices([...FORMATS])
        .default(DEFAULT_FORMAT),
    )
    .option('-o, --output <file>', 'Write the formatted report to <file> instead of stdout')
    .option('-q, --quiet', 'Suppress the stderr spinner regardless of TTY', false)
    .action(
      async (
        input: string,
        opts: {
          withLlm?: boolean;
          bundle?: boolean;
          detail: DetailLevel;
          format: Format;
          output?: string;
          quiet?: boolean;
        },
      ) => {
        const exitCode = await runScore(input, {
          withLlm: opts.withLlm,
          bundle: opts.bundle,
          detail: opts.detail,
          format: opts.format,
          output: opts.output,
          quiet: opts.quiet,
        });
        process.exitCode = exitCode;
      },
    );

  await program.parseAsync(argv);
}
