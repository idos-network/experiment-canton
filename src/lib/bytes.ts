const hexAlphabet = "0123456789abcdef";

export function bytesToHex(bytes: Uint8Array): string {
  let result = "";

  for (const byte of bytes) {
    result += hexAlphabet[byte >> 4] + hexAlphabet[byte & 0x0f];
  }

  return result;
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even length.");
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }

  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function concatBytes(...values: Uint8Array[]): Uint8Array {
  const totalLength = values.reduce((sum, value) => sum + value.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;

  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }

  return result;
}

export function uint16ToBigEndian(value: number): Uint8Array {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}
