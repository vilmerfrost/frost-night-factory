/**
 * Utilities for converting between Buffer, Uint8Array, and string
 * Ensures consistent UTF-8 encoding
 */

/**
 * Convert any input to UTF-8 string
 * Handles: string, Buffer, Uint8Array, ArrayBuffer, null, undefined
 */
export function toUtf8(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Uint8Array) return Buffer.from(input).toString("utf8");
  if (Buffer.isBuffer(input)) return input.toString("utf8");
  if (input instanceof ArrayBuffer) return Buffer.from(input).toString("utf8");
  return String(input ?? "");
}

/**
 * Convert Uint8Array to ArrayBuffer for NextResponse BodyInit
 */
export function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}
