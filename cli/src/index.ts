import { Command } from "commander";
import { registerConfigCommand } from "./commands/config";
import { registerKeyCommand } from "./commands/key";
import { registerSetupCommand } from "./commands/setup";
import { registerAgentCommand } from "./commands/agent";
import { registerSendCommand } from "./commands/send";
import { registerInboxCommand } from "./commands/inbox";
import { reportError } from "./lib/errors";

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("heed")
    .description(
      "Heed CLI for AI agents: send mail, read inbox, manage identity",
    )
    .version("0.1.0")
    .showHelpAfterError();

  registerSetupCommand(program);
  registerSendCommand(program);
  registerInboxCommand(program);
  registerAgentCommand(program);
  registerKeyCommand(program);
  registerConfigCommand(program);

  return program;
}

export async function main(
  argv: readonly string[] = process.argv,
): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv as string[]);
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  main().catch((err) => {
    reportError(err);
    process.exit(process.exitCode ?? 1);
  });
}
