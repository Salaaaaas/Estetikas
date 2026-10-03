// Genera api/_lib/catalogo.mjs (slug → nombre del carrito) desde
// src/content/tratamientos/*.md. create-booking usa ese mapa para rechazar
// slugs desconocidos y para que el nombre del servicio lo ponga el servidor,
// no el navegador. Correr tras agregar o renombrar un tratamiento:
//   node scripts/build-catalogo.mjs
// `npm test` falla si el archivo generado quedó desactualizado.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = `${root}src/content/tratamientos`;

export function construirCatalogo() {
  const map = {};
  for (const f of readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
    const slug = f.slice(0, -3);
    const m = /^cartName:\s*"(.+)"\s*$/m.exec(readFileSync(`${dir}/${f}`, 'utf8'));
    if (!m) throw new Error(`${f}: falta cartName`);
    map[slug] = m[1];
  }
  return map;
}

export function renderCatalogo(map) {
  return `// GENERADO por scripts/build-catalogo.mjs — no editar a mano.\n` +
    `export const CATALOGO = Object.freeze(${JSON.stringify(map, null, 2)});\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(`${root}api/_lib/catalogo.mjs`, renderCatalogo(construirCatalogo()));
  console.log('api/_lib/catalogo.mjs actualizado');
}
