import { supabase } from './_lib/supabase.mjs';
import { decryptPII } from './_lib/crypto.mjs';
import { sendReminderEmail } from './_lib/email.mjs';

function getTomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
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
