import { Command } from 'commander';
import { createBurnmintCommands } from './burnmint/index.js';

/**
 * Register all program commands
 */
export function registerCommands(program: Command): void {
  // Add program-specific command groups
  program.addCommand(createBurnmintCommands());
  // Note: Other commands will be added when IDLs are available
  // program.addCommand(createLockReleaseCommands());
  // program.addCommand(createRouterCommands());
  // program.addCommand(createSplTokenCommands());
}
