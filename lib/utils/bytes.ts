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
  if (input instanceof Uint8Array) {
    // Convert Uint8Array to Buffer safely
    const buffer = Buffer.from(input);
    return buffer.toString("utf8");
  }
  if (Buffer.isBuffer(input)) return input.toString("utf8");
  if (input instanceof ArrayBuffer) {
    const buffer = Buffer.from(input);
    return buffer.toString("utf8");
  }
  return String(input ?? "");
}

/**
 * Convert Uint8Array to ArrayBuffer for NextResponse BodyInit
 */
export function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  if (bytes.byteLength === 0) {
    return new ArrayBuffer(0);
  }
  // Create a new ArrayBuffer with the correct size
  const buffer = new ArrayBuffer(bytes.byteLength);
  const view = new Uint8Array(buffer);
  view.set(bytes);
  return buffer;
}
