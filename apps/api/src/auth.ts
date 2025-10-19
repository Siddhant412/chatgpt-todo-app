import "dotenv/config";
import { jwtVerify, createRemoteJWKSet } from "jose";

const RAW_ISSUER = process.env.ISSUER || "";
const AUDIENCE = process.env.AUDIENCE || "";

function normalizeIssuer(v: string): string {
  if (!v) throw new Error("ISSUER is missing");
  let out = v.trim();
  if (!/^https?:\/\//i.test(out)) out = "https://" + out;
  if (!out.endsWith("/")) out += "/";
  return out;
}

const ISSUER = normalizeIssuer(RAW_ISSUER);
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));


// Verifies a Bearer token. Returns JWT payload on success, null on failure.
export async function verifyAccessToken(bearer?: string) {
  if (!bearer || !/^Bearer\s+/i.test(bearer)) return null;
  const token = bearer.replace(/^Bearer\s+/i, "");
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["RS256"],
    });
    return payload;
  } catch (err) {
    console.error("[AUTH] verify failed:", (err as Error).message);
    return null;
  }
}
