// 패스키(Face ID·지문·기기 화면 잠금) 로그인. 공개 키만 저장하고, 생체 정보는 기기 밖으로 나오지 않는다.
// challenge 는 서버에 두지 않고 5분짜리 서명 쿠키에 넣었다가 확인할 때 한 번 꺼내 지운다.
import { cookies, headers } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db, withUser } from "./db";
import { deviceName } from "./device-name";
import { requestOrigin } from "./request-origin";
import { createSignedValue, readSignedValue } from "./session";

const CHALLENGE_COOKIE = "ab_passkey";
const CHALLENGE_MAX_AGE = 5 * 60;
const RP_NAME = "가계부";
const EXPIRED = "시간이 지났어요. 다시 시도해 주세요.";

/** 패스키가 묶이는 사이트: 도메인(rpID)과 주소(origin). 들어온 주소 그대로 쓴다 (www.homesell.co.kr, 미리보기 주소, localhost) */
async function relyingParty() {
  const origin = await requestOrigin();
  return { rpID: origin.hostname, origin: origin.origin };
}

async function saveChallenge(purpose: string, challenge: string) {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, createSignedValue(purpose, challenge, CHALLENGE_MAX_AGE), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: CHALLENGE_MAX_AGE,
  });
}

/** 저장해 둔 challenge 를 꺼내고 지운다 (한 번만 쓴다) */
async function takeChallenge(purpose: string): Promise<string | null> {
  const store = await cookies();
  const value = readSignedValue(purpose, store.get(CHALLENGE_COOKIE)?.value);
  store.delete(CHALLENGE_COOKIE);
  return value;
}

/** 사용자 id(uuid)를 패스키의 user handle 로 (16바이트) */
function userHandle(userId: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(userId.replace(/-/g, ""), "hex"));
}

function cleanTransports(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string" && /^[a-z-]{1,20}$/.test(t)).slice(0, 10) : [];
}

// ── 등록 (로그인한 사용자가 이 기기를 추가) ──

export async function passkeyRegistrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID } = await relyingParty();
  const { loginId, existing } = await withUser(userId, async (tx) => {
    const [me] = await tx<{ login_id: string | null }[]>`select login_id from public.users where id = ${userId}`;
    const existing = await tx<{ credential_id: string; transports: string[] }[]>`
      select credential_id, transports from public.passkeys where user_id = ${userId}
    `;
    return { loginId: me?.login_id ?? "가계부", existing };
  });
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: loginId,
    userDisplayName: loginId,
    userID: userHandle(userId),
    attestationType: "none",
    // 이미 등록한 기기는 다시 등록하지 않게
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: c.transports })),
    // 이 기기의 Face ID·지문(또는 화면 잠금)으로, 아이디 입력 없이 로그인할 수 있게 기기에 저장
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
  });
  await saveChallenge(`register:${userId}`, options.challenge);
  return options;
}

export async function registerPasskey(userId: string, response: RegistrationResponseJSON): Promise<{ error?: string }> {
  const expectedChallenge = await takeChallenge(`register:${userId}`);
  if (!expectedChallenge) return { error: EXPIRED };
  const { rpID, origin } = await relyingParty();
  let info;
  try {
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!result.verified) return { error: "등록하지 못했어요. 다시 시도해 주세요." };
    info = result.registrationInfo;
  } catch {
    return { error: "등록하지 못했어요. 다시 시도해 주세요." };
  }
  const { credential } = info;
  const transports = cleanTransports(credential.transports ?? response.response?.transports);
  const name = deviceName((await headers()).get("user-agent"));
  try {
    await withUser(userId, (tx) => tx`
      insert into public.passkeys (user_id, credential_id, public_key, counter, transports, name)
      values (${userId}, ${credential.id}, ${Buffer.from(credential.publicKey)}, ${credential.counter},
        string_to_array(${transports.join(",")}, ','), ${name})
    `);
  } catch (e) {
    console.error(e);
    return { error: "이미 등록한 기기이거나 저장하지 못했어요." };
  }
  return {};
}

// ── 로그인 (세션 없음) ──

export async function passkeyLoginOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = await relyingParty();
  // 아이디를 묻지 않고, 기기에 저장된 이 사이트의 패스키 중에서 고르게 한다
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await saveChallenge("login", options.challenge);
  return options;
}

export type PasskeyLoginResult =
  | { userId: string }
  | { error: string; /** 서버에 없는 패스키: 기기에서도 지우도록 알린다 */ unknownCredential?: { rpID: string; credentialID: string } };

export async function verifyPasskeyLogin(response: AuthenticationResponseJSON): Promise<PasskeyLoginResult> {
  const expectedChallenge = await takeChallenge("login");
  if (!expectedChallenge) return { error: EXPIRED };
  if (typeof response?.id !== "string" || response.id.length > 1400) return { error: "로그인하지 못했어요." };
  const { rpID, origin } = await relyingParty();

  // 로그인 전이라 사용자가 없으므로 아이디·비밀번호 로그인처럼 db() 로 찾는다
  const [pk] = await db()<{ id: string; user_id: string; public_key: Buffer; counter: number; transports: string[] }[]>`
    select id, user_id, public_key, counter, transports from public.passkeys where credential_id = ${response.id}
  `;
  if (!pk) {
    return {
      error: "등록되지 않은 패스키예요. 아이디·비밀번호로 로그인한 뒤 설정 > 계정·보안에서 다시 등록해 주세요.",
      unknownCredential: { rpID, credentialID: response.id },
    };
  }
  // 기기가 알려 준 사용자와 패스키 주인이 같아야 한다
  const handle = response.response?.userHandle;
  if (handle && handle !== Buffer.from(userHandle(pk.user_id)).toString("base64url")) return { error: "로그인하지 못했어요." };

  try {
    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: response.id, publicKey: new Uint8Array(pk.public_key), counter: pk.counter, transports: pk.transports },
    });
    if (!verified) return { error: "로그인하지 못했어요." };
    await db()`
      update public.passkeys set counter = ${authenticationInfo.newCounter}, last_used_at = now() where id = ${pk.id}
    `;
  } catch {
    return { error: "로그인하지 못했어요." };
  }
  return { userId: pk.user_id };
}
