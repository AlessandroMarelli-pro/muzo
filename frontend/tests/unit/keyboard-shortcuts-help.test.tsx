import { KeyboardShortcutsHelp } from '@/components/track/keyboard-shortcuts-help';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

describe('KeyboardShortcutsHelp', () => {
  it('exposes a labelled trigger and reveals the shortcut map', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcutsHelp />);

    const trigger = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByText('Play next track')).toBeInTheDocument();
    expect(screen.getByText('Next page')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<KeyboardShortcutsHelp />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
