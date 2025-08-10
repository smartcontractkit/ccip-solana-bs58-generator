import { Command } from 'commander';
import { createBurnmintCommands } from './burnmint/index.js';
import { createRouterCommands } from './router/index.js';

/**
 * Register all program commands
 */
export function registerCommands(program: Command): void {
  // Add program-specific command groups
  program.addCommand(createBurnmintCommands());
  program.addCommand(createRouterCommands());
  // program.addCommand(createLockReleaseCommands());
  // program.addCommand(createSplTokenCommands());
}
