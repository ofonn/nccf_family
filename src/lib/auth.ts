// Browser-compatible SHA-256 using Web Crypto API
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const AUTH_HASHES = {
  master: "9d598ba5b4f3fda46daa17f9c0ff96ce72f6c6390a8b0488fcbc2ddd57dcdc0a",
  prayer_coordinator: "559cbfb727a428db14c17b3a925c201ac283e3800b3e034f55153077d8d56e29"
};
