import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TreatmentOption } from '../../data/home';
import { WA_PHONE } from '../../data/clinic';

interface ContactFormProps {
  treatments: TreatmentOption[];
}

type Status = 'idle' | 'sending' | 'sent';

const fieldClass = [
  'w-full px-[1.2rem] py-4 rounded-2xl text-[1rem] leading-[normal] text-white font-body',
  'bg-white/8 border border-white/25 shadow-[0_4px_15px_rgba(0,0,0,0.05)]',
  'placeholder:text-white/68 placeholder:opacity-100',
  'transition-[background-color,border-color,box-shadow] duration-[220ms] ease-out',
  'focus:outline-2 focus:outline-offset-2 focus:outline-primary-on-dark focus:border-white/70 focus:bg-white/14',
].join(' ');

const LABELS: Record<Status, string> = {
  idle: 'Enviar por WhatsApp',
  sending: 'Redirigiendo a WhatsApp...',
  sent: '¡Solicitud Abierta!',
};

// Arma el mensaje y abre WhatsApp; no envía datos a ningún servidor.
export default function ContactForm({ treatments }: ContactFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '');
    const select = form.elements.namedItem('treatment') as HTMLSelectElement;
    const treatment = select.selectedOptions[0]?.textContent?.trim() || 'Consulta general';
    const message = String(data.get('message') ?? '');

    let text = `Hola *Esteti'Kas*, mi nombre es *${name}*.\n\nMe interesa el tratamiento: *${treatment}*.`;
    if (message) text += `\n\nMensaje adicional: ${message}`;
    text += `\n\n_Enviado desde el sitio web._`;

    setStatus('sending');
    timers.current.push(
      window.setTimeout(() => {
        window.open(`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(text)}`, '_blank');
        setStatus('sent');
        form.reset();
        timers.current.push(window.setTimeout(() => setStatus('idle'), 3000));
      }, 800),
    );
  };

  return (
    <form id="premium-contact-form" onSubmit={onSubmit}>
      <div>
        <label htmlFor="contact-name">Nombre Completo</label>
        <input type="text" id="contact-name" name="name" placeholder="Tu nombre" required className={fieldClass} />
      </div>
      <div>
        <label htmlFor="contact-treatment">Tratamiento de Interés</label>
        <div className="relative">
          <select
            id="contact-treatment"
            name="treatment"
            required
            defaultValue=""
            className={`${fieldClass} appearance-none pr-[2.8rem] cursor-pointer invalid:text-white/65 [&>option]:text-body [&>option]:bg-white`}
          >
            <option value="" disabled>Selecciona un tratamiento</option>
            {treatments.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-[1.1rem] top-1/2 size-[0.7rem] -translate-y-1/2 opacity-85"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      <div>
        <label htmlFor="contact-message">Mensaje</label>
        <textarea id="contact-message" name="message" placeholder="¿Cómo podemos ayudarte?" rows={4} className={fieldClass} />
      </div>
      <button
        type="submit"
        className="btn"
        disabled={status !== 'idle'}
        style={status === 'sent' ? { backgroundColor: '#1E7B34', borderColor: '#1E7B34' } : undefined}
      >
        {LABELS[status]}
      </button>
    </form>
  );
}
