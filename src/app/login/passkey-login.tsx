"use client";

import { useSyncExternalStore, useState } from "react";
import { ScanFace } from "lucide-react";
import { browserSupportsWebAuthn, sendSignal, startAuthentication } from "@simplewebauthn/browser";
import { secondaryButtonClass } from "@/components/ui";
import { finishPasskeyLogin, startPasskeyLogin } from "./actions";

const noSubscribe = () => () => {};

/** Face ID·지문으로 로그인. 패스키를 쓸 수 없는 브라우저에서는 보이지 않는다. */
export function PasskeyLogin({ next }: { next: string }) {
  const supported = useSyncExternalStore(noSubscribe, browserSupportsWebAuthn, () => false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!supported) return null;

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const optionsJSON = await startPasskeyLogin();
      const response = await startAuthentication({ optionsJSON });
      const result = await finishPasskeyLogin(response, next);
      if (result.next) {
        window.location.assign(result.next);
        return;
      }
      if (result.unknownCredential) {
        // 서버에서 지운 패스키: 기기의 목록에서도 빼 달라고 알린다 (지원하는 브라우저만)
        void sendSignal({ signalName: "unknownCredential", ...result.unknownCredential }).catch(() => {});
      }
      setError(result.error ?? "로그인하지 못했어요.");
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "AbortError"
          ? "취소했거나 시간이 지났어요. 기기에 등록한 패스키가 없다면 아이디로 로그인한 뒤 설정 > 계정·보안에서 등록해 주세요."
          : "Face ID·지문 로그인을 쓸 수 없어요. 아이디와 비밀번호로 로그인해 주세요.",
      );
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <button type="button" onClick={login} disabled={busy} className={`flex items-center justify-center gap-2 ${secondaryButtonClass}`}>
        <ScanFace className="size-5" aria-hidden />
        {busy ? "확인 중…" : "Face ID·지문으로 로그인"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
