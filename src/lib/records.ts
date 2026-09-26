// 대출·카드·통장·결제일 관리 목록의 입력 항목 정의 (참고 시트의 같은 탭 열 구성)
export type FieldType = "text" | "longtext" | "amount" | "percent" | "day" | "last4" | "category" | "payment_method" | "bool";
export type Field = { key: string; label: string; type: FieldType; required?: boolean; placeholder?: string };
export type RecordKind = "loans" | "cards" | "bank_accounts" | "recurring_payments";

export const RECORDS: Record<RecordKind, { title: string; unit: string; fields: Field[] }> = {
  loans: {
    title: "대출",
    unit: "대출",
    fields: [
      { key: "name", label: "대출명", type: "text", required: true, placeholder: "예: 주택담보대출" },
      { key: "lender", label: "금융기관", type: "text" },
      { key: "purpose", label: "대출목적", type: "text" },
      { key: "principal", label: "대출원금", type: "amount", required: true },
      { key: "rate_percent", label: "금리 (%)", type: "percent", placeholder: "예: 4.3" },
      { key: "payment_day", label: "납입일", type: "text", placeholder: "예: 매월 7일" },
      { key: "monthly_payment", label: "월 납입금액", type: "amount" },
      { key: "rate_type", label: "금리종류", type: "text", placeholder: "변동 / 고정" },
      { key: "term", label: "대출기간", type: "text", placeholder: "예: 2025/1/1~2054/12/31" },
      { key: "repayment_terms", label: "대출상환조건", type: "text", placeholder: "예: 30년 만기" },
      { key: "repayment_method", label: "상환방법", type: "text", placeholder: "예: 원리금균등" },
      { key: "prepayment_fee_percent", label: "중도상환수수료 (%)", type: "percent" },
      { key: "preferential_rate", label: "우대금리 조건", type: "longtext" },
    ],
  },
  cards: {
    title: "카드",
    unit: "카드",
    fields: [
      { key: "name", label: "카드명", type: "text", required: true },
      { key: "issuer", label: "카드사", type: "text" },
      { key: "card_type", label: "카드종류", type: "text", placeholder: "신용카드 / 체크카드" },
      { key: "purpose", label: "용도", type: "text", placeholder: "예: 생활비" },
      { key: "monthly_budget", label: "매월 카드값 예산", type: "amount" },
      { key: "payment_method_id", label: "연결할 지출방법", type: "payment_method" },
      { key: "billing_day", label: "결제일", type: "text", placeholder: "예: 13일" },
      { key: "usage_period", label: "카드사용일", type: "text", placeholder: "예: 전월 1일~말일" },
      { key: "billing_account", label: "결제계좌", type: "text" },
      { key: "credit_limit", label: "카드한도", type: "amount" },
      { key: "performance_amount", label: "실적금액", type: "amount" },
      { key: "annual_fee", label: "연회비", type: "amount" },
      { key: "valid_until", label: "유효기간", type: "text", placeholder: "예: 2029-10" },
      { key: "benefits", label: "주요 혜택", type: "longtext" },
    ],
  },
  bank_accounts: {
    title: "통장",
    unit: "통장",
    fields: [
      { key: "bank", label: "은행", type: "text", required: true },
      { key: "account_type", label: "통장종류", type: "text", placeholder: "예: 입출금, 적금" },
      { key: "account_last4", label: "계좌번호 끝 4자리", type: "last4", placeholder: "1234" },
      { key: "holder", label: "명의", type: "text" },
      { key: "purpose", label: "용도", type: "text", placeholder: "예: 월급, 생활비" },
      { key: "note", label: "비고", type: "longtext" },
    ],
  },
  recurring_payments: {
    title: "결제일",
    unit: "결제",
    fields: [
      { key: "content", label: "내용", type: "text", required: true, placeholder: "예: 보험료" },
      { key: "amount", label: "금액", type: "amount", required: true },
      { key: "pay_day", label: "결제일 (매월)", type: "day", required: true },
      { key: "category_id", label: "구분 (소분류)", type: "category" },
      { key: "payment_method_id", label: "지출방법", type: "payment_method" },
      { key: "account_note", label: "결제 계좌·카드", type: "text", placeholder: "예: 우리은행 00계좌" },
      { key: "note", label: "비고", type: "text" },
      { key: "is_active", label: "매달 챙기기", type: "bool" },
    ],
  },
};

export function isRecordKind(v: string): v is RecordKind {
  return v in RECORDS;
}
