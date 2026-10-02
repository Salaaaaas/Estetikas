// Botones "Reservar" (tarjetas) y "Agregar a Mi Lista" (fichas): añaden el
// tratamiento al carrito y pasan a estado "agregado" (data-added).
import { addToCart } from '../lib/cart';

document.querySelectorAll<HTMLButtonElement>('[data-add-to-cart]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { cartId, cartName } = btn.dataset;
    if (!cartId || !cartName) return;
    addToCart(cartId, cartName);
    btn.dataset.added = '';
  });
});
