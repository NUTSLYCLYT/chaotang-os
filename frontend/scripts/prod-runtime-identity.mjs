/**
 * A production listener is valid only when its process cwd is this checkout.
 * Health alone cannot distinguish the intended build from a stale worktree.
 */
export function classifyProductionListenerOwnership(listener) {
  return listener && listener.sameRepo === false ? ['foreign_prod_3050'] : [];
}
