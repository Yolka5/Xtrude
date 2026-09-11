/**
 * Shared Onshape call budget for one cron/backfill/discovery run.
 * Every makeClient in that run should take the same budget object so the
 * cap is process-wide, not per-user or per-document.
 */
export const DEFAULT_MAX_CALLS_PER_RUN = 100;
export const ENV_MAX_CALLS_PER_RUN = "ONSHAPE_MAX_CALLS_PER_RUN";

export function maxCallsPerRun(env = process.env) {
  const n = Number(env[ENV_MAX_CALLS_PER_RUN] ?? DEFAULT_MAX_CALLS_PER_RUN);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_CALLS_PER_RUN;
  return Math.floor(n);
}

export function isBudgetExceeded(err) {
  if (!err || typeof err !== "object") return false;
  return err.name === "OnshapeBudgetExceeded" || err.code === "ONSHAPE_BUDGET";
}

export function makeBudgetError({ maxCalls, callsUsed, stoppedAt, method, path }) {
  const err = new Error(
    `Hit the ${maxCalls}-call cap at ${stoppedAt} after ${callsUsed} call(s). ` +
      `Stopping ${method} ${path} rather than continuing over budget; remaining work waits for the next run.`
  );
  err.name = "OnshapeBudgetExceeded";
  err.code = "ONSHAPE_BUDGET";
  err.maxCalls = maxCalls;
  err.callsUsed = callsUsed;
  err.stoppedAt = stoppedAt;
  return err;
}

export function createCallBudget(maxCalls) {
  let calls = 0;
  let stoppedAt = null;

  return {
    maxCalls,
    callsUsed: () => calls,
    stoppedAt: () => stoppedAt,
    remaining: () => Math.max(0, maxCalls - calls),
    hit: () => stoppedAt != null || calls >= maxCalls,
    snapshot: () => ({
      hit: stoppedAt != null || calls >= maxCalls,
      maxCalls,
      callsUsed: calls,
      stoppedAt,
    }),
    take(method, path) {
      const where = `${method} ${path}`;
      if (calls >= maxCalls) {
        if (!stoppedAt) stoppedAt = where;
        throw makeBudgetError({ maxCalls, callsUsed: calls, stoppedAt, method, path });
      }
      calls += 1;
    },
  };
}

/**
 * Stubbed run used by verify-derive: N planned calls, stop at the cap, log.
 */
export function simulateCappedRun({ maxCalls, plannedCalls, path = "/v6/documents" }) {
  const budget = createCallBudget(maxCalls);
  let completed = 0;
  let log = null;
  for (let i = 0; i < plannedCalls; i++) {
    try {
      budget.take("GET", `${path}?i=${i}`);
      completed += 1;
    } catch (err) {
      log = {
        ...budget.snapshot(),
        message: err instanceof Error ? err.message : String(err),
        plannedCalls,
        completed,
        remaining: plannedCalls - completed,
      };
      break;
    }
  }
  return { completed, remaining: plannedCalls - completed, callsUsed: budget.callsUsed(), log };
}
