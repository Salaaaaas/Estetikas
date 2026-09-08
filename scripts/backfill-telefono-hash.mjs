/**
 * Rellena citas.telefono_hash en las filas que aún no lo tienen.
 *
 * Ejecutar UNA VEZ después de correr supabase/schema_mobile.sql:
 *
 *   node --env-file=.env scripts/backfill-telefono-hash.mjs
 *
 * Y volver a ejecutarlo si alguna vez cambia normalizePhoneE164 en
 * api/_lib/validate.mjs: los teléfonos siguen siendo descifrables, así que el
 * hash siempre se puede recalcular sin perder nada.
 *
 * Es idempotente y seguro de reintentar: solo toca filas con telefono_hash
 * nulo y nunca modifica telefono_enc. Pasar --dry para ver qué haría sin
 * escribir.
 *
 * Requiere en el entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * PII_ENCRYPTION_KEY y PHONE_HASH_PEPPER.
 */

import { supabase } from '../api/_lib/supabase.mjs';
import { decryptPII, hashPhone } from '../api/_lib/crypto.mjs';
import { normalizePhoneE164 } from '../api/_lib/validate.mjs';

const DRY = process.argv.includes('--dry');
const PAGE = 200;

async function main() {
  // Falla temprano si falta el pepper, antes de leer nada de la BD.
  hashPhone('+50600000000');

  let procesadas = 0;
  let actualizadas = 0;
  let fallidas = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('citas')
      .select('id, telefono_enc')
      .is('telefono_hash', null)
      .order('created_at', { ascending: true })
      .limit(PAGE);

    if (error) throw new Error('select_error: ' + JSON.stringify(error));
    if (!data || data.length === 0) break;

    for (const row of data) {
      procesadas++;
      let hash;
      try {
        const telefono = decryptPII(row.telefono_enc);
        const e164 = normalizePhoneE164(telefono);
        if (!e164) throw new Error('teléfono vacío tras normalizar');
        hash = hashPhone(e164);
      } catch (err) {
        // Una fila ilegible no debe abortar el backfill de las demás; se
        // reporta para revisarla a mano.
        fallidas++;
        console.error(`  cita ${row.id}: ${err.message}`);
        continue;
      }

      if (DRY) {
        actualizadas++;
        continue;
      }

      const { error: upErr } = await supabase
        .from('citas')
        .update({ telefono_hash: hash })
        .eq('id', row.id);

      if (upErr) {
        fallidas++;
        console.error(`  cita ${row.id}: update falló — ${upErr.message}`);
      } else {
        actualizadas++;
      }
    }

    // En modo --dry no se escribe nada, así que la misma página volvería a
    // salir en la siguiente consulta y el bucle no terminaría nunca.
    if (DRY) {
      console.log(`  (--dry) primera página de ${data.length} filas; no se consultan más`);
      break;
    }
  }

  console.log(
    `${DRY ? '[simulación] ' : ''}procesadas ${procesadas} · actualizadas ${actualizadas} · fallidas ${fallidas}`
  );
  if (fallidas > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.stack ?? String(err));
  process.exit(1);
});
