# Plano: App de Gestão para Barbearia

## Visão geral
Aplicativo web com três seções (Dashboard, Fluxo de Caixa, Clientes) e navegação lateral. Visual dark premium: grafite/preto com acentos em dourado/âmbar, tipografia elegante (display serif para títulos + sans moderna para corpo).

## Backend (Lovable Cloud)
Ativar Lovable Cloud para persistir dados. Sem login por enquanto (app de uso pessoal do dono) — pode ser adicionado depois.

Tabelas:
- `clients` — id, name, phone, whatsapp, notes, created_at
- `transactions` — id, amount (bruto), net_amount (líquido), service (cabelo/barba/combo/outro), payment_method (pix/cartao/dinheiro), client_id (nullable), date, created_at

Líquido calculado automaticamente conforme forma de pagamento (taxas configuráveis no código: ex. Pix 0%, Dinheiro 0%, Cartão 3.5%) — assim o dashboard separa Bruto x Líquido sem campo manual.

## Estrutura de rotas
- `/` → Dashboard
- `/caixa` → Fluxo de Caixa
- `/clientes` → Clientes
- Layout raiz com sidebar fixa à esquerda (desktop) e barra inferior (mobile)

## Telas

### 1. Dashboard
- Tabs/segmented control: Diário · Semanal · Mensal
- 3 cards de destaque: Total Entradas (Bruto), Líquido Recebido, Total de Atendimentos
- Gráfico de barras (Recharts) do faturamento no período
- Lista enxuta dos últimos 5 lançamentos

### 2. Fluxo de Caixa
- Formulário rápido no topo: Valor, Serviço (select), Pagamento (select), Data (datepicker), Cliente (combobox buscável, opcional)
- Tabela abaixo com histórico, ordenada por data desc
- Ações por linha: editar (abre dialog com o mesmo formulário) e excluir (confirm dialog)

### 3. Clientes
- Formulário: Nome, Telefone, WhatsApp, Notas/Preferências (textarea)
- Barra de pesquisa filtra por nome ou telefone
- Lista em cards com ações editar/excluir e atalho "WhatsApp" abrindo `wa.me/<numero>`

## Design system
- Paleta dark grafite + dourado definida em `src/styles.css` via tokens semânticos (background, foreground, primary=gold, accent=amber, card grafite, border sutil)
- Tipografia: Playfair Display (títulos) + Inter (corpo), carregadas via `<link>` no `__root.tsx`
- Componentes shadcn: Card, Button, Input, Select, Table, Dialog, Tabs, Sidebar, Sonner (toasts)
- Detalhes: bordas finas douradas, sombras suaves quentes, ícones lucide

## Stack técnica
- TanStack Start + Router (file-based em `src/routes/`)
- TanStack Query para data fetching (loaders + `useSuspenseQuery`)
- Server functions (`createServerFn`) para CRUD em `src/lib/*.functions.ts`
- Recharts para gráfico
- Validação com Zod nos formulários e nos inputValidators das server functions

## Entregáveis
1. Ativar Lovable Cloud + migração com tabelas, grants e RLS permissiva (sem auth)
2. Tokens de design e fontes
3. Layout raiz com sidebar/bottom-nav
4. Server functions: listar/criar/editar/excluir clientes e transações; agregados do dashboard por período
5. Três telas funcionais conectadas ao backend
6. Toasts de sucesso/erro e estados de loading/empty
