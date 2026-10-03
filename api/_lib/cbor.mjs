// Decodificador CBOR mínimo (RFC 8949), suficiente para el objeto de
// atestación de Apple App Attest y nada más.
//
// Se implementa a mano en lugar de añadir una dependencia porque el formato
// que hay que leer está acotado: mapas con claves de texto, arrays, enteros y
// cadenas de bytes, siempre con longitud definida. Lo que Apple no emite —
// longitudes indefinidas, flotantes, big nums— se rechaza en vez de
// interpretarse a medias.

const MAJOR_UINT = 0;
const MAJOR_NEGINT = 1;
const MAJOR_BYTES = 2;
const MAJOR_TEXT = 3;
const MAJOR_ARRAY = 4;
const MAJOR_MAP = 5;
const MAJOR_TAG = 6;
const MAJOR_SIMPLE = 7;

const MAX_DEPTH = 16;

class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }

  need(n) {
    if (this.pos + n > this.buf.length) throw new Error('cbor: datos truncados');
  }

  u8() {
    this.need(1);
    return this.buf[this.pos++];
  }

  bytes(n) {
    this.need(n);
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  // Longitud / valor asociado al byte de cabecera.
  argument(info) {
    if (info < 24) return info;
    if (info === 24) return this.u8();
    if (info === 25) {
      const b = this.bytes(2);
      return b.readUInt16BE(0);
    }
    if (info === 26) {
      const b = this.bytes(4);
      return b.readUInt32BE(0);
    }
    if (info === 27) {
      const b = this.bytes(8);
      const v = b.readBigUInt64BE(0);
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('cbor: entero fuera de rango');
      return Number(v);
    }
    if (info === 31) throw new Error('cbor: longitud indefinida no soportada');
    throw new Error(`cbor: cabecera inválida (info ${info})`);
  }

  value(depth = 0) {
    // Una atestación real anida 3-4 niveles; el tope evita depender del
    // desbordamiento de pila del motor ante entradas maliciosas.
    if (depth > MAX_DEPTH) throw new Error('cbor: anidamiento excesivo');
    const head = this.u8();
    const major = head >> 5;
    const info = head & 0x1f;

    switch (major) {
      case MAJOR_UINT:
        return this.argument(info);

      case MAJOR_NEGINT:
        return -1 - this.argument(info);

      case MAJOR_BYTES:
        return Buffer.from(this.bytes(this.argument(info)));

      case MAJOR_TEXT:
        return Buffer.from(this.bytes(this.argument(info))).toString('utf8');

      case MAJOR_ARRAY: {
        const n = this.argument(info);
        // Cada elemento ocupa al menos un byte: una longitud mayor que lo que
        // queda es mentira y no se reserva memoria para ella.
        if (n > this.buf.length - this.pos) throw new Error('cbor: datos truncados');
        const out = new Array(n);
        for (let i = 0; i < n; i++) out[i] = this.value(depth + 1);
        return out;
      }

      case MAJOR_MAP: {
        const n = this.argument(info);
        const out = Object.create(null);
        for (let i = 0; i < n; i++) {
          const key = this.value(depth + 1);
          if (typeof key !== 'string') throw new Error('cbor: solo se aceptan claves de texto');
          // Claves duplicadas: en CBOR canónico no existen y aceptarlas
          // permitiría colar un segundo authData que sobrescriba al validado.
          if (key in out) throw new Error('cbor: clave duplicada en mapa');
          out[key] = this.value(depth + 1);
        }
        return out;
      }

      case MAJOR_TAG:
        // Se descarta la etiqueta y se decodifica el contenido.
        this.argument(info);
        return this.value(depth + 1);

      case MAJOR_SIMPLE:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        if (info === 23) return undefined;
        throw new Error(`cbor: valor simple no soportado (info ${info})`);

      default:
        throw new Error('cbor: tipo mayor desconocido');
    }
  }
}

/**
 * Decodifica un único valor CBOR. Sobra o falta un byte y falla: el objeto de
 * atestación tiene que consumirse entero.
 * @param {Buffer} buf
 */
export function decodeCbor(buf) {
  const r = new Reader(buf);
  const value = r.value();
  if (r.pos !== buf.length) throw new Error('cbor: bytes sobrantes tras el valor');
  return value;
}
