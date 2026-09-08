// Backfill de citas.telefono_hash, ejecutado dentro de Vercel.
//
// Existe porque PII_ENCRYPTION_KEY está marcada como sensible en Vercel y no se
// puede volver a leer: no hay forma de correr el backfill local sin bajar la
// clave de cifrado de producción a una máquina de trabajo, que además de
// incómodo es peor idea. Aquí la clave ya está en el entorno de ejecución y
// nunca sale de él.
//
// Uso (una sola vez tras aplicar supabase/schema_mobile.sql):
//
//   curl -X POST https://estetikas.vercel.app/api/admin/backfill-telefono-hash \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// Añadir ?dry=1 para ver el conteo sin escribir nada.
//
// Es idempotente: solo toca filas con telefono_hash nulo y nunca modifica
// telefono_enc. Se puede reintentar sin miedo, y volver a llamarlo si algún día
// cambia normalizePhoneE164 (haría falta poner los hashes a null antes).

import { supabase } from '../_lib/supabase.mjs';
import { decryptPII, hashPhone } from '../_lib/crypto.mjs';
import { normalizePhoneE164 } from '../_lib/validate.mjs';
import { audit } from '../_lib/security.mjs';

// Tope por invocación para no acercarse al límite de tiempo de la función.
// Si quedan filas, la respuesta lo dice y basta con volver a llamar.
const MAX_POR_LLAMADA = 500;

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const secret = process.env.CRON_SECRET;
  if (!secret) return send(res, 500, { error: 'cron_secret_no_configurado' });
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return send(res, 401, { error: 'unauthorized' });
  }

  const dry = new URL(req.url, 'https://placeholder.local').searchParams.get('dry') === '1';

  // Falla temprano y con un mensaje claro si falta el pepper, antes de leer PII.
  try {
    hashPhone('+50600000000');
  } catch (err) {
    return send(res, 500, { error: 'phone_hash_pepper_ausente', mensaje: err.message });
  }

  const { data, error } = await supabase
    .from('citas')
    .select('id, telefono_enc')
    .is('telefono_hash', null)
    .order('created_at', { ascending: true })
    .limit(MAX_POR_LLAMADA);

  if (error) {
    console.error('backfill_select_error', JSON.stringify(error));
    return send(res, 500, { error: 'error_interno' });
  }

  let actualizadas = 0;
  const fallidas = [];

  for (const row of data ?? []) {
    let hash;
    try {
      const e164 = normalizePhoneE164(decryptPII(row.telefono_enc));
      if (!e164) throw new Error('teléfono vacío tras normalizar');
      hash = hashPhone(e164);
    } catch (err) {
      // Una fila ilegible no debe abortar el resto; se reporta para revisarla.
      fallidas.push({ id: row.id, motivo: err.message });
      continue;
    }

    if (dry) {
      actualizadas++;
      continue;
    }

    const { error: upErr } = await supabase
      .from('citas')
      .update({ telefono_hash: hash })
      .eq('id', row.id);

    if (upErr) fallidas.push({ id: row.id, motivo: upErr.message });
    else actualizadas++;
  }

  const { count: restantes } = await supabase
    .from('citas')
    .select('id', { count: 'exact', head: true })
    .is('telefono_hash', null);

  if (!dry) {
    await audit({
      actor: 'admin',
      action: 'backfill_telefono_hash',
      metadata: { actualizadas, fallidas: fallidas.length, restantes },
    });
  }

  return send(res, 200, {
    ok: true,
    dry,
    encontradas: data?.length ?? 0,
    actualizadas,
    fallidas,
    restantes,
    // En dry-run `restantes` no baja: no se escribió nada.
    completo: dry ? null : restantes === 0,
  });
}
