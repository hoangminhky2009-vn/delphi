/**
 * BẢN DEMO — `node:crypto` THU GỌN cho server chạy trong trình duyệt (Web Worker). Chỉ đúng những gì server dùng:
 * createHash('sha256') · createHmac('sha1'|'sha256') · randomBytes · randomInt · timingSafeEqual · randomUUID.
 * Băm viết tay (đồng bộ — SubtleCrypto là bất đồng bộ, server gọi đồng bộ). KHÔNG dùng cho bảo mật thật: bản demo không
 * có mật khẩu, không có người thứ hai, đóng tab là mất.
 */
import { Buffer } from 'buffer';

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function dem(dl: Uint8Array, khoi: number, bitDaiBe: boolean): Uint8Array {
  const n = dl.length;
  const tong = Math.ceil((n + 9) / khoi) * khoi;
  const ra = new Uint8Array(tong);
  ra.set(dl);
  ra[n] = 0x80;
  const bit = n * 8;
  const v = new DataView(ra.buffer);
  if (bitDaiBe) {
    v.setUint32(tong - 8, Math.floor(bit / 2 ** 32));
    v.setUint32(tong - 4, bit >>> 0);
  }
  return ra;
}

function sha256(dl: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const m = dem(dl, 64, true);
  const v = new DataView(m.buffer);
  const w = new Uint32Array(64);
  const rot = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < m.length; o += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = v.getUint32(o + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rot(w[i - 15]!, 7) ^ rot(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rot(w[i - 2]!, 17) ^ rot(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i += 1) {
      const S1 = rot(e, 6) ^ rot(e, 11) ^ rot(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K256[i]! + w[i]!) >>> 0;
      const S0 = rot(a, 2) ^ rot(a, 13) ^ rot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }
  const ra = new Uint8Array(32);
  const rv = new DataView(ra.buffer);
  for (let i = 0; i < 8; i += 1) rv.setUint32(i * 4, h[i]!);
  return ra;
}

function sha1(dl: Uint8Array): Uint8Array {
  const h = new Uint32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
  const m = dem(dl, 64, true);
  const v = new DataView(m.buffer);
  const w = new Uint32Array(80);
  const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let o = 0; o < m.length; o += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = v.getUint32(o + i * 4);
    for (let i = 16; i < 80; i += 1) w[i] = rol(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1) >>> 0;
    let [a, b, c, d, e] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!];
    for (let i = 0; i < 80; i += 1) {
      const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const t = (rol(a, 5) + f + e + k + w[i]!) >>> 0;
      e = d; d = c; c = rol(b, 30) >>> 0; b = a; a = t;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0; h[4] = (h[4]! + e) >>> 0;
  }
  const ra = new Uint8Array(20);
  const rv = new DataView(ra.buffer);
  for (let i = 0; i < 5; i += 1) rv.setUint32(i * 4, h[i]!);
  return ra;
}

const BAM: Record<string, { fn: (d: Uint8Array) => Uint8Array; khoi: number }> = {
  sha256: { fn: sha256, khoi: 64 },
  sha1: { fn: sha1, khoi: 64 },
};
const byteCua = (x: string | Uint8Array): Uint8Array => (typeof x === 'string' ? new TextEncoder().encode(x) : x);

class Bam {
  private phan: Uint8Array[] = [];
  constructor(private readonly thuat: string, private readonly khoa?: Uint8Array) {
    if (!BAM[thuat]) throw new Error(`shim crypto: không có thuật toán ${thuat}`);
  }
  update(x: string | Uint8Array): this { this.phan.push(byteCua(x)); return this; }
  digest(): Buffer;
  digest(enc: 'hex' | 'base64' | 'base64url'): string;
  digest(enc?: 'hex' | 'base64' | 'base64url'): Buffer | string {
    const dl = Buffer.concat(this.phan);
    const { fn, khoi } = BAM[this.thuat]!;
    let ra: Uint8Array;
    if (this.khoa === undefined) ra = fn(dl);
    else {
      let k = this.khoa.length > khoi ? fn(this.khoa) : this.khoa;
      const kk = new Uint8Array(khoi); kk.set(k); k = kk;
      const ip = k.map((b) => b ^ 0x36); const op = k.map((b) => b ^ 0x5c);
      ra = fn(Buffer.concat([op, fn(Buffer.concat([ip, dl]))]));
    }
    const b = Buffer.from(ra);
    return enc ? b.toString(enc) : b;
  }
}

export function createHash(thuat: string): Bam { return new Bam(thuat); }
export function createHmac(thuat: string, khoa: string | Uint8Array): Bam { return new Bam(thuat, byteCua(khoa)); }
export function randomBytes(n: number): Buffer {
  const b = new Uint8Array(n); globalThis.crypto.getRandomValues(b); return Buffer.from(b);
}
export function randomInt(a: number, b?: number): number {
  const [lo, hi] = b === undefined ? [0, a] : [a, b];
  const x = new Uint32Array(1); globalThis.crypto.getRandomValues(x);
  return lo + (x[0]! % (hi - lo));
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) throw new RangeError('Input buffers must have the same byte length');
  let d = 0; for (let i = 0; i < a.length; i += 1) d |= a[i]! ^ b[i]!; return d === 0;
}
export function randomUUID(): string { return globalThis.crypto.randomUUID(); }
export default { createHash, createHmac, randomBytes, randomInt, timingSafeEqual, randomUUID };
