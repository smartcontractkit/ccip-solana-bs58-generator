import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { deserializePoolConfig } from '../src/programs/shared/pool-config.js';

const ROUTER = new PublicKey('11111111111111111111111111111111');
const RMN = new PublicKey('BPympxtoS3GZmNcGiTxqsH6kyRgKiS9QFjfviSLaqxRE');

function buildConfig(
  opts: { version?: number; selfServed?: boolean; router?: PublicKey; rmn?: PublicKey } = {}
): Buffer {
  const buf = Buffer.alloc(8 + 1 + 1 + 32 + 32, 0);
  let o = 8; // skip 8-byte discriminator
  buf.writeUInt8(opts.version ?? 1, o);
  o += 1;
  buf.writeUInt8(opts.selfServed ? 1 : 0, o);
  o += 1;
  (opts.router ?? ROUTER).toBuffer().copy(buf, o);
  o += 32;
  (opts.rmn ?? RMN).toBuffer().copy(buf, o);
  o += 32;
  return buf;
}

describe('deserializePoolConfig', () => {
  it('decodes version, selfServedAllowed, router, rmnRemote', () => {
    const out = deserializePoolConfig(
      buildConfig({ version: 2, selfServed: true, router: ROUTER, rmn: RMN })
    );
    expect(out.version).toBe(2);
    expect(out.selfServedAllowed).toBe(true);
    expect(out.router.equals(ROUTER)).toBe(true);
    expect(out.rmnRemote.equals(RMN)).toBe(true);
  });

  it('reads selfServedAllowed=false when the byte is 0', () => {
    const out = deserializePoolConfig(buildConfig({ selfServed: false }));
    expect(out.selfServedAllowed).toBe(false);
  });

  it('throws on undersized buffer', () => {
    const short = Buffer.alloc(73, 0);
    expect(() => deserializePoolConfig(short)).toThrow(/expected at least 74/);
  });

  it('ignores the 8-byte discriminator (reads from offset 8)', () => {
    const buf = buildConfig({ version: 5 });
    // Put garbage in the discriminator region; decoding must be unaffected.
    buf.write('nonzero!', 0, 'utf8');
    const out = deserializePoolConfig(buf);
    expect(out.version).toBe(5);
  });
});
