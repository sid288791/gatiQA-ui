import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GenerateTestPage from './GenerateTestPage';
import { renderWithProviders } from '../../test/utils';

async function fillAndGenerate(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText(/test description/i),
    'Agent must decline refunds older than 30 days',
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/profile version/i)).toBeEnabled(),
  );
  await user.selectOptions(
    screen.getByLabelText(/profile version/i),
    'prof-support@2',
  );
  await user.click(screen.getByRole('button', { name: /^generate$/i }));
}

describe('GenerateTestPage', () => {
  it('keeps Generate disabled until prompt and profile version are set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GenerateTestPage />);
    const btn = screen.getByRole('button', { name: /^generate$/i });
    expect(btn).toBeDisabled();
    await user.type(screen.getByLabelText(/test description/i), 'something');
    expect(btn).toBeDisabled(); // still no profile version
  });

  it('generates a draft, walks clarifications, and saves only after approval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GenerateTestPage />);
    await fillAndGenerate(user);

    // Draft appears with clarifications
    await screen.findByText(/clarifications needed/i);
    expect(screen.getByText(/missing expectations/i)).toBeInTheDocument();

    // Answer clarifications
    await user.selectOptions(
      screen.getByLabelText(/response time as well as content/i),
      'Content only',
    );
    await user.selectOptions(screen.getByLabelText(/which locale/i), 'en-US');
    await user.click(screen.getByRole('button', { name: /submit answers/i }));

    // Draft becomes ready; save still blocked until approval checkbox
    await waitFor(() =>
      expect(screen.queryByText(/clarifications needed/i)).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByText(/READY_FOR_REVIEW/)).toBeInTheDocument(),
    );
    const saveBtn = screen.getByRole('button', { name: /approve & save test/i });
    expect(saveBtn).toBeDisabled();

    await user.click(screen.getByLabelText(/approve test spec/i));
    expect(saveBtn).toBeEnabled();
    await user.click(saveBtn);

    await screen.findByText(/saved as test-/i);
  });

  it('supports adding a missing expectation and editing JSON', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GenerateTestPage />);
    await fillAndGenerate(user);
    await screen.findByText(/missing expectations/i);

    // Add a missing expectation — it gets injected into the expectations JSON
    await user.click(screen.getByRole('button', { name: /add expectation/i }));

    // Edit the draft expectations JSON directly
    const editor = screen.getByLabelText(/draft expectations json/i);
    fireEvent.change(editor, { target: { value: '{ invalid' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid json/i);
  });
});
