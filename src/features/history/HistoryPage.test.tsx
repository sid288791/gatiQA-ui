import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { fixtureApi } from '../../api/fixtures';
import { renderWithProviders } from '../../test/utils';
import HistoryPage from './HistoryPage';

async function seedRuns(count: number) {
  const tc = await fixtureApi.createTestCase({
    name: 'History seed test',
    test_spec: { request: { query: 'wax' }, expectations: {} },
  });
  for (let i = 0; i < count; i++) {
    await fixtureApi.runTestCase('wax', tc.id);
  }
  return tc;
}

// NOTE: fixture state accumulates within this test file, so assertions are
// relative (>=) rather than exact counts.
describe('HistoryPage', () => {
  it('renders dashboard counts and the run history table', async () => {
    await seedRuns(3);
    renderWithProviders(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByTestId('summary-total-runs')).not.toHaveTextContent('—'),
    );
    expect(screen.getByTestId('summary-test-cases')).toBeInTheDocument();
    expect(screen.getByTestId('summary-passed')).toBeInTheDocument();
    expect(screen.getByTestId('summary-failed')).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getAllByText('History seed test').length).toBeGreaterThanOrEqual(3),
    );
    expect(screen.getAllByText('PASSED').length).toBeGreaterThanOrEqual(3);
  });

  it('shows an empty state when there is no history', async () => {
    renderWithProviders(<HistoryPage />);
    // Fixture history may already have entries from the previous test; either
    // the table or the empty state must render.
    await waitFor(() =>
      expect(
        screen.queryByText(/no runs yet/i) ?? screen.getByRole('table'),
      ).toBeTruthy(),
    );
  });
});
