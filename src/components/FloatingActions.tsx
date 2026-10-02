import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getCart, getServerCart, onToast, subscribeCart } from '../lib/cart';
import { WA_URL } from '../data/clinic';

interface FloatingActionsProps {
  /** En /reservar el botón "Mis Citas" sobra: ya estás en la lista */
  hideCartButton?: boolean;
}

// Botones flotantes (Mis Citas + WhatsApp) y aviso de "agregado a tu lista".
export default function FloatingActions({ hideCartButton = false }: FloatingActionsProps) {
  const cart = useSyncExternalStore(subscribeCart, getCart, getServerCart);
  const count = cart.length;
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () =>
      onToast((message) => {
        setToast({ message, visible: true });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
      }),
    [],
  );

  return (
    <>
      {!hideCartButton && (
        <button
          id="cart-float-btn"
          type="button"
          aria-label="Ver lista de citas"
          data-count={count}
          onClick={() => {
            window.location.href = '/reservar';
          }}
          className="fixed bottom-20 right-6 z-[900] flex items-center gap-2 rounded-[50px] border-0 bg-ink px-[1.2rem] py-3 font-body text-[0.82rem] font-medium tracking-[0.5px] text-white cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.2)] transition-[translate,background-color,box-shadow] duration-[220ms] ease-out hover:bg-primary hover:shadow-[0_12px_35px_rgba(0,125,136,0.3)] motion-safe:hover:-translate-y-[3px] max-xs:px-4 max-xs:py-[0.7rem]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          <span className="text-[0.82rem] max-xs:hidden">Mis Citas</span>
          {count > 0 && (
            <span
              key={count}
              className="flex items-center justify-center min-w-5 h-5 px-[5px] rounded-[50px] bg-[#C0392B] text-white text-[0.72rem] font-bold motion-safe:animate-badge-pop"
            >
              {count}
            </span>
          )}
        </button>
      )}

      <a
        id="wa-float-btn"
        href={WA_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escríbenos por WhatsApp"
        className="fixed bottom-6 right-6 z-[900] flex items-center justify-center size-[54px] rounded-full bg-[#25D366] text-white no-underline shadow-[0_8px_30px_rgba(37,211,102,0.4)] transition-[scale,background-color,box-shadow] duration-[220ms] ease-out hover:bg-[#20b858] hover:shadow-[0_12px_35px_rgba(37,211,102,0.5)] motion-safe:hover:scale-110"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

      <div
        id="ek-toast"
        role="status"
        aria-live="polite"
        className={[
          'fixed bottom-36 right-6 z-[1100] max-w-[280px] rounded-[10px] bg-ink px-[1.4rem] py-[0.85rem] font-body text-[0.88rem] font-normal text-white pointer-events-none shadow-[0_10px_30px_rgba(0,0,0,0.2)]',
          'max-xs:left-4 max-xs:right-4 max-xs:bottom-32 max-xs:max-w-none',
          toast.visible
            ? 'opacity-100 translate-y-0 transition-[opacity,translate] duration-[280ms] ease-out'
            : 'opacity-0 translate-y-2 transition-[opacity,translate] duration-[160ms] ease-out',
        ].join(' ')}
      >
        {toast.message}
      </div>
    </>
  );
}
