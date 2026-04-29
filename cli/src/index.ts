import { Command } from "commander";
import { registerConfigCommand } from "./commands/config";
import { registerKeyCommand } from "./commands/key";
import { registerSetupCommand } from "./commands/setup";
import { registerAgentCommand } from "./commands/agent";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("heed")
    .description("Heed CLI for AI agents: send mail, read inbox, manage identity")
    .version("0.1.0")
    .showHelpAfterError();

  registerSetupCommand(program);
  registerAgentCommand(program);
  registerKeyCommand(program);
  registerConfigCommand(program);

  return program;
}

export async function main(argv: readonly string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv as string[]);
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  main().catch((err) => {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  });
}
