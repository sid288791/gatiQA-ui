import type { Evaluator, ProfileEvaluator, ProfileVersionInput } from '../../api';

export interface ValidationIssue {
  field: string;
  message: string;
}

export const WEIGHT_TOTAL = 100;
const EPSILON = 0.001;

export function totalWeight(evaluators: ProfileEvaluator[]): number {
  return evaluators.reduce((s, e) => s + (Number.isFinite(e.weight) ? e.weight : 0), 0);
}

/**
 * Validate a profile version draft. Returns a list of issues; empty means valid.
 * Rules:
 *  - at least one evaluator selected
 *  - weights are non-negative and sum to exactly 100
 *  - every required config field of each selected evaluator is filled
 *  - thresholds are within [0, 1] and inconclusive < pass when both set
 */
export function validateProfileVersion(
  input: ProfileVersionInput,
  registry: Evaluator[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (input.evaluators.length === 0) {
    issues.push({ field: 'evaluators', message: 'Select at least one evaluator.' });
  }

  const total = totalWeight(input.evaluators);
  if (input.evaluators.length > 0 && Math.abs(total - WEIGHT_TOTAL) > EPSILON) {
    issues.push({
      field: 'weights',
      message: `Total weight must equal ${WEIGHT_TOTAL} (currently ${round2(total)}).`,
    });
  }

  input.evaluators.forEach((pe, i) => {
    if (!Number.isFinite(pe.weight) || pe.weight < 0 || pe.weight > 100) {
      issues.push({ field: `evaluators.${i}.weight`, message: 'Weight must be between 0 and 100.' });
    }
    const ev = registry.find((e) => e.id === pe.evaluatorId);
    if (!ev) {
      issues.push({ field: `evaluators.${i}.evaluatorId`, message: 'Unknown evaluator.' });
      return;
    }
    for (const f of ev.configSchema) {
      const v = pe.config?.[f.key];
      if (f.required && (v === undefined || v === null || v === '')) {
        issues.push({
          field: `evaluators.${i}.config.${f.key}`,
          message: `${ev.name}: "${f.label}" is required.`,
        });
      }
    }
  });

  if (!Number.isFinite(input.passThreshold) || input.passThreshold < 0 || input.passThreshold > 1) {
    issues.push({ field: 'passThreshold', message: 'Pass threshold must be between 0 and 1.' });
  }
  if (
    input.inconclusiveThreshold !== undefined &&
    (input.inconclusiveThreshold < 0 ||
      input.inconclusiveThreshold > 1 ||
      input.inconclusiveThreshold >= input.passThreshold)
  ) {
    issues.push({
      field: 'inconclusiveThreshold',
      message: 'Inconclusive threshold must be in [0, 1] and below the pass threshold.',
    });
  }

  return issues;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
