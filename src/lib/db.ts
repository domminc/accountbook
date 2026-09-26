import postgres from "postgres";

type Sql = postgres.Sql<{ bigint: number; date: string }>;
export type Tx = postgres.TransactionSql<{ bigint: number; date: string }>;

const globalForDb = globalThis as unknown as { __accountbookSql?: Sql };

/** DB 연결 (서버 전용). DATABASE_URL 은 Supabase의 Postgres 연결 문자열 등 일반 PostgreSQL 주소. */
export function db(): Sql {
  if (globalForDb.__accountbookSql) return globalForDb.__accountbookSql;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 환경 변수가 필요합니다. .env.example 을 참고하세요.");

  const sql = postgres(url, {
    // Supabase 트랜잭션 풀러(pgbouncer)에서도 동작하도록 prepared statement를 쓰지 않는다
    prepare: false,
    max: 5,
    types: {
      // 금액·개수(int8)는 JS number로. 금액 상한(1조)이 2^53보다 훨씬 작다.
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // date는 시간대 변환 없이 'YYYY-MM-DD' 문자열 그대로
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  }) as Sql;

  globalForDb.__accountbookSql = sql;
  return sql;
}

/**
 * 로그인 사용자 권한으로 트랜잭션을 실행한다. RLS가 적용되어 본인 가계부 데이터만 보이고 바뀐다.
 */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`set local role authenticated`;
    return fn(tx as Tx);
  });
  return result as T;
}

/** Postgres 오류 코드 (unique 위반 등). 아니면 undefined. */
export function pgErrorCode(e: unknown): string | undefined {
  return e instanceof postgres.PostgresError ? e.code : undefined;
}

/** 사용자에게 보여줄 DB 오류 문구 */
export function dbErrorMessage(e: unknown): string {
  if (e instanceof postgres.PostgresError) {
    switch (e.code) {
      case "23505":
        if (e.constraint_name === "cards_payment_method_unique") return "이미 다른 카드에 연결한 지출방법이에요.";
        if (e.constraint_name?.startsWith("spending_limits_")) return "이미 한도를 정한 항목이에요.";
        return "같은 이름이 이미 있어요.";
      case "23503":
        return "사용 중인 항목이라 지울 수 없어요. 대신 숨김을 써 주세요.";
      case "23514":
        // 트리거에서 직접 만든 안내 문구는 그대로, 제약 조건 위반은 일반 문구로
        return e.message.includes("constraint") ? "입력값을 확인해 주세요." : e.message;
    }
  }
  console.error(e);
  return "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}
