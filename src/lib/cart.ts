// Lista de tratamientos para reservar ("Mis Citas"), persistida en localStorage.
// Fuente única para la isla flotante, los botones de las tarjetas y /reservar.

export interface CartItem {
  id: string;
  name: string;
}

const CART_KEY = 'estetikas_cart_v1';
const CHANGE_EVENT = 'ek:cart-change';
const TOAST_EVENT = 'ek:toast';

const EMPTY: CartItem[] = [];
let cache: CartItem[] | null = null;

function read(): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

function isCartItem(v: unknown): v is CartItem {
  return typeof v === 'object' && v !== null && typeof (v as CartItem).id === 'string' && typeof (v as CartItem).name === 'string';
}

function write(cart: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  cache = cart;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Instantánea estable (misma referencia mientras no cambie): apta para useSyncExternalStore. */
export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return EMPTY;
  if (cache === null) cache = read();
  return cache;
}

export function getServerCart(): CartItem[] {
  return EMPTY;
}

export function addToCart(id: string, name: string): void {
  const cart = getCart();
  if (!cart.some((i) => i.id === id)) write([...cart, { id, name }]);
  showToast(`"${name}" agregado a tu lista`);
}

export function removeFromCart(id: string): void {
  write(getCart().filter((i) => i.id !== id));
}

export function clearCart(): void {
  write([]);
}

/** Suscripción a cambios (misma pestaña y otras pestañas). Devuelve la función para desuscribirse. */
export function subscribeCart(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== CART_KEY) return;
    cache = null;
    callback();
  };
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

export function showToast(message: string): void {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}

export function onToast(callback: (message: string) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent<string>).detail);
  window.addEventListener(TOAST_EVENT, handler);
  return () => window.removeEventListener(TOAST_EVENT, handler);
}
