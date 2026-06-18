/**
 * Endpoint temporal de diagnóstico — ELIMINAR después de confirmar que Calendar funciona.
 * GET /api/test-calendar
 */
export default async function handler(req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');

  const vars = {
    GOOGLE_CLIENT_ID:     !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN: !!process.env.GOOGLE_REFRESH_TOKEN,
    GOOGLE_CALENDAR_ID:   process.env.GOOGLE_CALENDAR_ID ?? '(no definido)',
  };

  // Intenta obtener access token
  let tokenResult;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type:    'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    tokenResult = {
      ok:    tokenRes.ok,
      status: tokenRes.status,
      has_access_token: !!tokenData.access_token,
      error: tokenData.error ?? null,
      error_description: tokenData.error_description ?? null,
    };

    // Si tenemos token, intentamos crear un evento de prueba
    if (tokenData.access_token) {
      const now = new Date();
      const start = now.toISOString();
      const end   = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      const calId = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || 'primary');
      const evRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${tokenData.access_token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            summary: '[TEST] Diagnóstico Esteti\'Kas — borrar',
            start: { dateTime: start, timeZone: 'America/Costa_Rica' },
            end:   { dateTime: end,   timeZone: 'America/Costa_Rica' },
          }),
        }
      );
      const evData = await evRes.json();
      tokenResult.calendar_test = {
        ok:     evRes.ok,
        status: evRes.status,
        event_id: evData.id ?? null,
        error:    evData.error ?? null,
      };
    }
  } catch (err) {
    tokenResult = { ok: false, error: err.message };
  }

  res.status(200).json({ vars, tokenResult });
}
