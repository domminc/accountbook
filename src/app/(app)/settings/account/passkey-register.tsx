"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanFace } from "lucide-react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { smallButtonClass } from "@/components/ui";
import { finishPasskeyRegistration, startPasskeyRegistration } from "./actions";

type Support = "checking" | "yes" | "no";

/** 지금 쓰는 기기를 Face ID·지문 로그인용으로 등록한다 */
export function PasskeyRegister() {
  const router = useRouter();
  const [support, setSupport] = useState<Support>("checking");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ error?: string; message?: string }>({});

  useEffect(() => {
    let alive = true;
    const check = browserSupportsWebAuthn()
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
      : Promise.resolve(false);
    void check.then((ok) => alive && setSupport(ok ? "yes" : "no"));
    return () => {
      alive = false;
    };
  }, []);

  async function register() {
    setBusy(true);
    setResult({});
    try {
      const optionsJSON = await startPasskeyRegistration();
      const response = await startRegistration({ optionsJSON });
      const r = await finishPasskeyRegistration(response);
      setResult(r);
      if (!r.error) router.refresh();
    } catch (e) {
      const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
      const name = e instanceof Error ? e.name : "";
      setResult({
        error:
          code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || name === "InvalidStateError"
            ? "이 기기는 이미 등록돼 있어요."
            : name === "NotAllowedError" || name === "AbortError"
              ? "취소했거나 시간이 지났어요."
              : "등록하지 못했어요. 기기에 Face ID·지문이나 화면 잠금이 켜져 있는지 확인해 주세요.",
      });
    }
    setBusy(false);
  }

  if (support === "checking") return null;
  if (support === "no") {
    return <p className="text-sm text-muted">이 기기·브라우저에서는 Face ID·지문 로그인을 쓸 수 없어요.</p>;
  }
  return (
    <div>
      <button type="button" onClick={register} disabled={busy} className={`flex items-center gap-1.5 ${smallButtonClass}`}>
        <ScanFace className="size-4" aria-hidden />
        {busy ? "등록 중…" : "이 기기 등록하기"}
      </button>
      {result.error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {result.error}
        </p>
      ) : result.message ? (
        <p role="status" className="mt-1 text-sm text-accent">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
