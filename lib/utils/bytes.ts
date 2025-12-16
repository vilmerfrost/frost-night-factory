/**
 * Utilities for converting between Buffer, Uint8Array, and string
 * Ensures consistent UTF-8 encoding
 */

export type ByteLike =
  | string
  | Buffer
  | ArrayBuffer
  | Uint8Array
  | ArrayBufferView;

/**
 * Convert any input to UTF-8 string
 * Handles: string, Buffer, Uint8Array, ArrayBuffer, ArrayBufferView
 */
export function toUtf8(input: ByteLike): string {
  if (typeof input === "string") return input;
  if (Buffer.isBuffer(input)) return input.toString("utf-8");
  if (input instanceof ArrayBuffer) return Buffer.from(input).toString("utf-8");

  // ArrayBufferView inkluderar t.ex. Uint8Array / DataView
  // Copy to avoid ArrayBufferLike issues - convert to standalone Uint8Array first
  let view: Uint8Array;
  if (input instanceof Uint8Array) {
    // Create a standalone copy
    view = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      view[i] = input[i]!;
    }
  } else {
    // For other ArrayBufferView types, copy via Uint8Array
    const temp = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    view = new Uint8Array(temp.length);
    for (let i = 0; i < temp.length; i++) {
      view[i] = temp[i]!;
    }
  }

  // Convert view.buffer (which is ArrayBufferLike) to ArrayBuffer
  const arrayBuffer = new ArrayBuffer(view.byteLength);
  const targetView = new Uint8Array(arrayBuffer);
  targetView.set(view);
  return Buffer.from(arrayBuffer).toString("utf-8");
}

/**
 * Convert ByteLike to Buffer
 */
export function toBuffer(input: ByteLike): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") return Buffer.from(input, "utf-8");
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  
  // Copy to avoid ArrayBufferLike issues - convert to standalone Uint8Array first
  let view: Uint8Array;
  if (input instanceof Uint8Array) {
    // Create a standalone copy
    view = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      view[i] = input[i]!;
    }
  } else {
    // For other ArrayBufferView types, copy via Uint8Array
    const temp = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    view = new Uint8Array(temp.length);
    for (let i = 0; i < temp.length; i++) {
      view[i] = temp[i]!;
    }
  }
  // Convert view.buffer (which is ArrayBufferLike) to ArrayBuffer
  const arrayBuffer = new ArrayBuffer(view.byteLength);
  const targetView = new Uint8Array(arrayBuffer);
  targetView.set(view);
  return Buffer.from(arrayBuffer);
}

/**
 * Convert Uint8Array to ArrayBuffer for NextResponse BodyInit
 */
export function uint8ArrayToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Garanterar "standalone" ArrayBuffer (inte del-slice)
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}
