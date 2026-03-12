import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

export const COOKIE_NAME = "admin_session";
export const KDS_COOKIE_NAME = "kds_session";

// Secret is validated at startup by env.ts — throws a clear error if missing.
function getSecret(): Uint8Array {
  return new TextEncoder().encode(env.ADMIN_JWT_SECRET);
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function signKdsToken(): Promise<string> {
  return new SignJWT({ role: "kds" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(getSecret());
}

export async function verifyKdsToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "kds";
  } catch {
    return false;
  }
}

// Alias for kitchen display auth (same token, different name per PRD)
export const verifyKitchenToken = verifyKdsToken;
