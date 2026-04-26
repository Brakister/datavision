# Fluxo de Alteracoes Feitas

## Objetivo
Registrar alteracoes ja implementadas no DataVision para evitar repeticao de erros, retrabalho e reimplementacao de conceitos existentes.

## Fonte de referencia
- Baseado em [PROMPTS_SEQUENCIAIS.md](PROMPTS_SEQUENCIAIS.md)
- Atualizado com as alteracoes reais aplicadas no frontend durante a correcao de navegacao

## Estado consolidado por fases
1. Fase 0/1 (Backend base + upload + ingestao + metadados): implementada
2. Fase 2 (Frontend upload + layout/navegacao): implementada
3. Fase 3 (sugestoes e dados de graficos): implementada
4. Fase 4+ (filtros cross-dashboard completos, exportacao, layouts avancados, E2E total): parcial/pendente

## Alteracoes recentes aplicadas (2026-04-25)
1. Correcao de perda de contexto ao navegar no sidebar
- Problema: ao trocar de rota pelo menu lateral, o app perdia `?file=<uuid>`.
- Efeito: paginas como dashboard/tabela exibiam "Nenhum arquivo selecionado".
- Solucao aplicada: preservar o parametro `file` automaticamente na navegacao interna.

2. Padronizacao da navegacao file-aware
- Novo hook: [frontend/src/hooks/use-file-navigation.ts](frontend/src/hooks/use-file-navigation.ts)
- O hook resolve o `activeFileUuid` com prioridade:
  1) query string atual (`location.search`)
  2) `currentFile.uuid` da store
  3) `uploadSession.fileUuid` da store
- O hook expoe `buildPath(path, preserveFile=true)` para montar rotas mantendo `file`.

3. Arquivos atualizados
- Sidebar usando regra unica de navegacao:
  - [frontend/src/components/layout/sidebar.tsx](frontend/src/components/layout/sidebar.tsx)
- Botoes de navegacao interna do dashboard usando regra unica:
  - [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
- Botao "Voltar ao dashboard" na tabela usando regra unica:
  - [frontend/src/pages/table-page.tsx](frontend/src/pages/table-page.tsx)

4. Transparencia de inconsistencias com botao dedicado
- Sempre que status for inconsistente, o usuario deve ter acao explicita para visualizar os pontos de inconsistencias.
- Componente criado: [frontend/src/components/layout/inconsistency-details.tsx](frontend/src/components/layout/inconsistency-details.tsx)
- Locais integrados:
  - Header global: [frontend/src/components/layout/header.tsx](frontend/src/components/layout/header.tsx)
  - Dashboard/Graficos: [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
  - Upload (quando status inconsistente): [frontend/src/pages/upload-page.tsx](frontend/src/pages/upload-page.tsx)
- Conteudo exibido no detalhe: divergencias de engine, warnings e erros do integrity_report.
- Linguagem obrigatoria: explicar em texto natural (ex.: "contagem de linhas diferente") e manter o codigo tecnico apenas como apoio.

5. Prompt 3.3 concluido (Componentes de Graficos Recharts)
- Wrappers consolidados para bar, line/area, pie/donut, scatter, radar e KPI com `ChartWrapper`.
- Tooltip enriquecido com formatacao automatica de valores (moeda/percentual/numero).
- Legenda interativa para esconder/mostrar series (incluindo pie e scatter).
- Estados de loading/empty, responsividade, animacoes, fullscreen e export PNG ativos.

6. Convencao de checklist do arquivo de prompts
- Sempre que um prompt for finalizado, atualizar o titulo para `(feito)` e marcar os criterios correspondentes com `[x]`.

7. Prompt 4.2 concluido (Filtros Cross-Dashboard)
- Pagina de filtros implementada com contexto do arquivo atual e preview de linhas afetadas.
- Filtros globais integrados em dashboard e tabela usando a mesma store (aplicacao cruzada).
- Breadcrumbs de filtros ativos com remocao individual e acao de limpar todos.
- Presets de filtros salvos e reaplicados via badges clicaveis.
- Backend de analytics atualizado para suportar operadores avancados tambem no chart-data e table-data.

## Alteracoes recentes aplicadas (2026-04-26)
1. Prioridade de dominio financeiro no analisador
- O app deixou de tratar apenas visualizacao generica de datasets e passou a priorizar leitura financeira quando encontrar colunas compativeis com:
  - analise mensal
  - analise anual
  - analise diaria
  - receitas
  - despesas
  - deficit / superavit
  - saldos
  - divisao das receitas
  - divisao das despesas

2. Pasta `backend/`
- Arquivo alterado: [backend/app/services/analytics/__init__.py](backend/app/services/analytics/__init__.py)
- O servico de sugestoes passou a gerar heuristicas financeiras prioritarias antes das heuristicas genericas.
- Foram adicionadas regras para reconhecer por nome de coluna:
  - periodo mensal (`mes`, `competencia`, `periodo`, `referencia`)
  - periodo anual (`ano`, `exercicio`)
  - periodo diario (`dia`, `data`, `date`)
  - metricas de receita, despesa, saldo e resultado
  - dimensoes de composicao de receita e despesa
- Novas sugestoes priorizadas quando o schema permitir:
  - `Receitas mensais`
  - `Despesas mensais`
  - `Deficit / superavit mensais`
  - `Receitas anuais`
  - `Despesas anuais`
  - `Deficit / superavit anuais`
  - `Saldos anuais`
  - `Divisao das receitas`
  - `Divisao das despesas`
- Foi adicionada deduplicacao de sugestoes para evitar repeticao entre regras financeiras e regras genericas.

3. Pasta `backend/` - testes
- Arquivo alterado: [backend/app/tests/test_analytics.py](backend/app/tests/test_analytics.py)
- Foi criado teste especifico para dataset financeiro validando prioridade de:
  - sugestoes mensais
  - sugestoes anuais
  - grafico donut para receitas
  - grafico pie para despesas

4. Pasta `frontend/`
- Arquivo alterado: [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
- O dashboard agora detecta contexto financeiro pela aba atual e muda o comportamento principal.
- Foi criado contexto derivado para:
  - identificar se a aba tem foco financeiro
  - identificar se existem leituras mensal, anual e diaria
  - identificar se ha composicao de receitas e despesas
  - montar KPIs financeiros principais
- A tela passou a trocar titulo e descricao de `Overview do dataset` para `Painel financeiro` quando aplicavel.
- Os cards principais agora priorizam KPIs financeiros agregados por metrica real detectada na aba.
- Os blocos auxiliares do dashboard tambem foram adaptados para linguagem financeira quando o schema permitir.
- A secao final de insights passou a destacar leitura financeira deterministica como prioridade.

5. Pasta `frontend/` - formatacao
- Arquivo alterado: [frontend/src/components/charts/kpi-card.tsx](frontend/src/components/charts/kpi-card.tsx)
- KPI de moeda passou a usar formatacao monetaria BRL real, em vez de apenas numero decimal formatado.

6. Pasta `frontend/` - inferencia de valores
- Arquivo alterado: [frontend/src/components/charts/value-format.ts](frontend/src/components/charts/value-format.ts)
- A inferencia de metricas monetarias foi ampliada para reconhecer termos financeiros como:
  - `despesa`
  - `saldo`
  - `superavit`
  - `deficit`
  - `imposto`
  - `folha`

7. Validacao executada nesta rodada
- `npx tsc --noEmit` no frontend executado com sucesso.
- O `pytest` do backend nao concluiu por restricao de permissao do ambiente para diretorios temporarios do runner.
- Mesmo assim, a heuristica financeira nova foi validada manualmente contra um `analytics.db` temporario, confirmando retorno priorizado de:
  - `Receitas mensais`
  - `Divisao das receitas`
  - `Divisao das despesas`
  - `Despesas mensais`
  - `Receitas anuais`
  - `Deficit / superavit anuais`

8. Filtro intuitivo por forma de analise
- Pasta `frontend/`
- Arquivos alterados:
  - [frontend/src/components/filters/filter-panel.tsx](frontend/src/components/filters/filter-panel.tsx)
  - [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
  - [frontend/src/stores/index.ts](frontend/src/stores/index.ts)
  - [frontend/src/utils/analysis-mode.ts](frontend/src/utils/analysis-mode.ts)
- Foi adicionada uma selecao explicita de `Formas de Analises` dentro do painel de filtros, com os atalhos:
  - `Anual`
  - `Mensal`
  - `Diaria`
- A exibicao desses atalhos depende das colunas realmente detectadas na aba atual.
- Ao clicar em uma forma de analise:
  - o estado fica salvo na store global
  - o dashboard passa a priorizar sugestoes e graficos compativeis com o recorte escolhido
  - quando nao houver sugestoes compativeis, o app faz fallback para as sugestoes gerais
- Foi criado utilitario compartilhado para detectar modos disponiveis na aba e validar se cada sugestao pertence ao recorte anual, mensal ou diario.
- Validacao executada:
  - `npx tsc --noEmit` no frontend executado com sucesso apos a integracao.

9. Correcao de estado confuso sem sugestoes + ampliacao para fluxo de caixa
- Pastas alteradas:
  - `backend/`
  - `frontend/`
- Arquivos alterados:
  - [backend/app/services/analytics/__init__.py](backend/app/services/analytics/__init__.py)
  - [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
- Problema observado:
  - ao carregar algumas planilhas de financeiro/fluxo de caixa, o overview principal podia ficar preso na mensagem `Aguarde o carregamento das sugestoes para montar o overview`, mesmo quando a geracao de sugestoes ja havia terminado.
- Correcao aplicada no frontend:
  - o overview principal agora diferencia `carregando` de `nao encontrei sugestoes`.
  - quando nao houver sugestoes compativeis, o usuario recebe mensagem clara explicando que faltou combinacao suficiente de colunas temporais, categorias e metricas numericas reconhecidas.
  - a tela oferece atalho para abrir a tabela real em vez de parecer travada.
- Ampliacao aplicada no backend/frontend para reconhecimento financeiro:
  - receitas tambem passam a reconhecer termos como `receb`, `credito`
  - despesas tambem passam a reconhecer termos como `pag`, `debito`
  - saldo tambem passa a reconhecer `acumulado`
  - receita realizada/projetada ganhou suporte adicional para `recebimentos`, `projetada`, `prevista`
- Objetivo da ampliacao:
  - melhorar compatibilidade com planilhas de fluxo de caixa que usam nomenclaturas mais proximas de operacao financeira do dia a dia.
- Validacao executada:
  - `npx tsc --noEmit` no frontend executado com sucesso apos a correcao.

10. Ampliacao de termos financeiros para meios de pagamento
- Pastas alteradas:
  - `backend/`
  - `frontend/`
- Arquivos alterados:
  - [backend/app/services/analytics/__init__.py](backend/app/services/analytics/__init__.py)
  - [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
  - [frontend/src/components/charts/value-format.ts](frontend/src/components/charts/value-format.ts)
- Termos adicionados para melhorar deteccao de planilhas financeiras e fluxo de caixa:
  - `boleto`
  - `pix`
  - `pagamento`
  - `pagamentos`
  - `credito`
  - `debito`
- Efeito pratico:
  - esses termos agora ajudam a identificar metricas de entrada/saida
  - tambem ajudam a identificar composicoes por forma/meio de pagamento
  - a formatacao visual dos valores passa a tratar esses nomes como monetarios quando usados como metricas
- Validacao executada:
  - `npx tsc --noEmit` no frontend executado com sucesso apos a ampliacao.

11. Ampliacao adicional para formas de pagamento e transferencia
- Pastas alteradas:
  - `backend/`
  - `frontend/`
- Arquivos alterados:
  - [backend/app/services/analytics/__init__.py](backend/app/services/analytics/__init__.py)
  - [frontend/src/pages/charts-page.tsx](frontend/src/pages/charts-page.tsx)
  - [frontend/src/components/charts/value-format.ts](frontend/src/components/charts/value-format.ts)
- Termos adicionados nesta rodada:
  - `cartao`
  - `ted`
  - `doc`
  - `transferencia`
  - `dinheiro`
- Efeito pratico:
  - passam a contar como pistas de metricas financeiras
  - passam a contar como pistas de composicao por meio/forma de pagamento
  - passam a receber formatacao monetaria quando usados como metricas
- Validacao executada:
  - `npx tsc --noEmit` no frontend executado com sucesso apos a ampliacao.

## Conceitos ja existentes que NAO devem ser refeitos
1. Contexto de arquivo e determinado por `?file=<uuid>` na URL para rotas analiticas.
2. Estado global principal ja existe em Zustand em [frontend/src/stores/index.ts](frontend/src/stores/index.ts).
3. Paginas analiticas ja tem contratos de hooks para backend:
- [frontend/src/hooks/use-file-metadata.ts](frontend/src/hooks/use-file-metadata.ts)
- [frontend/src/hooks/use-chart-suggestions.ts](frontend/src/hooks/use-chart-suggestions.ts)
- [frontend/src/hooks/use-chart-data.ts](frontend/src/hooks/use-chart-data.ts)
- [frontend/src/hooks/use-table-data.ts](frontend/src/hooks/use-table-data.ts)
4. Fluxo de upload ja redireciona corretamente para dashboard com query `file`.

## Erros recorrentes a evitar
1. Navegar para rotas analiticas sem `file`.
2. Duplicar logica de construcao de URL em varios componentes.
3. Limpar estado de arquivo sem intencao explicita do usuario.
4. Tratar store como unica fonte de verdade e ignorar a URL.

## Regra operacional para novas alteracoes
1. Qualquer link/botao para `/dashboard`, `/charts`, `/table`, `/filters` deve usar `buildPath(...)` do hook file-aware.
2. So usar rota sem `file` para `/` e `/upload`.
3. Toda tela que mostrar status inconsistente deve disponibilizar botao de visualizacao de pontos de inconsistencias.
4. Em inconsistencias, priorizar linguagem clara para usuario final; codigos tecnicos devem ficar em nivel secundario.
5. Antes de subir alteracao de navegacao, validar manualmente:
- Upload -> Dashboard
- Dashboard -> Tabela (sidebar e botao)
- Tabela -> Dashboard
- Dashboard -> Graficos/Filtros pelo sidebar
- Refresh da pagina mantendo query `file`
- Status inconsistente -> botao abre detalhes com divergencias/warnings/erros

## Checklist rapido antes de codar
1. O comportamento ja existe em algum prompt/fase do [PROMPTS_SEQUENCIAIS.md](PROMPTS_SEQUENCIAIS.md)?
2. Ha hook/utilitario pronto para reaproveitar?
3. A alteracao preserva `?file=<uuid>` quando necessario?
4. O estado exibido bate com URL + store?
5. O arquivo alterado continua sem erros de TypeScript/lint basico?

## Proximo passo recomendado
- Criar testes de navegacao (unitarios/integracao frontend) para garantir persistencia do `file` ao trocar rotas e evitar regressao.
