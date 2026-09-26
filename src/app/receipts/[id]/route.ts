import { getSessionUserId } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { uuidSchema } from "@/lib/validation";

/** 영수증 사진. RLS로 같은 가계부 구성원만 받는다. 사진은 바뀌지 않으므로 오래 캐시한다. */
export async function GET(_req: Request, ctx: RouteContext<"/receipts/[id]">) {
  const { id } = await ctx.params;
  const userId = await getSessionUserId();
  if (!userId) return new Response(null, { status: 401 });
  if (!uuidSchema.safeParse(id).success) return new Response(null, { status: 404 });

  const [row] = await withUser(userId, (tx) =>
    tx<{ content_type: string; data: Buffer }[]>`select content_type, data from public.transaction_receipts where id = ${id}`,
  );
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.content_type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
