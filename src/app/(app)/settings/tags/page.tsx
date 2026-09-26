import { SimpleListPage } from "../simple-list";

export default function TagsPage() {
  return (
    <SimpleListPage
      table="tags"
      title="태그"
      description="거래에 붙여서 따로 모아 볼 수 있어요. 태그를 지우면 거래에서도 떨어져요."
      placeholder="예: 과소비"
    />
  );
}
