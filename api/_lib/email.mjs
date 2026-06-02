import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Esteti\'Kas <onboarding@resend.dev>';

function formatFecha(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-CR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatHora(hora24) {
  const [h, m] = hora24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12    = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export async function sendReminderEmail({ to, nombre, fecha, hora, sede, servicios }) {
  const fechaFormateada = formatFecha(fecha);
  const horaFormateada  = formatHora(hora);
  const serviciosStr    = Array.isArray(servicios) ? servicios.join(', ') : servicios;

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f7f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <tr>
          <td style="background:#1a1a1a;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;color:#c9a96e;letter-spacing:4px;font-style:italic;">Esteti'Kas</p>
            <p style="margin:6px 0 0;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase;">Clínica Estética</p>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 40px 0;">
            <p style="margin:0;font-size:14px;color:#888;letter-spacing:1px;text-transform:uppercase;">Recordatorio de cita</p>
            <h1 style="margin:8px 0 0;font-size:26px;color:#1a1a1a;font-weight:400;">Hola, ${nombre}</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 40px;">
            <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
              Te recordamos que tienes una cita programada para <strong>mañana</strong>. ¡Te esperamos!
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f5;border-radius:8px;padding:24px;">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #ece9e4;">
                  <p style="margin:0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">Fecha</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;text-transform:capitalize;">${fechaFormateada}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #ece9e4;">
                  <p style="margin:0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">Hora</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;">${horaFormateada}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #ece9e4;">
                  <p style="margin:0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">Sede</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;">${sede}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 0;">
                  <p style="margin:0;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px;">Servicios</p>
                  <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a;">${serviciosStr}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0;font-size:14px;color:#666;line-height:1.7;">
              Si necesitas reprogramar o cancelar tu cita, contáctanos con anticipación.<br>
              ¡Nos vemos mañana!
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f9f7f5;padding:24px 40px;text-align:center;border-top:1px solid #ece9e4;">
            <p style="margin:0;font-size:12px;color:#aaa;">Esteti'Kas — Clínica Estética</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return resend.emails.send({
    from:    FROM,
    to,
    subject: `Recordatorio: Tu cita en Esteti'Kas es mañana — ${horaFormateada}`,
    html,
  });
}
