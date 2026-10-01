// Generate a VAPID keypair for Web Push. Paste the output into
// apps/api/.env.local (and the prod env). Regenerating it later silently breaks
// every existing subscription, so keep the pair in a password manager.
const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
])) as CryptoKeyPair;
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
const b64url = (u: Uint8Array) => Buffer.from(u).toString("base64url");
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
export {};
