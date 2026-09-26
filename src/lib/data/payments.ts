import type { Tx } from "@/lib/db";
import { dueDate, dueStatus, type DueStatus } from "@/lib/finance";

export type DuePayment = {
  id: string;
  content: string;
  amount: number;
  payDay: number;
  categoryName: string | null;
  hasCategory: boolean;
  paymentMethodName: string | null;
  accountNote: string | null;
  transactionId: string | null;
  date: string;
  status: DueStatus;
  daysLeft: number;
};

/** 사용 중인 결제일 항목의 그 달 상태 (입력됨/예정/오늘/지남), 결제일 순 */
export async function loadDuePayments(tx: Tx, householdId: string, month: string, today: string): Promise<DuePayment[]> {
  const rows = await tx<
    {
      id: string;
      content: string;
      amount: number;
      pay_day: number;
      category_id: string | null;
      category_name: string | null;
      payment_method_name: string | null;
      account_note: string | null;
      transaction_id: string | null;
    }[]
  >`
    select r.id, r.content, r.amount, r.pay_day, r.category_id, c.name as category_name,
      pm.name as payment_method_name, r.account_note,
      (select t.id from public.transactions t
       where t.recurring_payment_id = r.id and t.occurred_on between ${`${month}-01`} and ${dueDate(31, month)}
       limit 1) as transaction_id
    from public.recurring_payments r
    left join public.categories c on c.id = r.category_id
    left join public.payment_methods pm on pm.id = r.payment_method_id
    where r.household_id = ${householdId} and r.is_active
    order by r.pay_day, r.sort_order
  `;
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    amount: r.amount,
    payDay: r.pay_day,
    categoryName: r.category_name,
    hasCategory: r.category_id !== null,
    paymentMethodName: r.payment_method_name,
    accountNote: r.account_note,
    transactionId: r.transaction_id,
    ...dueStatus(r.pay_day, month, today, r.transaction_id !== null),
  }));
}
