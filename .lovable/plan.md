## Problema

No formulário "Novo lançamento" da aba Caixa, o grid usa 12 colunas e a coluna "Data" recebe apenas `md:col-span-1`. Isso é estreito demais para um `<input type="date">` no desktop, então o campo fica cortado/invisível. Além disso, quando o método de pagamento não é cartão, um espaçador vazio de 1 coluna aparece entre "Pagamento" e "Data", criando o gap errado.

## Correção

Rebalancear as colunas do formulário para dar espaço adequado à Data e eliminar o espaçador fantasma:

- Serviço: `md:col-span-4` → `md:col-span-3`
- Valor: `md:col-span-2` (mantém)
- Pagamento: `md:col-span-2` (mantém)
- Taxa %: `md:col-span-2` quando visível (era 1); remover o espaçador vazio quando ocultada — a coluna simplesmente deixa de existir e as demais se ajustam.
- Data: `md:col-span-1` → `md:col-span-3` quando não há Taxa, `md:col-span-1`... na verdade, mais simples: **Data sempre `md:col-span-3`** e ajustar o restante.

Layout final proposto (12 col):
- Sem cartão: Serviço 3 · Valor 2 · Pagamento 2 · Data 3 · Cliente 2 = 12
- Com cartão: Serviço 3 · Valor 2 · Pagamento 2 · Taxa 2 · Data 1... 

Para manter simplicidade, fixar Data em 2 colunas e Cliente em 3:
- Sem cartão: Serviço 3 · Valor 2 · Pagamento 2 · Data 2 · Cliente 3 = 12
- Com cartão: Serviço 3 · Valor 2 · Pagamento 2 · Taxa 1 · Data 2 · Cliente 2 = 12

Com isso a Data ganha largura suficiente para o input date aparecer inteiro no desktop e o espaço entre Pagamento e Data fica correto (sem espaçador vazio).

Nenhuma mudança de lógica, apenas classes de grid no `src/routes/caixa.tsx`.
