# Barbershop Flow

Crie um aplicativo de gerenciamento para minha barbearia focado em fluxo de caixa e controle de clientes. O app deve ter um design moderno e elegante (estilo dark mode premium, usando tons de grafite, preto e detalhes em dourado ou âmbar). 

Divida o aplicativo nas seguintes seções principais:

1. **Dashboard (Relatórios):**

   - Filtros de visualização: Diário, Semanal e Mensal.

   - Cards de destaque: Total de Entradas (Bruto), Valores Líquidos Recebidos e Total de Atendimentos.

   - Um gráfico simples (pode ser de barras ou linha) mostrando a evolução do faturamento no período selecionado.

2. **Fluxo de Caixa (Financeiro):**

   - Formulário rápido para lançar novas entradas: Valor, Serviço prestado (ex: Cabelo, Barba, Combo), Forma de Pagamento (Pix, Cartão, Dinheiro), Data e Cliente (selecionável).

   - Histórico de transações em formato de tabela, com opção de excluir ou editar um lançamento.

3. **Cadastro de Clientes:**

   - Formulário para cadastrar cliente: Nome, Telefone, WhatsApp e uma área de "Notas/Preferências" (ex: "gosta de degradê navalhado").

   - Lista de clientes cadastrados com barra de pesquisa para buscar por nome ou telefone.

Crie uma barra de navegação lateral ou inferior para alternar facilmente entre essas três telas.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://barbearia-gestao.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6ef37ad8-0d47-49fa-8e99-977288ce8cb0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
