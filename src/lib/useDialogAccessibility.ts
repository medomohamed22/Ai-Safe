import { useEffect } from 'react';

export function useDialogAccessibility() {
  useEffect(() => {
    let current: HTMLElement | undefined;
    let restore: HTMLElement | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const closeButton = (dialog: HTMLElement) => dialog.querySelector<HTMLElement>('[data-dialog-close]') || Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent?.trim() === 'Close');
    const dismiss = (dialog: HTMLElement, close: HTMLElement) => {
      if (dialog.dataset.closing) return;
      const finish = () => { if (dialog.isConnected) { dialog.dataset.closeReady = 'true'; close.click(); } };
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
      dialog.dataset.closing = 'true';
      const timer = setTimeout(() => { timers.delete(timer); finish(); }, 140); timers.add(timer);
    };
    const focusable = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length > 0);
    const scan = () => {
      const next = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(el => el.getClientRects().length > 0).at(-1);
      if (next === current) return;
      if (!current && next) restore = document.activeElement as HTMLElement;
      current = next;
      if (next) {
        next.setAttribute('aria-modal', 'true');
        if (!next.contains(document.activeElement)) (focusable(next)[0] || next).focus();
      } else if (restore?.isConnected) { restore.focus(); restore = null; }
    };
    const observer = new MutationObserver(scan); observer.observe(document.body, { childList: true, subtree: true });
    const keyboard = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === 'Escape') {
        const close = closeButton(current);
        if (close && !close.hasAttribute('disabled')) { e.preventDefault(); e.stopImmediatePropagation(); close.click(); }
      }
      if (e.key === 'Tab') {
        const items = focusable(current); if (!items.length) { e.preventDefault(); return; }
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && index <= 0) { e.preventDefault(); items.at(-1)!.focus(); }
        else if (!e.shiftKey && (index < 0 || index === items.length - 1)) { e.preventDefault(); items[0].focus(); }
      }
    };
    const closeClick = (e: MouseEvent) => {
      if (!current || current.dataset.closeReady) return;
      const close = closeButton(current);
      const clicked = (e.target as Element).closest('button');
      if (close && !close.hasAttribute('disabled') && (clicked === close || (e.target === current && current.classList.contains('items-center')))) {
        e.preventDefault(); e.stopImmediatePropagation(); dismiss(current, close);
      }
    };
    const backdropDown = (e: MouseEvent) => { if (current && e.target === current && current.classList.contains('items-center')) { e.preventDefault(); e.stopImmediatePropagation(); const close = closeButton(current); if (close && !close.hasAttribute('disabled')) dismiss(current, close); } };
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('click', closeClick, true);
    document.addEventListener('mousedown', backdropDown, true);
    return () => { observer.disconnect(); timers.forEach(clearTimeout); document.removeEventListener('keydown', keyboard, true); document.removeEventListener('click', closeClick, true); document.removeEventListener('mousedown', backdropDown, true); };
  }, []);
}
