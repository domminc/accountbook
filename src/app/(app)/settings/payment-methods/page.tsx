import { SimpleListPage } from "../simple-list";

export default function PaymentMethodsPage() {
  return (
    <SimpleListPage
      table="payment_methods"
      title="지출방법"
      description="지출을 입력할 때 고르는 결제 수단이에요. 거래에 쓴 지출방법은 지울 수 없으니 숨겨 주세요."
      placeholder="예: 신용카드"
    />
  );
}
