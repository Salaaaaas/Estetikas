import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);


// =====================================================
// CART / BOOKING SYSTEM
// =====================================================
const CART_KEY = 'estetikas_cart_v1';
const WA_PHONE = '50684320647';

const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
const saveCart = (cart) => localStorage.setItem(CART_KEY, JSON.stringify(cart));

function addToCart(id, name) {
    const cart = getCart();
    if (!cart.find(i => i.id === id)) { cart.push({ id, name }); saveCart(cart); }
    updateCartBadges();
    showToast(`"${name}" agregado a tu lista`);
}

function removeFromCart(id) {
    saveCart(getCart().filter(i => i.id !== id));
    updateCartBadges();
    renderModalItems();
}

function clearCart() { saveCart([]); updateCartBadges(); }

function updateCartBadges() {
    const count = getCart().length;
    document.querySelectorAll('.cart-badge').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? 'flex' : 'none';
    });
    const btn = document.getElementById('cart-float-btn');
    if (btn) btn.setAttribute('data-count', count);
}

function showToast(msg) {
    let toast = document.getElementById('ek-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'ek-toast'; document.body.appendChild(toast); }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('visible'), 3000);
}

function injectCartUI() {
    if (document.getElementById('cart-float-btn')) { updateCartBadges(); return; }

    // Cart float button
    const cartBtn = document.createElement('button');
    cartBtn.id = 'cart-float-btn';
    cartBtn.setAttribute('aria-label', 'Ver lista de citas');
    cartBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        <span class="cart-float-label">Mis Citas</span>
        <span class="cart-badge" style="display:none">0</span>
    `;
    document.body.appendChild(cartBtn);
    cartBtn.addEventListener('click', openBookingModal);

    // WA float button
    const waBtn = document.createElement('a');
    waBtn.id = 'wa-float-btn';
    waBtn.href = `https://wa.me/${WA_PHONE}`;
    waBtn.target = '_blank';
    waBtn.rel = 'noopener noreferrer';
    waBtn.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    waBtn.innerHTML = `
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
    `;
    document.body.appendChild(waBtn);

    // Booking modal
    const modal = document.createElement('div');
    modal.id = 'booking-modal';
    modal.className = 'booking-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-heading');
    modal.innerHTML = `
        <div class="booking-modal-panel">
            <div class="modal-header">
                <div class="modal-header-text">
                    <h2 id="modal-heading">Reservar Cita</h2>
                    <p>Completa tus datos y te contactamos</p>
                </div>
                <button class="modal-close-btn" id="modal-close-btn" aria-label="Cerrar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div id="modal-items-section"></div>
                <form id="booking-form" novalidate>
                    <div class="booking-form-grid">
                        <div class="form-group-modal">
                            <label for="b-name">Nombre Completo *</label>
                            <input type="text" id="b-name" placeholder="Tu nombre completo" required autocomplete="name">
                        </div>
                        <div class="form-group-modal">
                            <label for="b-phone">Teléfono / WhatsApp *</label>
                            <input type="tel" id="b-phone" placeholder="+506 XXXX XXXX" required autocomplete="tel">
                        </div>
                        <div class="form-group-modal form-span-full">
                            <label for="b-sede">Sede de Preferencia *</label>
                            <div class="select-wrapper">
                                <select id="b-sede" required>
                                    <option value="" disabled selected>Selecciona una sede...</option>
                                    <option value="Bataan (Clínica ODONTOBATAAN)">Bataan — Clínica ODONTOBATAAN</option>
                                    <option value="Guápiles (Clínica Medical Numancia)">Guápiles — Clínica Medical Numancia</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group-modal form-span-full">
                            <label>Fecha Preferida</label>
                            <div class="cal-wrapper" id="b-cal-wrapper" role="group" aria-label="Seleccionar fecha de cita"></div>
                            <input type="hidden" id="b-date">
                        </div>
                        <div class="form-group-modal form-span-full">
                            <label for="b-time">Horario</label>
                            <div class="select-wrapper">
                                <select id="b-time">
                                    <option value="">Selecciona una fecha primero</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group-modal form-span-full">
                            <label for="b-notes">Notas Adicionales</label>
                            <textarea id="b-notes" rows="3" maxlength="500" placeholder="Condición médica relevante, alergias, preguntas..."></textarea>
                        </div>
                        <div class="form-group-modal form-span-full habeas-data">
                            <label class="habeas-label">
                                <input type="checkbox" id="b-consent" required>
                                <span>Acepto el <a href="/privacidad" target="_blank" rel="noopener">tratamiento de mis datos personales</a> conforme a la Ley 1581 de 2012 (Habeas Data) para gestionar mi cita y recibir información de mi tratamiento.</span>
                            </label>
                        </div>
                        <div class="form-group-modal form-span-full">
                            <div id="b-turnstile" class="cf-turnstile"></div>
                        </div>
                    </div>
                    <button type="submit" class="btn modal-submit-btn" id="modal-submit-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px; flex-shrink:0; vertical-align:middle">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        Confirmar Reserva
                    </button>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('modal-close-btn').addEventListener('click', closeBookingModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeBookingModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) closeBookingModal(); });
    document.getElementById('booking-form').addEventListener('submit', submitBooking);

    renderTurnstile();
    updateCartBadges();
}

// Renderiza el widget de Cloudflare Turnstile cuando el script esté cargado
let turnstileWidgetId = null;
function renderTurnstile() {
    const container = document.getElementById('b-turnstile');
    if (!container) return;
    const sitekey = document.querySelector('meta[name="turnstile-sitekey"]')?.content;
    if (!sitekey) { console.warn('Turnstile sitekey ausente'); return; }

    const mount = () => {
        if (!window.turnstile || turnstileWidgetId !== null) return;
        turnstileWidgetId = window.turnstile.render('#b-turnstile', {
            sitekey,
            theme: 'light',
            size: 'flexible'
        });
    };
    if (window.turnstile) mount();
    else window.addEventListener('turnstile-loaded', mount, { once: true });
}

function renderModalItems() {
    const section = document.getElementById('modal-items-section');
    if (!section) return;
    const cart = getCart();

    if (cart.length === 0) {
        section.innerHTML = `
            <div class="modal-empty-state">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="1.5" opacity="0.6">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                <p>Tu lista de citas está vacía.</p>
                <a href="/tratamientos" class="btn" style="font-size:0.82rem; padding:0.65rem 1.4rem; margin-top:0.5rem" onclick="closeBookingModal()">Explorar Tratamientos</a>
            </div>
        `;
        return;
    }

    section.innerHTML = `
        <div class="modal-items-header">
            <p>Tratamientos seleccionados <strong>(${cart.length})</strong></p>
        </div>
        <ul class="modal-items-list">
            ${cart.map(item => `
                <li class="modal-item-row">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    <span class="modal-item-name">${item.name}</span>
                    <button class="modal-item-del" data-id="${item.id}" aria-label="Eliminar ${item.name}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </li>
            `).join('')}
        </ul>
        <div class="modal-items-divider"></div>
    `;

    section.querySelectorAll('.modal-item-del').forEach(btn => {
        btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
    });
}

// Scroll lock — position:fixed trick, the only approach that reliably
// locks background scroll on iOS without blocking scroll inside fixed overlays.
let _savedScrollY = 0;
let _lenis = null;

function lockScroll() {
    if (document.body.dataset.scrollLocked) return;
    _savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.dataset.scrollLocked = '1';
}
function unlockScroll() {
    if (!document.body.dataset.scrollLocked) return;
    document.body.style.overflow = '';
    delete document.body.dataset.scrollLocked;
    window.scrollTo(0, _savedScrollY);
}

// ---- SCHEDULE DATA ----
// To update for a new month: edit 'date' entries below.
// 'weekly' entries repeat on weekdays forever (good for recurring slots).
// 'date'   entries are one-time specific dates.
const SCHEDULE = [
    {
        id:       'limpiezas-sem',
        type:     'weekly',
        weekdays: [2, 3, 4, 5],           // Tue=2, Wed=3, Thu=4, Fri=5
        hours:    '5:30 PM – 7:30 PM',
        label:    'Limpiezas Faciales',
        forIds:   ['limpieza-facial'],
    },
    {
        id:       'masajes-06jun',
        type:     'date',
        date:     '2026-06-06',
        hours:    '9:00 AM – 3:00 PM',
        label:    'Masajes y Limpiezas',
        forIds:   ['masajes', 'limpieza-facial'],
    },
    {
        id:       'medicina-20jun',
        type:     'date',
        date:     '2026-06-20',
        hours:    '8:00 AM – 4:00 PM',
        label:    'Medicina Estética',
        forIds:   ['*'],                   // all other treatments
    },
];

const SLOT_DURATION_MIN = 60;

function parseTime12ToMin(str) {
    const m = str.trim().match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const period = m[3].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + min;
}

function minToTime24(totalMin) {
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

function minToTime12(totalMin) {
    const h24 = Math.floor(totalMin / 60);
    const m   = totalMin % 60;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12    = h24 > 12 ? h24 - 12 : (h24 === 0 ? 12 : h24);
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// "5:30 PM – 7:30 PM" → [{label: "5:30 PM", time24: "17:30"}, {label: "6:30 PM", time24: "18:30"}]
function generateSlots(hoursStr) {
    const parts = hoursStr.split(' – ');
    if (parts.length !== 2) return [];
    const startMin = parseTime12ToMin(parts[0]);
    const endMin   = parseTime12ToMin(parts[1]);
    if (startMin === null || endMin === null) return [];
    const slots = [];
    for (let t = startMin; t + SLOT_DURATION_MIN <= endMin; t += SLOT_DURATION_MIN) {
        slots.push({ label: minToTime12(t), time24: minToTime24(t) });
    }
    return slots;
}

function getApplicableSchedules(cartIds) {
    if (cartIds.length === 0) return SCHEDULE;
    const hasLimpieza     = cartIds.includes('limpieza-facial');
    const hasMasaje       = cartIds.includes('masajes');
    const hasMedEstetica  = cartIds.some(id => id !== 'limpieza-facial' && id !== 'masajes');
    return SCHEDULE.filter(s => {
        if (s.forIds.includes('*')) return hasMedEstetica;
        return s.forIds.some(id => cartIds.includes(id));
    });
}

function buildAvailableSet(schedules) {
    const today = new Date(); today.setHours(0,0,0,0);
    const set = new Set();
    schedules.forEach(s => {
        if (s.type === 'date') {
            const d = new Date(s.date + 'T00:00:00');
            if (d >= today) set.add(s.date);
        } else if (s.type === 'weekly') {
            for (let i = 1; i < 90; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() + i);
                if (s.weekdays.includes(d.getDay())) set.add(d.toISOString().split('T')[0]);
            }
        }
    });
    return set;
}

function getSessionsForDate(dateStr, schedules) {
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    return schedules.filter(s =>
        s.type === 'date' ? s.date === dateStr : s.weekdays.includes(dow)
    );
}

let _calState = { year: null, month: null, selected: null, fullDays: new Set() };
let _availCache = {}; // "year-month" → grouped availability data, reset on modal open

function renderCalendar() {
    const wrapper = document.getElementById('b-cal-wrapper');
    if (!wrapper) return;

    const cartIds = getCart().map(i => i.id);
    const schedules = getApplicableSchedules(cartIds);
    const availableSet = buildAvailableSet(schedules);

    const now = new Date();
    if (_calState.year === null) {
        _calState.year  = now.getFullYear();
        _calState.month = now.getMonth();
    }
    const { year, month, selected } = _calState;

    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = today.toISOString().split('T')[0];
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DOWS   = ['D','L','M','M','J','V','S'];

    const firstDow     = new Date(year, month, 1).getDay();
    const daysInMonth  = new Date(year, month + 1, 0).getDate();
    const daysInPrev   = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--)
        cells.push({ day: daysInPrev - i, other: true });
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dt = new Date(ds + 'T00:00:00');
        const avail = availableSet.has(ds) && !_calState.fullDays.has(ds);
        cells.push({ day: d, dateStr: ds, past: dt < today, avail, full: _calState.fullDays.has(ds), sel: ds === selected, today: ds === todayStr });
    }
    while (cells.length < 42) cells.push({ day: cells.length - firstDow - daysInMonth + 1, other: true });

    const dayBtns = cells.map(c => {
        if (c.other) return `<span class="cal-day cal-day--ghost">${c.day}</span>`;
        const cls = ['cal-day',
            c.avail && !c.past ? 'cal-day--avail' : '',
            c.full             ? 'cal-day--full'  : '',
            c.sel              ? 'cal-day--sel'   : '',
            c.today            ? 'cal-day--today'  : '',
        ].filter(Boolean).join(' ');
        const dis = c.past || !c.avail ? 'disabled' : '';
        return `<button class="${cls}" type="button" data-date="${c.dateStr}" ${dis} aria-pressed="${c.sel}">${c.day}</button>`;
    }).join('');

    wrapper.innerHTML = `
        <div class="cal-nav">
            <button class="cal-nav-btn" id="cal-prev" type="button" aria-label="Mes anterior" ${isCurrentMonth ? 'disabled' : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span class="cal-month-title">${MONTHS[month]} ${year}</span>
            <button class="cal-nav-btn" id="cal-next" type="button" aria-label="Mes siguiente">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        </div>
        <div class="cal-grid">
            ${DOWS.map(d => `<span class="cal-dow">${d}</span>`).join('')}
            ${dayBtns}
        </div>
        ${schedules.length === 0 ? '<p class="cal-no-slots">No hay sesiones disponibles para los tratamientos seleccionados.</p>' : ''}
        ${selected ? '' : schedules.length > 0 ? '<p class="cal-hint">Los dias marcados tienen sesiones disponibles.</p>' : ''}
    `;

    document.getElementById('cal-prev')?.addEventListener('click', () => {
        _calState.month--;
        if (_calState.month < 0) { _calState.month = 11; _calState.year--; }
        _calState.fullDays = new Set();
        renderCalendar();
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
        _calState.month++;
        if (_calState.month > 11) { _calState.month = 0; _calState.year++; }
        _calState.fullDays = new Set();
        renderCalendar();
    });

    wrapper.querySelectorAll('.cal-day[data-date]').forEach(btn => {
        btn.addEventListener('click', () => {
            _calState.selected = btn.dataset.date;
            document.getElementById('b-date').value = btn.dataset.date;
            updateCalendarSelection(btn.dataset.date);
            updateSessionSelect(getSessionsForDate(btn.dataset.date, schedules), btn.dataset.date);
        });
    });

    if (!selected) {
        const el = document.getElementById('b-time');
        if (el) el.innerHTML = '<option value="">Selecciona una fecha primero</option>';
    }

    refreshFullDays(year, month + 1, schedules, availableSet);
}

function updateCalendarSelection(dateStr) {
    document.querySelectorAll('.cal-day[data-date]').forEach(btn => {
        const isSel = btn.dataset.date === dateStr;
        btn.classList.toggle('cal-day--sel', isSel);
        btn.setAttribute('aria-pressed', String(isSel));
    });
    const hint = document.querySelector('.cal-hint');
    if (hint) hint.style.display = 'none';
}

async function updateSessionSelect(sessions, dateStr) {
    const el = document.getElementById('b-time');
    if (!el) return;
    if (!sessions.length) { el.innerHTML = '<option value="">Sin horario para esta fecha</option>'; return; }

    el.innerHTML = '<option value="">Cargando horarios...</option>';
    el.disabled = true;

    let bookedSet = new Set();
    try {
        const res  = await fetch(`/api/get-availability?date=${dateStr}`);
        const data = await res.json();
        bookedSet  = new Set(data.booked ?? []);
    } catch {}

    el.innerHTML = '';
    el.disabled = false;

    let totalSlots = 0;
    let availableSlots = 0;

    sessions.forEach(s => {
        const slots = generateSlots(s.hours);
        if (!slots.length) return;
        const group = document.createElement('optgroup');
        group.label = s.label;
        slots.forEach(slot => {
            totalSlots++;
            const o = document.createElement('option');
            o.value = slot.time24;
            if (bookedSet.has(slot.time24)) {
                o.textContent = `${slot.label} — Ocupado`;
                o.disabled = true;
            } else {
                o.textContent = slot.label;
                availableSlots++;
            }
            group.appendChild(o);
        });
        el.appendChild(group);
    });

    if (totalSlots === 0) {
        el.innerHTML = '<option value="">Sin horarios configurados</option>';
    } else if (availableSlots === 0) {
        el.innerHTML = '<option value="">Todos los horarios están ocupados</option>';
    } else {
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = `Selecciona un horario (${availableSlots} disponible${availableSlots !== 1 ? 's' : ''})`;
        el.insertBefore(placeholder, el.firstChild);
    }
}

async function refreshFullDays(year, month, schedules, availableSet) {
    const cacheKey = `${year}-${month}`;
    try {
        let grouped = _availCache[cacheKey];
        if (!grouped) {
            const res = await fetch(`/api/get-availability?year=${year}&month=${month}`);
            grouped = await res.json();
            _availCache[cacheKey] = grouped;
        }
        // { "2026-06-10": ["17:30", ...], ... }

        const fullDays = new Set();
        availableSet.forEach(dateStr => {
            const dow        = new Date(dateStr + 'T00:00:00').getDay();
            const daySessions = schedules.filter(s =>
                s.type === 'date' ? s.date === dateStr : s.weekdays.includes(dow)
            );
            const totalSlots  = daySessions.reduce((sum, s) => sum + generateSlots(s.hours).length, 0);
            const bookedCount = (grouped[dateStr] ?? []).length;
            if (totalSlots > 0 && bookedCount >= totalSlots) fullDays.add(dateStr);
        });

        _calState.fullDays = fullDays;

        document.querySelectorAll('.cal-day[data-date]').forEach(btn => {
            const d = btn.dataset.date;
            if (fullDays.has(d)) {
                btn.disabled = true;
                btn.classList.add('cal-day--full');
                btn.classList.remove('cal-day--avail');
            }
        });
    } catch {}
}

function openBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;
    renderModalItems();
    _calState = { year: null, month: null, selected: null, fullDays: new Set() };
    _availCache = {};
    renderCalendar();
    modal.classList.add('open');
    lockScroll();
    _lenis?.stop();
}

function closeBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.classList.remove('open');
        unlockScroll();
        _lenis?.start();
    }
}

async function submitBooking(e) {
    e.preventDefault();

    const cart = getCart();
    const name  = document.getElementById('b-name').value.trim();
    const phone = document.getElementById('b-phone').value.trim();
    const sede  = document.getElementById('b-sede').value;
    const date  = document.getElementById('b-date').value;
    const time  = document.getElementById('b-time').value;
    const notes = document.getElementById('b-notes').value.trim();
    const consent = document.getElementById('b-consent').checked;



    if (!name || !phone || !sede || !date || !time) {
        showToast('Por favor completa los campos requeridos (*)'); return;
    }
    if (cart.length === 0) { showToast('Selecciona al menos un tratamiento para continuar'); return; }
    if (!consent) { showToast('Debes aceptar el tratamiento de datos para continuar'); return; }

    const turnstileToken = (window.turnstile && turnstileWidgetId !== null)
        ? window.turnstile.getResponse(turnstileWidgetId)
        : 'BYPASS_DEV';

    const btn = document.getElementById('modal-submit-btn');
    const originalHTML = btn.innerHTML;
    btn.textContent = 'Enviando...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/create-booking', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                nombre:                     name,
                telefono:                   phone,
                sede,
                fecha:                      date,
                hora:                       time,
                servicios:                  cart.map(i => ({ slug: i.id, name: i.name })),
                notas:                      notes || null,
                consentimiento_habeas_data: true,
                turnstile_token:            turnstileToken
            })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {

            if (res.status === 429) {
                showToast('Demasiados intentos. Por favor espera unos minutos.');
            } else if (res.status === 400 && data.detalles) {
                showToast('Revisa los datos: ' + data.detalles[0]);
            } else if (res.status === 403) {
                showToast('No pudimos verificar tu identidad. Recarga la página.');
            } else {
                showToast('No pudimos guardar tu cita. Intenta de nuevo.');
            }
            if (window.turnstile && turnstileWidgetId !== null) {
                window.turnstile.reset(turnstileWidgetId);
            }
            return;
        }

        clearCart();
        closeBookingModal();
        showToast('¡Cita registrada! Te contactaremos pronto para confirmar.');
        e.target.reset();
        if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
        }
    } catch (err) {
        console.error(err);
        showToast('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

function formatDateES(iso) {
    const [y, m, d] = iso.split('-');
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${parseInt(d)} de ${months[parseInt(m) - 1]} de ${y}`;
}

// Inject "Agregar a Mi Lista" on treatment detail pages
function injectTreatmentCartBtn() {
    const cta = document.querySelector('.whatsapp-cta-container');
    const h1 = document.querySelector('.treatment-detail-hero h1');
    if (!cta || !h1 || cta.querySelector('.add-to-list-btn')) return;

    const name = h1.textContent.trim();
    const id = window.location.pathname.split('/').pop().replace('.html', '') || 'tratamiento';

    const cartBtn = document.createElement('button');
    cartBtn.className = 'btn add-to-list-btn';
    cartBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;vertical-align:middle"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Agregar a Mi Lista de Citas
    `;
    cartBtn.addEventListener('click', () => {
        addToCart(id, name);
        cartBtn.innerHTML = `✓ Agregado a tu lista`;
        cartBtn.style.background = '#218838';
        cartBtn.style.borderColor = '#218838';
    });
    cta.appendChild(cartBtn);
}

// =====================================================
// MAIN SITE INIT
// =====================================================
const initSite = () => {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Cart UI (inject on all pages)
    injectCartUI();

    // Treatment detail cart button
    injectTreatmentCartBtn();

    // Hamburger menu
    const headerEl = document.querySelector('header');
    const navEl = document.querySelector('nav');
    if (headerEl && navEl && !headerEl.querySelector('.nav-toggle')) {
        const toggle = document.createElement('button');
        toggle.className = 'nav-toggle';
        toggle.setAttribute('aria-label', 'Abrir menú de navegación');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = `<span></span><span></span><span></span>`;
        headerEl.appendChild(toggle);

        const closeNav = () => {
            navEl.classList.remove('nav-open');
            toggle.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            unlockScroll();
        };

        toggle.addEventListener('click', () => {
            const isOpen = navEl.classList.toggle('nav-open');
            toggle.classList.toggle('is-open', isOpen);
            toggle.setAttribute('aria-expanded', isOpen.toString());
            if (isOpen) lockScroll(); else unlockScroll();
        });

        navEl.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', closeNav);
        });
    }

    if (isTouch) {
        document.body.classList.add('is-touch');
    }

    // Smooth Scroll (Lenis)
    _lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        syncTouch: true,
        touchMultiplier: 1.5,
    });
    _lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { _lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // Header scroll effect
    if (headerEl) {
        const onScroll = () => headerEl.classList.toggle('scrolled', window.scrollY > 15);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // Internal anchor scroll
    document.querySelectorAll('nav a, .service-link, a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            const target = document.querySelector(href);
            if (target) { e.preventDefault(); _lenis.scrollTo(target, { offset: -80, duration: 1.5 }); }
        });
    });

    // Reveal animations — will-change is set in CSS to pre-promote GPU layers.
    // After animation completes it's removed so desktop doesn't hold all layers in VRAM.
    const revealTargets = ".service-card, .faq-item, .before-after-container, .testimonial-featured, .testimonial-card-compact, .contact-info, .contact-form-wrapper, .treatment-detail-block, .trust-item, .t-card";
    ScrollTrigger.batch(revealTargets, {
        start: "top 88%",
        onEnter: batch => gsap.to(batch, {
            opacity: 1, y: 0, stagger: 0.08, duration: 0.65, ease: "power3.out", overwrite: true,
            onComplete() { batch.forEach(el => { el.style.willChange = 'auto'; }); }
        }),
        once: true
    });

    // Hero entrance — staggered editorial reveal
    if (document.querySelector('.hero-display')) {
        const heroLines = gsap.utils.toArray('.hero-display em, .hero-display span');
        gsap.from('.hero-eyemark', { opacity: 0, scaleX: 0, transformOrigin: 'left center', duration: 0.5, delay: 0.05, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from(heroLines, { opacity: 0, y: 40, duration: 0.9, stagger: 0.12, delay: 0.15, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from('.hero-bottom', { opacity: 0, y: 24, duration: 0.8, delay: 0.6, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from('.hero-image-wrap', { opacity: 0, scale: 0.95, duration: 1.6, delay: 0.1, ease: "expo.out", clearProps: 'transform,opacity' });
    }

    // Staff intro: heading + description entrance
    const staffIntro = document.querySelector('.staff-intro');
    if (staffIntro) {
        const tl = gsap.timeline({
            scrollTrigger: { trigger: staffIntro, start: 'top 80%', once: true }
        });
        tl.fromTo('.staff-intro-heading', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity' })
          .fromTo('.staff-intro-copy p',  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=0.4');
    }

    // Profile content sides: slide in from the appropriate direction
    gsap.utils.toArray('.profile-block').forEach((block, i) => {
        const side = block.querySelector('.profile-content-side');
        const isReverse = block.classList.contains('reverse');
        if (side) {
            gsap.fromTo(side,
                { opacity: 0, x: isReverse ? -28 : 28 },
                { opacity: 1, x: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity',
                  scrollTrigger: { trigger: side, start: 'top 80%', once: true } }
            );
        }
    });

    // Profile images: scale up on enter, darken on exit (ImageScaleFade paradigm)
    gsap.utils.toArray('.profile-image-side img').forEach(img => {
        gsap.fromTo(img,
            { scale: 0.88, opacity: 0 },
            { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out",
              scrollTrigger: { trigger: img, start: "top 85%", toggleActions: "play none none reverse" } }
        );
        ScrollTrigger.create({
            trigger: img,
            start: "bottom 20%",
            end: "bottom top",
            onEnter: () => gsap.to(img, { opacity: 0.3, scale: 1.04, duration: 0.8, ease: "power2.inOut" }),
            onLeaveBack: () => gsap.to(img, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" })
        });
    });

    // Specialties heading: entrance
    const specHeading = document.querySelector('.specialties-heading');
    if (specHeading) {
        const fromVars = (y) => ({ opacity: 0, y });
        const toVars   = (y, dur, ease) => ({ opacity: 1, y: 0, duration: dur, ease: ease || 'power3.out', clearProps: 'transform,opacity' });
        const tl = gsap.timeline({
            scrollTrigger: { trigger: specHeading, start: 'top 80%', once: true }
        });
        tl.fromTo('.specialties-count',   fromVars(16), { ...toVars(0, 0.6) })
          .fromTo('.specialties-heading', fromVars(20), { ...toVars(0, 0.7) }, '-=0.35')
          .fromTo('.specialties-sub',     fromVars(14), { ...toVars(0, 0.6) }, '-=0.3')
          .fromTo('.specialties-cta',     fromVars(10), { ...toVars(0, 0.5) }, '-=0.25');
    }

    // Specialty cards: staggered fade-in from bottom
    gsap.utils.toArray('.specialty-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.7, delay: i * 0.1,
              ease: "power3.out", clearProps: 'transform,opacity',
              scrollTrigger: { trigger: card, start: "top 85%", once: true } }
        );
    });

    // Philosophy section: GSAP word-by-word scrubbing text reveal
    const philosophyEl = document.querySelector('#philosophy-text');
    if (philosophyEl) {
        const text = philosophyEl.textContent;
        const words = text.split(' ');
        philosophyEl.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
        const wordEls = philosophyEl.querySelectorAll('.word');
        gsap.to(wordEls, {
            opacity: 1,
            stagger: 0.04,
            ease: "none",
            scrollTrigger: {
                trigger: philosophyEl,
                start: "top 75%",
                end: "bottom 40%",
                scrub: 1.5
            }
        });
    }

    // Stats counter animation
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    statNumbers.forEach(el => {
        ScrollTrigger.create({
            trigger: el,
            start: "top 85%",
            once: true,
            onEnter: () => {
                const target = parseInt(el.dataset.target);
                const suffix = el.dataset.suffix || '';
                gsap.to({ val: 0 }, {
                    val: target,
                    duration: 2,
                    ease: "power2.out",
                    onUpdate: function() { el.textContent = Math.ceil(this.targets()[0].val) + suffix; }
                });
            }
        });
    });

    // FAQ Accordion (pure CSS grid-template-rows, no layout reflow)
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', () => {
            const isOpen = question.classList.contains('active');
            document.querySelectorAll('.faq-question.active').forEach(q => q.classList.remove('active'));
            if (!isOpen) question.classList.add('active');
        });
    });

    // Before/After Slider
    const baSlider = document.querySelector('.ba-slider');
    if (baSlider) {
        const afterImage = baSlider.querySelector('.ba-image-after');
        const handle = baSlider.querySelector('.ba-handle');
        let rect = baSlider.getBoundingClientRect();
        window.addEventListener('resize', () => { rect = baSlider.getBoundingClientRect(); });
        const moveSlider = (e) => {
            let pageX = e.pageX || (e.touches && e.touches[0].pageX);
            let x = Math.max(0, Math.min(pageX - rect.left - window.scrollX, rect.width));
            const pct = (x / rect.width) * 100;
            afterImage.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
            handle.style.left = `${pct}%`;
        };
        baSlider.addEventListener('mousemove', moveSlider);
        baSlider.addEventListener('touchstart', () => { rect = baSlider.getBoundingClientRect(); });
        baSlider.addEventListener('touchmove', (e) => { moveSlider(e); e.preventDefault(); }, { passive: false });
    }

    // Magnetic Buttons — getBoundingClientRect only on mouseenter (once per hover),
    // not on every mousemove to avoid forced synchronous layout per pixel.
    if (!isTouch) {
        document.querySelectorAll('.btn, .social-icon-btn, .logo img').forEach(btn => {
            const xTo = gsap.quickTo(btn, 'x', { duration: 0.3, ease: 'power2.out' });
            const yTo = gsap.quickTo(btn, 'y', { duration: 0.3, ease: 'power2.out' });
            let r = { left: 0, top: 0, width: 0, height: 0 };
            btn.addEventListener('mouseenter', () => { r = btn.getBoundingClientRect(); });
            btn.addEventListener('mousemove', (e) => {
                xTo((e.clientX - r.left - r.width / 2) * 0.28);
                yTo((e.clientY - r.top - r.height / 2) * 0.28);
            });
            btn.addEventListener('mouseleave', () => {
                gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
            });
        });
    }

    // Contact Form (WhatsApp)
    const contactForm = document.getElementById('premium-contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-name').value;
            const treatment = document.getElementById('contact-treatment').value;
            const message = document.getElementById('contact-message').value;
            const btn = contactForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Redirigiendo a WhatsApp...';
            btn.disabled = true;
            let text = `Hola *Esteti'Kas*, mi nombre es *${name}*.\n\nMe interesa el tratamiento: *${treatment.toUpperCase()}*.`;
            if (message) text += `\n\nMensaje adicional: ${message}`;
            text += `\n\n_Enviado desde el sitio web._`;
            setTimeout(() => {
                window.open(`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`, '_blank');
                btn.innerText = '¡Solicitud Abierta!';
                btn.style.backgroundColor = '#28a745';
                btn.style.borderColor = '#28a745';
                contactForm.reset();
                setTimeout(() => {
                    btn.innerText = originalText;
                    btn.disabled = false;
                    btn.style.backgroundColor = '';
                    btn.style.borderColor = '';
                }, 3000);
            }, 800);
        });
    }

    // Parallax hero image
    if (document.querySelector('.hero-image-wrap')) {
        gsap.to(".hero-image", {
            scrollTrigger: { trigger: ".hero", start: "top top", scrub: true },
            y: 60, ease: "none"
        });
    }

    // Custom Select
    const customSelect = document.querySelector('.custom-select-wrapper');
    if (customSelect) {
        const trigger = customSelect.querySelector('.custom-select-trigger');
        const options = customSelect.querySelectorAll('.custom-option');
        const realSelect = document.getElementById('contact-treatment');
        trigger.addEventListener('click', () => customSelect.classList.toggle('open'));
        options.forEach(option => {
            option.addEventListener('click', () => {
                const value = option.getAttribute('data-value');
                trigger.querySelector('span').innerText = option.innerText;
                realSelect.value = value;
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                customSelect.classList.remove('open');
            });
        });
        document.addEventListener('click', (e) => { if (!customSelect.contains(e.target)) customSelect.classList.remove('open'); });
    }

    // Care Slider
    const careSlides = document.querySelectorAll('.care-slide');
    const careDots = document.querySelectorAll('.care-dot');
    if (careSlides.length > 0) {
        let current = 0;
        function showSlide(index) {
            careSlides.forEach(s => s.classList.remove('active'));
            careDots.forEach(d => { d.classList.remove('active'); d.setAttribute('aria-selected', 'false'); });
            careSlides[index].classList.add('active');
            if (careDots[index]) { careDots[index].classList.add('active'); careDots[index].setAttribute('aria-selected', 'true'); }
            current = index;
        }
        let timer = setInterval(() => showSlide((current + 1) % careSlides.length), 10000);
        careDots.forEach((dot, i) => {
            dot.addEventListener('click', () => { clearInterval(timer); showSlide(i); timer = setInterval(() => showSlide((current + 1) % careSlides.length), 10000); });
        });
    }

    // Reserve buttons on tratamientos page
    document.querySelectorAll('.reserve-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            addToCart(id, name);
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Agregado`;
            btn.classList.add('reserved');
        });
    });
};

// Expose needed functions globally for inline onclick handlers
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;

initSite();
document.addEventListener('astro:after-swap', initSite);
