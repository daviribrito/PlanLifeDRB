// Criptografia do cofre (Web Crypto, nada sai do navegador).
// Chave: PBKDF2-SHA256 (600.000 iterações) a partir da Chave Mestra -> AES-256-GCM.
// 2FA: TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) compatível com Google Authenticator, Authy, 1Password etc.

const enc = new TextEncoder();
const dec = new TextDecoder();
export const KDF_ITERATIONS = 600000;

export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
export const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(password, saltB64, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptJSON(key, obj, aad) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad ? enc.encode(aad) : undefined }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64(iv), data: b64(ct) };
}

export async function decryptJSON(key, ivB64, dataB64, aad) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(ivB64), additionalData: aad ? enc.encode(aad) : undefined }, key, unb64(dataB64));
  return JSON.parse(dec.decode(pt));
}

/* ---------- Base32 (RFC 4648) ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
export function base32Decode(str) {
  const s = str.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v < 0) throw new Error('Chave 2FA inválida');
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
export const newTotpSecret = () => base32Encode(randomBytes(20));

export async function totp(secretB32, { t = Date.now(), step = 30, digits = 6 } = {}) {
  const counter = Math.floor(t / 1000 / step);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey('raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const off = mac[mac.length - 1] & 15;
  const code = ((mac[off] & 127) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

export async function verifyTotp(secretB32, code, window = 1) {
  const c = String(code).replace(/\D/g, '');
  if (c.length !== 6) return false;
  for (let w = -window; w <= window; w++) {
    if ((await totp(secretB32, { t: Date.now() + w * 30000 })) === c) return true;
  }
  return false;
}

export const totpUri = (secret, account, issuer = 'PlanLife') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

/* ---------- Gerador e força de senha ---------- */
const SETS = { lower: 'abcdefghijkmnopqrstuvwxyz', upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digits: '23456789', symbols: '!@#$%&*-_=+?.:' };
function randInt(max) { // sem viés (rejection sampling)
  const lim = Math.floor(2 ** 32 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= lim);
  return buf[0] % max;
}
export function generatePassword(length = 20, opts = { lower: true, upper: true, digits: true, symbols: true }) {
  const pools = Object.keys(SETS).filter((k) => opts[k]).map((k) => SETS[k]);
  if (!pools.length) pools.push(SETS.lower);
  const all = pools.join('');
  const chars = pools.map((p) => p[randInt(p.length)]); // garante um de cada
  while (chars.length < length) chars.push(all[randInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

export function strength(pw) {
  if (!pw) return { bits: 0, label: 'Vazia', level: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 30;
  let bits = Math.log2(pool || 1) * pw.length;
  if (/(.)\1{2,}/.test(pw)) bits *= 0.8;
  if (/^(senha|password|123|qwerty|abc)/i.test(pw)) bits *= 0.4;
  const level = bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { bits: Math.round(bits), level, label: ['Vazia', 'Fraca', 'Razoável', 'Forte', 'Muito forte'][level] };
}
