// Formas de pagamento (Dinheiro, Pix, Cartão)
export const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
] as const;

export const DEFAULT_CARD_FEE = 3; // % padrão para Cartão

export const SERVICES = [
  { value: "cabelo", label: "Cabelo" },
  { value: "barba", label: "Barba" },
  { value: "combo", label: "Combo (Cabelo + Barba)" },
  { value: "sobrancelha", label: "Sobrancelha" },
  { value: "pigmentacao", label: "Pigmentação" },
  { value: "outro", label: "Outro" },
] as const;

export function isCard(method: string) {
  return method === "cartao";
}

export function effectiveFeePercent(method: string, feePercent: number): number {
  return isCard(method) ? (Number.isFinite(feePercent) ? feePercent : 0) : 0;
}

export function computeNet(amount: number, method: string, feePercent: number): number {
  const fee = effectiveFeePercent(method, feePercent);
  return Math.round(amount * (1 - fee / 100) * 100) / 100;
}

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function serviceLabel(value: string): string {
  return SERVICES.find((s) => s.value === value)?.label ?? value;
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
