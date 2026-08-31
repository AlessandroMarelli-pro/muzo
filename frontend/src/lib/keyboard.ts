/**
 * Whether an event target is somewhere the user is typing or navigating a
 * popup, in which case global single-key shortcuts must not fire.
 */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;

  return (
    !!element &&
    (element.tagName === 'INPUT' ||
      element.tagName === 'TEXTAREA' ||
      element.tagName === 'SELECT' ||
      element.isContentEditable ||
      !!element.closest('[role="listbox"], [role="dialog"], [role="menu"]'))
  );
};
