import {
  createRemoteJWKSet,
  jwtVerify,
  JWTPayload,
  decodeProtectedHeader,
  decodeJwt,
} from "jose";
import { fetch } from "undici";
import { z } from "zod";

function normalizeIssuer(v: string): string {
  if (!v) throw new Error("ISSUER is missing");
  let out = v.trim();
  if (!/^https?:\/\//i.test(out)) out = "https://" + out;
  if (!out.endsWith("/")) out += "/";
  return out;
}

const RAW_ISSUER = process.env.ISSUER || "";
const ISSUER = normalizeIssuer(RAW_ISSUER);
const AUDIENCE = process.env.AUDIENCE || "";
const ALLOW_UNVERIFIED = process.env.MCP_ALLOW_UNVERIFIED === "1";

if (!AUDIENCE) {
  console.error("[MCP AUTH] AUDIENCE missing");
  process.exit(1);
}

console.log("[MCP AUTH] ISSUER  =", ISSUER);
console.log("[MCP AUTH] AUDIENCE=", AUDIENCE);
console.log("[MCP AUTH] ALLOW_UNVERIFIED =", ALLOW_UNVERIFIED);

// OIDC discovery (JWKS URI)
const OIDCConfig = z.object({ jwks_uri: z.string().url() });

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
async function getJwks() {
  if (jwks) return jwks;
  const discoveryUrl = new URL("/.well-known/openid-configuration", ISSUER).toString();
  const res = await fetch(discoveryUrl);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status} ${res.statusText}`);
  const cfg = OIDCConfig.parse(await res.json());
  jwks = createRemoteJWKSet(new URL(cfg.jwks_uri));
  return jwks!;
}

// Normalization helpers

function safeUrlDecode(s: string): string {
  try {
    // Only attempt if it actually looks encoded
    return s.includes("%") ? decodeURIComponent(s) : s;
  } catch {
    return s;
  }
}

// Accepts Bearer/DPoP, strips quotes, URL-decodes,
// and returns the bare JWT if found
export function extractJwtFromAuthHeader(auth?: string | null): string | null {
  if (!auth) return null;
  let s = auth.trim();

  // Strip surrounding ASCII or curly quotes repeatedly
  const QUOTE_START = /^["'“”‘’]+/;
  const QUOTE_END = /["'“”‘’]+$/;
  while (QUOTE_START.test(s) && QUOTE_END.test(s)) {
    s = s.replace(QUOTE_START, "").replace(QUOTE_END, "").trim();
  }
  // Strip any leading quotes one-off
  s = s.replace(QUOTE_START, "").trim();

  // URL-decode the whole header value
  s = safeUrlDecode(s);

  // If scheme present, keep only the part after it
  const schemeMatch = s.match(/^(Bearer|DPoP)\s+(.+)$/i);
  if (schemeMatch) s = schemeMatch[2].trim();

  // URL-decode again in case only the token part was encoded
  s = safeUrlDecode(s);

  // If someone appended parameters, keep the first token-like part
  s = s.split(/[;\s]/)[0];

  const parts = s.split(".");
  if (parts.length !== 3 && parts.length !== 5) return null;

  return s;
}

// Reformat any incoming Authorization value to a proper `Bearer <JWT>` string.
export function formatBearer(auth?: string | null): string | null {
  const jwt = extractJwtFromAuthHeader(auth);
  return jwt ? `Bearer ${jwt}` : null;
}

/**
  Verify a (possibly messy) Bearer header string.
  Returns JWT payload on success, null on failure.
  If MCP_ALLOW_UNVERIFIED=1, decodes without signature verification (only for debugging)
 */
export async function verifyAccessToken(bearer?: string): Promise<JWTPayload | null> {
  const formatted = formatBearer(bearer);
  if (!formatted) {
    if (bearer) {
      console.warn(
        "[MCP AUTH] Unrecognized Authorization header (first 18):",
        JSON.stringify(bearer.slice(0, 18))
      );
    }
    return null;
  }
  const token = formatted.slice(7);

  // Log header/payload (non-sensitive fields) for debugging
  try {
    const hdr = decodeProtectedHeader(token);
    console.log("[MCP AUTH] token header:", {
      alg: hdr.alg,
      kid: hdr.kid,
      typ: hdr.typ,
    });
  } catch (e: any) {
    console.error("[MCP AUTH] decodeProtectedHeader failed:", e?.message || e);
  }
  try {
    const pl = decodeJwt(token);
    console.log("[MCP AUTH] token payload:", {
      iss: (pl as any).iss,
      aud: (pl as any).aud,
      scope: (pl as any).scope,
      permissions: (pl as any).permissions,
      azp: (pl as any).azp,
      gty: (pl as any).gty,
      exp: (pl as any).exp,
    });
  } catch (e: any) {
    console.error("[MCP AUTH] decodeJwt failed:", e?.message || e);
  }

  if (ALLOW_UNVERIFIED) {
    try {
      return decodeJwt(token) as unknown as JWTPayload;
    } catch {
      return null;
    }
  }

  try {
    const JWKS = await getJwks();
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload;
  } catch (e: any) {
    console.error("[MCP AUTH] verify failed:", e?.message || e);
    return null;
  }
}

export function wwwAuthHeader(resourceMetadataUrl: string) {
  return `Bearer resource_metadata="${resourceMetadataUrl}"`;
}
