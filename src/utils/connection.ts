/**
 * Every connection in this CLI reads at an explicit commitment.
 *
 * `new Connection(url)` leaves the commitment unset, and web3.js then omits the field from the
 * JSON-RPC call, so the node applies its own default of `finalized` - about 31 slots (~13s) behind
 * `confirmed`, the same on devnet and mainnet.
 *
 * That default caused two failures. `--execute` acknowledges at `confirmed`, so a read straight
 * afterwards returned the pre-write value and looked like a write that never landed. And a step
 * using an account the previous step had just created ran against a bank that could not see it yet.
 *
 * `confirmed` is the default here because it is what `--execute` waits for, so a read after a write
 * agrees with it. Two callers ask for `finalized` instead and say why at the call site.
 */

import { Connection } from '@solana/web3.js';
import { DEFAULT_TRANSACTION_CONFIG } from './constants.js';

/** A connection reading the same bank `--execute` confirms against. */
export function createConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, { commitment: DEFAULT_TRANSACTION_CONFIG.COMMITMENT });
}
