import { describe, expect, it } from 'vitest';
import type { Evaluator, ProfileVersionInput } from '../../api';
import { totalWeight, validateProfileVersion } from './validation';

const registry: Evaluator[] = [
  {
    id: 'ev-a',
    name: 'Evaluator A',
    version: '1.0.0',
    description: '',
    configSchema: [
      { key: 'req', label: 'Required field', type: 'string', required: true },
      { key: 'opt', label: 'Optional field', type: 'number', required: false },
    ],
  },
  {
    id: 'ev-b',
    name: 'Evaluator B',
    version: '1.0.0',
    description: '',
    configSchema: [],
  },
];

const base: ProfileVersionInput = {
  evaluators: [{ evaluatorId: 'ev-a', weight: 100, config: { req: 'x' } }],
  passThreshold: 0.8,
};

describe('validateProfileVersion', () => {
  it('accepts a valid input', () => {
    expect(validateProfileVersion(base, registry)).toEqual([]);
  });

  it('requires at least one evaluator', () => {
    const issues = validateProfileVersion({ ...base, evaluators: [] }, registry);
    expect(issues.some((i) => i.field === 'evaluators')).toBe(true);
  });

  it('rejects weight totals other than 100', () => {
    const issues = validateProfileVersion(
      {
        ...base,
        evaluators: [
          { evaluatorId: 'ev-a', weight: 60, config: { req: 'x' } },
          { evaluatorId: 'ev-b', weight: 30, config: {} },
        ],
      },
      registry,
    );
    expect(issues.find((i) => i.field === 'weights')?.message).toMatch(/must equal 100/);
  });

  it('flags missing required config per evaluator', () => {
    const issues = validateProfileVersion(
      { ...base, evaluators: [{ evaluatorId: 'ev-a', weight: 100, config: {} }] },
      registry,
    );
    expect(issues.some((i) => i.field === 'evaluators.0.config.req')).toBe(true);
  });

  it('flags out-of-range and inconsistent thresholds', () => {
    expect(
      validateProfileVersion({ ...base, passThreshold: 1.5 }, registry).some(
        (i) => i.field === 'passThreshold',
      ),
    ).toBe(true);
    expect(
      validateProfileVersion(
        { ...base, passThreshold: 0.5, inconclusiveThreshold: 0.7 },
        registry,
      ).some((i) => i.field === 'inconclusiveThreshold'),
    ).toBe(true);
  });
});

describe('totalWeight', () => {
  it('sums weights and tolerates NaN', () => {
    expect(
      totalWeight([
        { evaluatorId: 'a', weight: 40, config: {} },
        { evaluatorId: 'b', weight: Number.NaN, config: {} },
      ]),
    ).toBe(40);
  });
});
