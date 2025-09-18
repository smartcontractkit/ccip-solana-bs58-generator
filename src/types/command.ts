/**
 * Standard Commander.js command context type used across all commands
 */
export interface CommandContext {
  parent?: {
    parent?: { opts(): { rpcUrl?: string; verbose?: boolean; resolvedRpcUrl?: string } };
    opts(): { rpcUrl?: string; verbose?: boolean; resolvedRpcUrl?: string };
  };
}

/**
 * Standard options for initialize pool commands
 */
export interface InitializePoolOptions {
  programId: string;
  mint: string;
  authority: string;
}

/**
 * Standard options for accept ownership commands
 */
export interface AcceptOwnershipOptions {
  programId: string;
  mint: string;
  authority: string;
}

/**
 * Standard options for transfer ownership commands
 */
export interface TransferOwnershipOptions {
  programId: string;
  mint: string;
  authority: string;
  proposedOwner: string;
}

/**
 * Standard options for configure allow list commands
 */
export interface ConfigureAllowListOptions {
  programId: string;
  mint: string;
  authority: string;
  add: string;
  enabled: string;
}

/**
 * Standard options for remove from allow list commands
 */
export interface RemoveFromAllowListOptions {
  programId: string;
  mint: string;
  authority: string;
  remove: string;
}

/**
 * Standard options for init chain remote config commands
 */
export interface InitChainRemoteConfigOptions {
  programId: string;
  mint: string;
  authority: string;
  remoteChainSelector: string;
  poolAddresses: string;
  tokenAddress: string;
  decimals: string;
}

/**
 * Standard options for edit chain remote config commands
 */
export interface EditChainRemoteConfigOptions {
  programId: string;
  mint: string;
  authority: string;
  remoteChainSelector: string;
  poolAddresses: string;
  tokenAddress: string;
  decimals: string;
}

/**
 * Standard options for delete chain config commands
 */
export interface DeleteChainConfigOptions {
  programId: string;
  mint: string;
  authority: string;
  remoteChainSelector: string;
}

/**
 * Standard options for set chain rate limit commands
 */
export interface SetChainRateLimitOptions {
  programId: string;
  mint: string;
  authority: string;
  remoteChainSelector: string;
  inboundEnabled: string;
  inboundCapacity: string;
  inboundRate: string;
  outboundEnabled: string;
  outboundCapacity: string;
  outboundRate: string;
}

/**
 * Standard options for provide liquidity commands
 */
export interface ProvideLiquidityOptions {
  programId: string;
  mint: string;
  authority: string;
  amount: string;
}

/**
 * Standard options for withdraw liquidity commands
 */
export interface WithdrawLiquidityOptions {
  programId: string;
  mint: string;
  authority: string;
  amount: string;
}

/**
 * Standard options for set rebalancer commands
 */
export interface SetRebalancerOptions {
  programId: string;
  mint: string;
  authority: string;
  rebalancer: string;
}

/**
 * Standard options for set can accept liquidity commands
 */
export interface SetCanAcceptLiquidityOptions {
  programId: string;
  mint: string;
  authority: string;
  allow: string;
}

/**
 * Standard options for SPL Token approve commands
 */
export interface ApproveOptions {
  mint: string;
  tokenAccount?: string;
  delegate: string;
  authority: string;
  amount: string;
}

/**
 * Standard options for append remote pool addresses commands
 */
export interface AppendRemotePoolAddressesOptions {
  programId: string;
  mint: string;
  authority: string;
  remoteChainSelector: string;
  addresses: string;
}
