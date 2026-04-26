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
