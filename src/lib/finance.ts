// Formas de pagamento
export const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "infinitepay", label: "Maquininha InfinitePay" },
] as const;

export function isInfinitePay(method: string) {
  return method === "infinitepay";
}

export const DEFAULT_CREDIT_FEE = 3;
export const DEFAULT_DEBIT_FEE = 1.99;

export const SERVICES = [
  { value: "cabelo", label: "Cabelo" },
  { value: "barba", label: "Barba" },
  { value: "combo", label: "Combo (Cabelo + Barba)" },
  { value: "sobrancelha", label: "Sobrancelha" },
  { value: "pigmentacao", label: "Pigmentação" },
  { value: "outro", label: "Outro" },
] as const;

export function isCard(method: string) {
  return method === "cartao_credito" || method === "cartao_debito" || method === "cartao";
}

export function defaultFeeFor(
  method: string,
  fees: { credit: number; debit: number },
): number {
  if (method === "cartao_credito" || method === "cartao") return fees.credit;
  if (method === "cartao_debito") return fees.debit;
  return 0;
}

export function effectiveFeePercent(method: string, feePercent: number): number {
  return isCard(method) ? (Number.isFinite(feePercent) ? feePercent : 0) : 0;
}

export function computeNet(amount: number, method: string, feePercent: number): number {
  const fee = effectiveFeePercent(method, feePercent);
  return Math.round(amount * (1 - fee / 100) * 100) / 100;
}

export function paymentLabel(value: string): string {
  if (value === "cartao") return "Cartão de Crédito";
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function serviceLabel(value: string): string {
  return SERVICES.find((s) => s.value === value)?.label ?? value;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
