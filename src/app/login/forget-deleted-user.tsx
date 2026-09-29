"use client";

import { useEffect } from "react";
import { DELETING_KEY, forgetQueuedFor } from "@/lib/offline-queue";

/** 탈퇴 직후: 탈퇴한 사람이 이 기기에 남긴 오프라인 입력 대기열을 지운다 */
export function ForgetDeletedUser() {
  useEffect(() => {
    try {
      const userId = sessionStorage.getItem(DELETING_KEY);
      sessionStorage.removeItem(DELETING_KEY);
      if (userId) forgetQueuedFor(userId);
    } catch {}
  }, []);
  return null;
}
