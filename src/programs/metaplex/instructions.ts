import type { TransactionInstruction } from '@solana/web3.js';
import type { Umi } from '@metaplex-foundation/umi';
import { publicKey as umiPk, some } from '@metaplex-foundation/umi';
import { updateV1 } from '@metaplex-foundation/mpl-token-metadata';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters';

export class InstructionBuilder {
  private umi: Umi;

  constructor(umi: Umi) {
    this.umi = umi;
  }

  updateAuthority(mint: string, newAuthority: string): TransactionInstruction {
    const builder = updateV1(this.umi, {
      mint: umiPk(mint),
      newUpdateAuthority: some(umiPk(newAuthority)),
    });
    const umiIxs = builder.getInstructions();
    const [first] = umiIxs;
    if (!first) {
      throw new Error('Failed to build Metaplex update authority instruction');
    }
    return toWeb3JsInstruction(first);
  }
}
