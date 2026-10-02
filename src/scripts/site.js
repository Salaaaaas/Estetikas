import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { getCart, removeFromCart, clearCart, showToast } from '../lib/cart';

gsap.registerPlugin(ScrollTrigger);


// =====================================================
// CART / BOOKING SYSTEM
// =====================================================
// Carrito y aviso: src/lib/cart.ts; botones flotantes: FloatingActions.tsx

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

function renderReservarItems() {
    const section = document.getElementById('reservar-items-section');
    if (!section) return;
    const cart = getCart();

    if (cart.length === 0) {
        section.innerHTML = `
            <div class="reservar-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="1.25" opacity="0.5">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 01-8 0"/>
                </svg>
                <p>Tu lista de tratamientos está vacía.</p>
                <a href="/tratamientos" class="btn" style="font-size:0.82rem; padding:0.65rem 1.4rem; margin-top:0.25rem">Explorar tratamientos</a>
            </div>
        `;
        return;
    }

    section.innerHTML = `
        <section class="reservar-section reservar-items-section">
            <h2 class="reservar-section-title">Tratamientos seleccionados <span class="reservar-count">(${cart.length})</span></h2>
            <ul class="reservar-items-list">
                ${cart.map(item => `
                    <li class="reservar-item-row">
                        <span class="reservar-item-check" aria-hidden="true">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <span class="reservar-item-name">${item.name}</span>
                        <button type="button" class="reservar-item-del" data-id="${item.id}" aria-label="Eliminar ${item.name}">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </li>
                `).join('')}
            </ul>
        </section>
    `;

    section.querySelectorAll('.reservar-item-del').forEach(btn => {
        btn.addEventListener('click', () => { removeFromCart(btn.dataset.id); renderReservarItems(); });
    });
}

let _lenis = null;

// ---- SCHEDULE DATA ----
// Weekly recurring slots are hardcoded here.
// Date-specific slots (Dra. days, special sessions) are fetched live from
// Google Calendar via /api/get-schedule and merged in initReservarPage.
const SCHEDULE_WEEKLY = [
    {
        id:       'limpiezas-sem',
        type:     'weekly',
        weekdays: [2, 3, 4, 5],           // Tue=2, Wed=3, Thu=4, Fri=5
        hours:    '5:30 PM – 7:30 PM',
        label:    'Limpiezas Faciales',
        forIds:   ['limpieza-facial'],
    },
];

// One-off dates when Dra. Karen is available (treatments requiring a doctor).
//
// CÓMO HABILITAR UN DÍA DE LA DRA. EN BATAAN (o Guápiles), SIN TOCAR CÓDIGO:
// crear en el Google Calendar de la clínica un evento con horario (no de día
// completo) cuyo campo "Ubicación" contenga "Bataan", "Guápiles" o
// "Eco Clinic". /api/get-schedule lo publica automáticamente, el calendario
// de reservas habilita esa fecha para todos los tratamientos y el formulario
// fija la sede a la del evento. El backend revalida contra el mismo
// calendario, así que no hay que hacer deploy. Las entradas de abajo son el
// mecanismo alternativo hardcodeado.
const SCHEDULE_DATES = [
    {
        id:     'dra-karen-2026-07-18',
        type:   'date',
        date:   '2026-07-18',
        hours:  '8:00 AM – 5:00 PM',
        label:  'Dra. Karen — Medicina Estética',
        forIds: [
            'botox', 'bioestimuladores-colageno', 'depilacion',
            'dermaplaning-dermapen', 'eliminacion-lunares-verrugas',
            'enzimas-doble-menton', 'exosomas-polinucleotidos',
            'mesoterapia', 'peelings', 'reduccion',
            'rejuvenecimiento-facial-integral', 'rellenos',
            'sueroterapia', 'tratamiento-estrias',
        ],
        sede:   'Bataan (Clínica ODONTOBATAAN)',
    },
];

let SCHEDULE = [...SCHEDULE_WEEKLY, ...SCHEDULE_DATES];

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
        if (s.forIds.includes('*')) return true;
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

// ---- REGLAS DE SEDE ----
// Katherine (limpiezas faciales) atiende en una sola sede por día: la
// primera reserva con limpieza fija la sede de limpiezas de esa fecha.
// La Dra. Karen (medicina estética) atiende en la sede de su bloque del
// día (Guápiles normalmente; Bataan solo en fechas especiales del
// calendario). La sede del formulario se restringe según la fecha elegida.
const LIMPIEZA_ID = 'limpieza-facial';
let _sedeLockCache = {}; // dateStr → sede anclada de limpiezas (o null)

function sedeLabel(value) {
    const opt = [...(document.getElementById('b-sede')?.options ?? [])]
        .find(o => o.value === value);
    return opt ? opt.textContent.trim() : value;
}

function sessionCoversOtros(s, otros) {
    return s.forIds.includes('*') || otros.some(id => s.forIds.includes(id));
}

function sessionsForSede(sessions) {
    const sede = document.getElementById('b-sede')?.value || '';
    if (!sede) return sessions;
    return sessions.filter(s => !s.sede || s.sede === sede);
}

async function fetchLimpiezaSede(dateStr) {
    if (dateStr in _sedeLockCache) return _sedeLockCache[dateStr];
    try {
        const res  = await fetch(`/api/sede-for-date?date=${dateStr}`);
        const data = await res.json();
        _sedeLockCache[dateStr] = data.sede ?? null;
    } catch {
        _sedeLockCache[dateStr] = null;
    }
    return _sedeLockCache[dateStr];
}

async function updateSedeForDate(dateStr, sessions) {
    const sel  = document.getElementById('b-sede');
    const hint = document.getElementById('b-sede-hint');
    if (!sel) return;
    const allSedes = [...sel.options].map(o => o.value).filter(Boolean);

    const cartIds  = getCart().map(i => i.id);
    const otros    = cartIds.filter(id => id !== LIMPIEZA_ID);
    const hasLimpieza = cartIds.includes(LIMPIEZA_ID);

    let allowed;
    let hintText = '';

    if (otros.length > 0) {
        // Medicina estética: solo las sedes de los bloques del día que
        // cubren esos tratamientos (los bloques de la Dra. traen sede).
        allowed = new Set(
            sessions.filter(s => s.sede && sessionCoversOtros(s, otros)).map(s => s.sede)
        );
        if (allowed.size === 1) {
            hintText = `Este día los tratamientos se atienden en ${sedeLabel([...allowed][0])}.`;
        }
    } else {
        // Solo limpiezas: sesiones con sede fija la imponen; las semanales
        // (sin sede) dejan elegir cualquiera.
        allowed = new Set();
        sessions.forEach(s => { if (s.sede) allowed.add(s.sede); });
        if (sessions.some(s => !s.sede)) allSedes.forEach(x => allowed.add(x));
    }

    // Candado de limpiezas: si ya hay una limpieza ese día, su sede manda.
    if (hasLimpieza && allowed.size > 0) {
        const locked = await fetchLimpiezaSede(dateStr);
        if (locked) {
            allowed = new Set(allowed.has(locked) ? [locked] : []);
            if (allowed.size === 1) {
                hintText = `Este día las limpiezas faciales se atienden en ${sedeLabel(locked)}.`;
            }
        }
    }

    if (allowed.size === 0) {
        hintText = 'No hay sede disponible para tus tratamientos en esta fecha. Por favor elige otro día.';
    }

    [...sel.options].forEach(o => { if (o.value) o.disabled = !allowed.has(o.value); });
    if (sel.value && !allowed.has(sel.value)) sel.value = '';
    if (allowed.size === 1) sel.value = [...allowed][0];

    if (hint) {
        hint.textContent = hintText;
        hint.hidden = !hintText;
    }
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
        btn.addEventListener('click', async () => {
            const dateStr = btn.dataset.date;
            _calState.selected = dateStr;
            document.getElementById('b-date').value = dateStr;
            updateCalendarSelection(dateStr);
            const sessions = getSessionsForDate(dateStr, schedules);
            await updateSedeForDate(dateStr, sessions);
            updateSessionSelect(sessionsForSede(sessions), dateStr);
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

// =====================================================
// /reservar page init — runs once when DOM is ready on that route
// =====================================================
async function initReservarPage() {
    if (!document.getElementById('booking-form')) return;
    renderReservarItems();
    _calState = { year: null, month: null, selected: null, fullDays: new Set() };
    _availCache = {};
    _sedeLockCache = {};

    // Al cambiar de sede se refrescan los horarios: los bloques con sede
    // fija (días de la Dra.) solo aplican a su propia sede.
    document.getElementById('b-sede')?.addEventListener('change', () => {
        if (!_calState.selected) return;
        const schedules = getApplicableSchedules(getCart().map(i => i.id));
        const sessions  = getSessionsForDate(_calState.selected, schedules);
        updateSessionSelect(sessionsForSede(sessions), _calState.selected);
    });

    // Render immediately with weekly + hardcoded date slots so the calendar isn't blank
    SCHEDULE = [...SCHEDULE_WEEKLY, ...SCHEDULE_DATES];
    renderCalendar();
    renderTurnstile();
    document.getElementById('booking-form').addEventListener('submit', submitBooking);

    // Fetch date-specific slots from Google Calendar and re-render
    try {
        const res  = await fetch('/api/get-schedule');
        const data = await res.json();
        if (Array.isArray(data.schedule) && data.schedule.length > 0) {
            SCHEDULE = [...SCHEDULE_WEEKLY, ...SCHEDULE_DATES, ...data.schedule];
            _calState.fullDays = new Set();
            renderCalendar();
        }
    } catch {}
}

function showReservarSuccess() {
    const form = document.getElementById('booking-form');
    const items = document.getElementById('reservar-items-section');
    const success = document.getElementById('reservar-success');
    if (form) form.hidden = true;
    if (items) items.hidden = true;
    if (success) {
        success.hidden = false;
        success.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    const btn = document.getElementById('reservar-submit-btn');
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
            } else if (res.status === 409) {
                showToast(data.mensaje || 'Ese horario acaba de ser reservado. Elige otra hora.');
            } else if (res.status === 400 && data.mensaje) {
                showToast(data.mensaje);
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
        e.target.reset();
        if (window.turnstile && turnstileWidgetId !== null) {
            window.turnstile.reset(turnstileWidgetId);
        }
        showReservarSuccess();
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

// =====================================================
// MAIN SITE INIT
// =====================================================
const initSite = () => {
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // /reservar page: render cart items, calendar, captcha, bind submit
    initReservarPage();

    // "Volver" link on /reservar: go back if there is history, else home
    document.querySelectorAll('[data-back]').forEach(el => {
        el.addEventListener('click', (e) => {
            if (window.history.length > 1) { e.preventDefault(); window.history.back(); }
        });
    });

    if (isTouch) {
        document.body.classList.add('is-touch');
    }

    // Smooth Scroll (Lenis) — desktop only. On touch devices native scroll is
    // faster and avoids fighting the browser's own momentum scrolling.
    if (!isTouch && !reduceMotion) {
        _lenis = new Lenis({
            duration: 1.1,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        });
        _lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => { _lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
    }

    // Internal anchor scroll
    document.querySelectorAll('nav a, .service-link, a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (!href || !href.startsWith('#')) return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            if (_lenis) {
                _lenis.scrollTo(target, { offset: -80, duration: 1.5 });
            } else {
                const top = target.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
        });
    });

    // Reveal animations — content is visible by default (no CSS opacity:0), so
    // nothing ships hidden if JS fails. GSAP hides right before animating.
    const revealTargets = ".service-card, .faq-item, .before-after-container, .testimonial-featured, .testimonial-card-compact, .contact-info, .contact-form-wrapper, .treatment-detail-block, .trust-item, .t-card";
    // Solo se oculta lo que está bajo el pliegue: lo visible al cargar no parpadea
    const belowFold = gsap.utils.toArray(revealTargets)
        .filter(el => el.getBoundingClientRect().top > window.innerHeight);
    if (!reduceMotion && belowFold.length) {
        gsap.set(belowFold, { opacity: 0, y: 30, willChange: 'transform, opacity' });
        ScrollTrigger.batch(belowFold, {
            start: "top 88%",
            onEnter: batch => gsap.to(batch, {
                opacity: 1, y: 0, stagger: 0.08, duration: 0.65, ease: "power3.out", overwrite: true,
                onComplete() { batch.forEach(el => { el.style.willChange = 'auto'; }); }
            }),
            once: true
        });
    }

    // Hero entrance — staggered editorial reveal
    if (!reduceMotion && document.querySelector('.hero-display')) {
        const heroLines = gsap.utils.toArray('.hero-display em, .hero-display span');
        gsap.from('.hero-eyemark', { opacity: 0, scaleX: 0, transformOrigin: 'left center', duration: 0.5, delay: 0.05, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from(heroLines, { opacity: 0, y: 40, duration: 0.9, stagger: 0.12, delay: 0.15, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from('.hero-bottom', { opacity: 0, y: 24, duration: 0.8, delay: 0.6, ease: "power3.out", clearProps: 'transform,opacity' });
        gsap.from('.hero-image-wrap', { opacity: 0, scale: 0.95, duration: 1.6, delay: 0.1, ease: "expo.out", clearProps: 'transform,opacity' });
    }

    // Staff intro: heading + description entrance
    const staffIntro = !reduceMotion && document.querySelector('.staff-intro');
    if (staffIntro) {
        const tl = gsap.timeline({
            scrollTrigger: { trigger: staffIntro, start: 'top 80%', once: true }
        });
        tl.fromTo('.staff-intro-heading', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', clearProps: 'transform,opacity' })
          .fromTo('.staff-intro-copy p',  { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', clearProps: 'transform,opacity' }, '-=0.4');
    }

    // Profile content sides: slide in from the appropriate direction
    if (!reduceMotion) gsap.utils.toArray('.profile-block').forEach((block, i) => {
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

    // Profile images: entrada única (sin oscurecer al salir del viewport)
    if (!reduceMotion) gsap.utils.toArray('.profile-image-side img').forEach(img => {
        gsap.fromTo(img,
            { scale: 0.94, opacity: 0 },
            { scale: 1, opacity: 1, duration: 1.1, ease: "power3.out", clearProps: 'transform,opacity',
              scrollTrigger: { trigger: img, start: "top 85%", once: true } }
        );
    });

    // Specialties heading: entrance
    const specHeading = !reduceMotion && document.querySelector('.specialties-heading');
    if (specHeading) {
        const fromVars = (y) => ({ opacity: 0, y });
        const toVars   = (y, dur, ease) => ({ opacity: 1, y: 0, duration: dur, ease: ease || 'power3.out', clearProps: 'transform,opacity' });
        const tl = gsap.timeline({
            scrollTrigger: { trigger: specHeading, start: 'top 80%', once: true }
        });
        tl.fromTo('.specialties-heading', fromVars(20), { ...toVars(0, 0.7) })
          .fromTo('.specialties-sub',     fromVars(14), { ...toVars(0, 0.6) }, '-=0.3')
          .fromTo('.specialties-cta',     fromVars(10), { ...toVars(0, 0.5) }, '-=0.25');
    }

    // Specialty cards: staggered fade-in from bottom
    if (!reduceMotion) gsap.utils.toArray('.specialty-card').forEach((card, i) => {
        gsap.fromTo(card,
            { opacity: 0, y: 40 },
            { opacity: 1, y: 0, duration: 0.7, delay: i * 0.1,
              ease: "power3.out", clearProps: 'transform,opacity',
              scrollTrigger: { trigger: card, start: "top 85%", once: true } }
        );
    });

    // Philosophy section: GSAP word-by-word scrubbing text reveal
    const philosophyEl = !reduceMotion && document.querySelector('#philosophy-text');
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

    // Respaldo de los reveals: si un elemento sigue invisible 2 s después de
    // entrar al viewport (scroll muy rápido, resize, render headless), se muestra.
    if (!reduceMotion && 'IntersectionObserver' in window) {
        const guarded = revealTargets + ", .profile-content-side, .profile-image-side img, .specialty-card, .staff-intro-heading, .staff-intro-copy p, .specialties-heading, .specialties-sub, .specialties-cta";
        const guard = new IntersectionObserver((entries) => {
            entries.forEach(({ isIntersecting, target }) => {
                if (!isIntersecting) return;
                guard.unobserve(target);
                setTimeout(() => {
                    if (parseFloat(getComputedStyle(target).opacity) < 1) {
                        gsap.to(target, { opacity: 1, x: 0, y: 0, scale: 1, duration: 0.4, overwrite: true, clearProps: 'transform,opacity' });
                    }
                }, 2000);
            });
        });
        document.querySelectorAll(guarded).forEach(el => guard.observe(el));
    }

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

    // Parallax hero image
    if (!reduceMotion && document.querySelector('.hero-image-wrap')) {
        gsap.to(".hero-image", {
            scrollTrigger: { trigger: ".hero", start: "top top", scrub: true },
            y: 60, ease: "none"
        });
    }

};

initSite();
document.addEventListener('astro:after-swap', initSite);
