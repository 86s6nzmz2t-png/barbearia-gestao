// Taxas por forma de pagamento (editáveis aqui)
export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix", fee: 0 },
  { value: "dinheiro", label: "Dinheiro", fee: 0 },
  { value: "cartao_debito", label: "Cartão de Débito", fee: 0.0199 },
  { value: "cartao_credito", label: "Cartão de Crédito", fee: 0.0349 },
] as const;

export const SERVICES = [
  { value: "cabelo", label: "Cabelo" },
  { value: "barba", label: "Barba" },
  { value: "combo", label: "Combo (Cabelo + Barba)" },
  { value: "sobrancelha", label: "Sobrancelha" },
  { value: "pigmentacao", label: "Pigmentação" },
  { value: "outro", label: "Outro" },
] as const;

export function computeNet(amount: number, method: string): number {
  const m = PAYMENT_METHODS.find((p) => p.value === method);
  const fee = m?.fee ?? 0;
  return Math.round(amount * (1 - fee) * 100) / 100;
}

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function serviceLabel(value: string): string {
  return SERVICES.find((s) => s.value === value)?.label ?? value;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
