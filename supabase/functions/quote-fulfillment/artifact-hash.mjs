// Hash the exact UTF-8 CSV bytes uploaded for an existing quote fulfillment.
// Byte integrity alone is NOT proof the buyer received the file.
export async function hashArtifactBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('ARTIFACT_BYTES_REQUIRED');
  const value = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(value, b => b.toString(16).padStart(2, '0')).join('');
}
