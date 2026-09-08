// Lector DER mínimo. Node expone X509Certificate para la cadena y la clave
// pública, pero no deja leer una extensión arbitraria por OID, y App Attest
// mete el nonce en la extensión privada de Apple 1.2.840.113635.100.8.2.
//
// Solo se implementa lo que hace falta para recorrer un certificado: longitudes
// definidas, forma corta y larga. Nada de longitudes indefinidas (no existen en
// DER) ni de decodificación de tipos: se navega la estructura y se extraen
// bytes crudos.

export const TAG_BOOLEAN = 0x01;
export const TAG_INTEGER = 0x02;
export const TAG_BIT_STRING = 0x03;
export const TAG_OCTET_STRING = 0x04;
export const TAG_OID = 0x06;
export const TAG_SEQUENCE = 0x30;

/**
 * Parsea un TLV DER en la posición dada.
 * @returns {{ tag: number, constructed: boolean, content: Buffer, end: number }}
 */
function readTlv(buf, pos) {
  if (pos + 2 > buf.length) throw new Error('der: datos truncados');

  const tag = buf[pos];
  if ((tag & 0x1f) === 0x1f) throw new Error('der: etiquetas de forma larga no soportadas');

  let p = pos + 1;
  let len = buf[p++];

  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0) throw new Error('der: longitud indefinida no permitida en DER');
    if (n > 4) throw new Error('der: longitud demasiado grande');
    if (p + n > buf.length) throw new Error('der: datos truncados');
    len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | buf[p++];
  }

  const end = p + len;
  if (end > buf.length) throw new Error('der: datos truncados');

  return { tag, constructed: (tag & 0x20) !== 0, content: buf.subarray(p, end), end };
}

/** Todos los TLV hijos de un contenido construido. */
export function children(content) {
  const out = [];
  let pos = 0;
  while (pos < content.length) {
    const tlv = readTlv(content, pos);
    out.push(tlv);
    pos = tlv.end;
  }
  return out;
}

/** El TLV que empieza en el byte 0 del buffer. */
export function parse(buf) {
  const tlv = readTlv(buf, 0);
  if (tlv.end !== buf.length) throw new Error('der: bytes sobrantes tras el valor');
  return tlv;
}

/**
 * Codifica un OID en notación de puntos a su contenido DER, para poder
 * compararlo con el de un certificado sin escribir bytes mágicos a mano.
 */
export function encodeOid(dotted) {
  const parts = dotted.split('.').map(Number);
  if (parts.length < 2 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error(`der: OID inválido "${dotted}"`);
  }

  const bytes = [40 * parts[0] + parts[1]];
  for (const part of parts.slice(2)) {
    const base128 = [part & 0x7f];
    let rest = part >>> 7;
    while (rest > 0) {
      base128.unshift((rest & 0x7f) | 0x80);
      rest >>>= 7;
    }
    bytes.push(...base128);
  }
  return Buffer.from(bytes);
}

/**
 * Extrae el contenido de la extensión con el OID dado de un certificado X.509
 * en DER, o null si el certificado no la lleva.
 *
 * Certificate ::= SEQUENCE { tbsCertificate, signatureAlgorithm, signature }
 * TBSCertificate ::= SEQUENCE { ..., [3] EXPLICIT Extensions OPTIONAL }
 * Extension ::= SEQUENCE { extnID OID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING }
 */
export function findExtension(certDer, dottedOid) {
  const target = encodeOid(dottedOid);

  const cert = parse(certDer);
  if (cert.tag !== TAG_SEQUENCE) throw new Error('der: el certificado no es un SEQUENCE');

  const tbs = children(cert.content)[0];
  if (!tbs || tbs.tag !== TAG_SEQUENCE) throw new Error('der: falta tbsCertificate');

  // Las extensiones van en el contexto explícito [3] → etiqueta 0xA3.
  const extsHolder = children(tbs.content).find((c) => c.tag === 0xa3);
  if (!extsHolder) return null;

  const extsSeq = children(extsHolder.content)[0];
  if (!extsSeq || extsSeq.tag !== TAG_SEQUENCE) throw new Error('der: extensiones malformadas');

  for (const ext of children(extsSeq.content)) {
    if (ext.tag !== TAG_SEQUENCE) continue;
    const fields = children(ext.content);
    const oid = fields[0];
    if (!oid || oid.tag !== TAG_OID || !oid.content.equals(target)) continue;

    const value = fields[fields.length - 1];
    if (!value || value.tag !== TAG_OCTET_STRING) throw new Error('der: extnValue inesperado');
    return value.content;
  }

  return null;
}

/**
 * Punto EC sin comprimir (0x04 || X || Y) de una clave pública en formato SPKI.
 *
 * SubjectPublicKeyInfo ::= SEQUENCE { algorithm SEQUENCE, subjectPublicKey BIT STRING }
 */
export function ecPointFromSpki(spkiDer) {
  const spki = parse(spkiDer);
  const bitString = children(spki.content).find((c) => c.tag === TAG_BIT_STRING);
  if (!bitString) throw new Error('der: SPKI sin BIT STRING');

  // El primer byte de un BIT STRING es el número de bits sin usar del último
  // byte; en una clave siempre es 0.
  if (bitString.content[0] !== 0x00) throw new Error('der: BIT STRING con bits sobrantes');

  const point = bitString.content.subarray(1);
  if (point[0] !== 0x04) throw new Error('der: se esperaba un punto EC sin comprimir');
  return Buffer.from(point);
}
