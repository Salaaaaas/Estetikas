// Bloqueo de scroll del fondo mientras hay un overlay abierto (menú móvil).
let savedScrollY = 0;

export function lockScroll(): void {
  if (document.body.dataset.scrollLocked) return;
  savedScrollY = window.scrollY;
  document.body.style.overflow = 'hidden';
  document.body.dataset.scrollLocked = '1';
}

export function unlockScroll(): void {
  if (!document.body.dataset.scrollLocked) return;
  document.body.style.overflow = '';
  delete document.body.dataset.scrollLocked;
  window.scrollTo(0, savedScrollY);
}
