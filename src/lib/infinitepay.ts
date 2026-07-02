// Mock InfinitePay Cloud API integration.
// Replace `enviarParaInfinitePay` with a real fetch to InfinitePay when
// credentials are configured. The webhook route in
// `src/routes/api/public/infinitepay-webhook.ts` is the counterpart that
// receives the async confirmation.

export type InfinitePayCaptureMethod = "credit" | "debit" | "pix" | string;

export type InfinitePayWebhookPayload = {
  invoice_slug: string;
  amount: number; // in BRL reais (as sent by the maquininha simulation)
  capture_method: InfinitePayCaptureMethod;
  status: "approved" | "declined" | "pending" | string;
  order_nsu: string;
};

export type EnviarParaInfinitePayInput = {
  amount: number; // in BRL reais
  orderId?: string;
};

/**
 * Simula o envio de uma cobrança para a maquininha via Cloud API da InfinitePay.
 * Retorna o payload que a InfinitePay enviaria de volta via webhook quando
 * o pagamento for aprovado.
 */
export async function enviarParaInfinitePay(
  input: EnviarParaInfinitePayInput,
): Promise<InfinitePayWebhookPayload> {
  const orderId = input.orderId ?? `ord_${Date.now()}`;
  // Simula latência de envio + aprovação na maquininha.
  await new Promise((r) => setTimeout(r, 2500));

  const payload: InfinitePayWebhookPayload = {
    invoice_slug: `inv_${Math.random().toString(36).slice(2, 10)}`,
    amount: input.amount,
    capture_method: "credit",
    status: "approved",
    order_nsu: orderId,
  };
  return payload;
}
