import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { logger } from './logger.js';

export async function detectTokenProgramId(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint account not found: ${mint.toBase58()}`);
  const owner = info.owner;
  if (owner.equals(TOKEN_PROGRAM_ID)) {
    logger.info({ mint: mint.toBase58(), programId: owner.toBase58() }, 'Detected SPL Token v1');
    return owner;
  }
  if (owner.equals(TOKEN_2022_PROGRAM_ID)) {
    logger.info(
      { mint: mint.toBase58(), programId: owner.toBase58() },
      'Detected Token-2022 program'
    );
    return owner;
  }
  const message = `Unsupported token program for mint ${mint.toBase58()}: ${owner.toBase58()}`;
  logger.error(message);
  throw new Error(message);
}
