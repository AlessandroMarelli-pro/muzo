import { CamelotWheel } from '@/components/harmonic/camelot-wheel';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

describe('CamelotWheel', () => {
  it('renders all 24 keys as pressable segments', () => {
    render(<CamelotWheel onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: '8A — A minor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12B — E major' })).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(24);
  });

  it('marks the selected key as pressed', () => {
    render(<CamelotWheel selected="8A" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: '8A — A minor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '9B — G major' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onSelect with the code on click and on Enter', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CamelotWheel onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: '5A — C minor' }));
    expect(onSelect).toHaveBeenCalledWith('5A');

    screen.getByRole('button', { name: '7B — F major' }).focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('7B');
  });

  it('has no axe violations', async () => {
    const { container } = render(<CamelotWheel selected="8A" onSelect={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
