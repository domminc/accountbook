import { z } from "zod";

export const loginIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,20}$/, "아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 입력해 주세요.");

export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상으로 입력해 주세요.")
  .max(72, "비밀번호는 72자 이하로 입력해 주세요.");

export const nameSchema = (label: string, max = 30) =>
  z
    .string()
    .trim()
    .min(1, `${label}을(를) 입력해 주세요.`)
    .max(max, `${label}은(는) ${max}자 이하로 입력해 주세요.`);

export const uuidSchema = z.uuid();

/** zod 검사 결과의 첫 오류 문구 */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "입력값을 확인해 주세요.";
}
