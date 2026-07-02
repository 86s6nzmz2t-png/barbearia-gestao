import { createFileRoute } from "@tanstack/react-router";

// Webhook público da InfinitePay Cloud API.
// URL estável: /api/public/infinitepay-webhook
//
// Payload esperado:
// {
//   "invoice_slug": "string",
//   "amount": number,
//   "capture_method": "string",
//   "status": "approved" | "declined" | ...,
//   "order_nsu": "string"
// }
//
// Este handler é um stub de preparação. Para produção:
// 1. Validar assinatura HMAC no header (X-InfinitePay-Signature) contra
//    um segredo em process.env.INFINITEPAY_WEBHOOK_SECRET.
// 2. Buscar a transação pendente pelo order_nsu / invoice_slug e marcar
//    como paga (ou inserir se ainda não existir) usando supabaseAdmin.
// 3. Notificar o cliente em tempo real via Supabase Realtime.

type InfinitePayWebhookPayload = {
  invoice_slug: string;
  amount: number;
  capture_method: string;
  status: string;
  order_nsu: string;
};

export const Route = createFileRoute("/api/public/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: InfinitePayWebhookPayload;
        try {
          payload = (await request.json()) as InfinitePayWebhookPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!payload?.invoice_slug || !payload?.order_nsu) {
          return new Response("Missing required fields", { status: 400 });
        }

        // TODO: verificar assinatura HMAC antes de confiar no payload.
        // TODO: persistir/atualizar transação quando status === "approved"
        //       usando supabaseAdmin (import dinâmico dentro do handler).
        console.log("[InfinitePay webhook]", payload);

        return Response.json({ received: true, invoice_slug: payload.invoice_slug });
      },
    },
  },
});
