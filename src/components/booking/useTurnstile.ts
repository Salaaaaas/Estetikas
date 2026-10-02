import { useEffect, useRef, type RefObject } from 'react';

interface TurnstileApi {
  render: (el: HTMLElement, opts: { sitekey: string; theme: 'light'; size: 'flexible' }) => string;
  getResponse: (id: string) => string | undefined;
  reset: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Monta el widget de Cloudflare Turnstile en `container`. El script se carga
 * desde BaseLayout (needsTurnstile) y avisa con el evento 'turnstile-loaded'.
 */
export function useTurnstile(container: RefObject<HTMLDivElement | null>) {
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const sitekey = document.querySelector<HTMLMetaElement>('meta[name="turnstile-sitekey"]')?.content;
    if (!sitekey) {
      console.warn('Turnstile sitekey ausente');
      return;
    }
    const mount = () => {
      if (!window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(el, { sitekey, theme: 'light', size: 'flexible' });
    };
    if (window.turnstile) mount();
    else window.addEventListener('turnstile-loaded', mount, { once: true });
    return () => window.removeEventListener('turnstile-loaded', mount);
  }, [container]);

  return {
    /** Token del desafío; 'BYPASS_DEV' si el widget no está (desarrollo local). */
    getToken: () =>
      window.turnstile && widgetId.current !== null ? (window.turnstile.getResponse(widgetId.current) ?? '') : 'BYPASS_DEV',
    reset: () => {
      if (window.turnstile && widgetId.current !== null) window.turnstile.reset(widgetId.current);
    },
  };
}
