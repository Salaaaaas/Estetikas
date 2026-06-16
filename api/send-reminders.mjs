import { supabase } from './_lib/supabase.mjs';
import { decryptPII } from './_lib/crypto.mjs';
import { sendReminderEmail } from './_lib/email.mjs';

function getTomorrowStr() {
  // "Mañana" según la zona horaria de Costa Rica (UTC-6, sin horario de verano),
  // no según UTC. Usar toISOString() haría que, después de las 18:00 hora local,
  // el cron tratara el día siguiente como dos días adelante.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  // Fecha/hora actual en Costa Rica → sumamos 1 día sobre el calendario local.
  const todayCR = fmt.format(new Date());              // "YYYY-MM-DD"
  const [y, m, d] = todayCR.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  return fmt.format(tomorrow);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  // Protección simple: solo Vercel Cron puede llamar esto
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const tomorrow = getTomorrowStr();

  const { data: citas, error } = await supabase
    .from('citas')
    .select('id, nombre, email_enc, servicios, sede, fecha, hora, estado')
    .eq('fecha', tomorrow)
    .neq('estado', 'cancelada')
    .not('email_enc', 'is', null);

  if (error) {
    console.error('reminder_fetch_error', error);
    res.status(500).json({ error: 'error_interno' });
    return;
  }

  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const cita of citas) {
    try {
      const email = decryptPII(cita.email_enc);
      if (!email) { results.skipped++; continue; }

      const serviciosStr = Array.isArray(cita.servicios)
        ? cita.servicios.map(s => s.name || s.nombre || s.slug).join(', ')
        : String(cita.servicios);

      await sendReminderEmail({
        to:        email,
        nombre:    cita.nombre,
        fecha:     cita.fecha,
        hora:      cita.hora,
        sede:      cita.sede,
        servicios: serviciosStr,
      });

      results.sent++;
      console.log('reminder_sent', { id: cita.id });
    } catch (err) {
      results.errors++;
      console.error('reminder_error', { id: cita.id, message: err?.message });
    }
  }

  res.status(200).json({ ok: true, tomorrow, ...results });
}
