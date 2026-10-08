import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Evaluator } from '../../api';
import { renderWithProviders } from '../../test/utils';
import { ProfileVersionEditor } from './ProfileVersionEditor';

const registry: Evaluator[] = [
  {
    id: 'ev-a',
    name: 'Evaluator A',
    version: '1.0.0',
    description: 'First evaluator',
    configSchema: [{ key: 'req', label: 'Required field', type: 'string', required: true }],
  },
  {
    id: 'ev-b',
    name: 'Evaluator B',
    version: '2.0.0',
    description: 'Second evaluator',
    configSchema: [],
  },
];

describe('ProfileVersionEditor', () => {
  it('shows live weight total and blocks save when total is not 100', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <ProfileVersionEditor registry={registry} isNewProfile onSave={onSave} />,
    );

    await user.type(screen.getByLabelText(/profile name/i), 'Test profile');
    await user.click(screen.getByLabelText('Select Evaluator A'));
    await user.clear(screen.getByLabelText('Weight for Evaluator A'));
    await user.type(screen.getByLabelText('Weight for Evaluator A'), '60');
    await user.type(screen.getByLabelText(/required field/i), 'cfg');

    expect(screen.getByTestId('weight-total')).toHaveTextContent('60 / 100');

    await user.click(screen.getByRole('button', { name: /create profile/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').map((e) => e.textContent).join(' ')).toMatch(
      /must equal 100/,
    );
  });

  it('flags missing required config on save attempt', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <ProfileVersionEditor registry={registry} isNewProfile onSave={onSave} />,
    );

    await user.type(screen.getByLabelText(/profile name/i), 'Test profile');
    await user.click(screen.getByLabelText('Select Evaluator A'));
    await user.clear(screen.getByLabelText('Weight for Evaluator A'));
    await user.type(screen.getByLabelText('Weight for Evaluator A'), '100');

    await user.click(screen.getByRole('button', { name: /create profile/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').map((e) => e.textContent).join(' ')).toMatch(
      /Required field.*required/i,
    );
  });

  it('saves a valid new profile', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <ProfileVersionEditor registry={registry} isNewProfile onSave={onSave} />,
    );

    await user.type(screen.getByLabelText(/profile name/i), 'Test profile');
    await user.click(screen.getByLabelText('Select Evaluator A'));
    await user.clear(screen.getByLabelText('Weight for Evaluator A'));
    await user.type(screen.getByLabelText('Weight for Evaluator A'), '100');
    await user.type(screen.getByLabelText(/required field/i), 'cfg');

    await user.click(screen.getByRole('button', { name: /create profile/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test profile',
        evaluators: [{ evaluatorId: 'ev-a', weight: 100, config: { req: 'cfg' } }],
        passThreshold: 0.8,
      }),
    );
  });
});
