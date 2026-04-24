# DataVision — Prompts de Construção Sequencial

> Use um prompt por vez. Cada bloco é autocontido e constrói sobre o anterior.
> Não pule etapas. O objetivo é chegar a um produto end-to-end funcional.

---

### Prompt 0.2 — Backend FastAPI Estruturado e Rodando (feito)
**Contexto:** Docker Compose já funciona. Backend FastAPI precisa de estrutura mínima mas funcional.

**Tarefa:** Implemente o backend FastAPI com: configuração via Pydantic Settings, logging estruturado JSON, tratamento global de exceções, CORS configurado, e health check. Use SQLAlchemy 2.0 async com PostgreSQL via asyncpg. Crie as models FileUpload, DashboardLayout e AuditLog. Use Alembic para migrations.

**Critérios de aceitação:**
- [ ] `GET /health` retorna versão e status
- [ ] `GET /docs` mostra Swagger UI com todos os schemas
- [ ] Conexão com PostgreSQL funciona (testar via endpoint que faz query simples)
- [ ] Exceções retornam JSON estruturado com `detail`, `error_code`, `timestamp`
- [ ] Migrations rodam automaticamente na startup (ou via comando documentado)

**Arquivos a entregar:** `main.py`, `core/config.py`, `core/logging.py`, `core/exceptions.py`, `models/__init__.py`, `db/database.py`, `alembic.ini`, pasta `migrations/`.

---

## FASE 1: Upload e Ingestão de Dados

### Prompt 1.1 — Upload de Arquivo com Validação (feito)
**Contexto:** Backend FastAPI rodando com PostgreSQL. Precisamos receber arquivos.

**Tarefa:** Implemente o endpoint `POST /upload` que recebe arquivo multipart/form-data (Excel/CSV/TSV/ODS), valida formato e tamanho máximo (500MB), calcula SHA-256 do arquivo, salva no filesystem local em `/app/storage/{uuid}/original.{ext}`, e persiste metadados no PostgreSQL (uuid, nome original, tamanho, hash, formato, status="pending").

**Critérios de aceitação:**
- [ ] Upload de CSV 10MB funciona e retorna uuid + metadados
- [ ] Upload de XLSX funciona
- [ ] Upload de arquivo >500MB retorna erro 413
- [ ] Upload de .pdf retorna erro 400 (formato não suportado)
- [ ] Arquivo original é salvo no filesystem e metadados no PostgreSQL
- [ ] UUID é determinístico (baseado no hash do arquivo) — mesmo arquivo = mesmo uuid

**Arquivos a entregar:** `api/upload.py`, schemas atualizados, teste via curl/Postman documentado.

---

### Prompt 1.2 — Leitura Multi-Engine com Relatório de Integridade (feito)
**Contexto:** Arquivo está salvo no storage. Precisamos ler e validar estrutura.

**Tarefa:** Implemente o serviço de ingestão que: (1) lê o arquivo com Polars (engine calamine para Excel, read_csv para CSV), (2) para XLSX faz segunda leitura com openpyxl apenas para verificar estrutura (merged cells, fórmulas, contagem de linhas/colunas), (3) compara as duas leituras e reporta divergências, (4) detecta schema de cada coluna (string, integer, float, date, boolean, currency, percentage, categorical, mixed, empty), (5) gera relatório de integridade completo, (6) persiste dados em DuckDB (uma tabela por aba).

**Critérios de aceitação:**
- [ ] CSV com 1000 linhas é lido em <2s
- [ ] XLSX com múltiplas abas lê todas as abas
- [ ] Coluna "00123" é detectada como string (não integer)
- [ ] Coluna com "10%", "20%" é detectada como percentage
- [ ] Coluna com "R$ 100" é detectada como currency
- [ ] Relatório contém: total_sheets, total_rows, cells_read, empty_cells, columns_by_type, mixed_type_columns, formulas_detected, merged_cells_detected, file_hash, sheet_hashes, engines_used, engine_divergences, warnings, errors
- [ ] Se strict_mode=true e houver divergências, status = "inconsistent" e retorna erro 422 com relatório
- [ ] Se strict_mode=false e houver divergências, status = "inconsistent" mas processa mesmo assim
- [ ] DuckDB é criado em `/app/storage/{uuid}/analytics.db` com tabelas indexadas

**Arquivos a entregar:** `services/ingestion/__init__.py`, schemas de integridade, testes com arquivos reais.

---

### Prompt 1.3 — Endpoint de Metadados e Status (feito)
**Contexto:** Arquivo foi processado. Precisamos consultar resultados.

**Tarefa:** Implemente: `GET /files/{uuid}/metadata` que retorna metadados completos do arquivo (sheets, columns, types, integrity_report). `GET /files/{uuid}/sheets/{sheet_name}/schema` que retorna schema detalhado de uma aba. `GET /upload/{uuid}/status` que retorna status do processamento.

**Critérios de aceitação:**
- [ ] `/files/{uuid}/metadata` retorna JSON completo com todas as abas e colunas
- [ ] `/files/{uuid}/sheets/{sheet_name}/schema` retorna tipo, null_count, unique_count, cardinality, min/max, sample_values de cada coluna
- [ ] Se uuid não existe, retorna 404
- [ ] Dados vêm do PostgreSQL (metadados) + DuckDB (schema detalhado)

---

## FASE 2: Frontend — Upload e Processamento

### Prompt 2.1 — Página de Upload Funcional (feito)
**Contexto:** Backend aceita upload. Frontend React precisa enviar arquivos.

**Tarefa:** Implemente a página de upload completa: área de drop com react-dropzone, preview do arquivo selecionado (nome, tamanho, formato), toggle para strict_mode, botão de upload com progresso visual, tratamento de erros do backend (formato inválido, arquivo grande, inconsistências), e redirecionamento para `/dashboard?file={uuid}` após sucesso.

**Critérios de aceitação:**
- [ ] Arrastar CSV para a área funciona
- [ ] Arquivo >500MB mostra erro antes de enviar
- [ ] Durante upload mostra spinner/progresso
- [ ] Em caso de erro do backend, mostra mensagem amigável
- [ ] Em caso de sucesso, redireciona para dashboard com uuid na URL
- [ ] Modo estrito pode ser ativado/desativado antes do upload

**Arquivos a entregar:** `pages/upload-page.tsx`, ajustes em `services/index.ts` se necessário.

---

### Prompt 2.2 — Layout Base e Navegação (feito)
**Contexto:** Precisamos de um layout profissional para o dashboard.

**Tarefa:** Implemente o layout completo: sidebar colapsável com ícones (Lucide), header com nome do arquivo atual, badges de status (OK/Inconsistente), toggle tema claro/escuro, e navegação entre páginas (Upload, Dashboard, Tabela, Gráficos, Filtros). Use Framer Motion para animações de transição.

**Critérios de aceitação:**
- [ ] Sidebar colapsa/expande com animação suave
- [ ] Header mostra nome do arquivo e status quando há arquivo carregado
- [ ] Toggle tema funciona (dark/light)
- [ ] Navegação entre rotas funciona sem reload
- [ ] Layout é responsivo (sidebar vira drawer em mobile)

**Arquivos a entregar:** `layout/app-layout.tsx`, `layout/header.tsx`, `layout/sidebar.tsx`, `App.tsx`.

---

## FASE 3: Analytics e Visualização

### Prompt 3.1 — Heurísticas de Sugestão de Gráficos (feito)
**Contexto:** Dados estão no DuckDB. Precisamos sugerir gráficos automaticamente.

**Tarefa:** Implemente o endpoint `GET /analytics/{uuid}/sheets/{sheet_name}/suggestions` que analisa o schema da aba e retorna sugestões de gráficos baseadas em heurísticas determinísticas. Cada sugestão deve conter: chart_type, title, description, dimension_columns, metric_columns, confidence_score (0-1), heuristic_rule (string explicativa), recommended_aggregation.

**Heurísticas obrigatórias:**
- 1 categórica (card ≤50) + 1 métrica → bar chart
- 1 temporal + 1 métrica → line chart
- Categórica (card 2-8) + 1 métrica → pie/donut
- 2 métricas → scatter
- 1 categórica + 2+ métricas → grouped bar
- Múltiplas categóricas → treemap
- 1 métrica isolada → KPI card / radial bar
- 1 categórica + 3+ métricas → radar

**Critérios de aceitação:**
- [ ] Para CSV de vendas, sugere bar chart (vendas por departamento)
- [ ] Para CSV com coluna de data, sugere line chart
- [ ] Cada sugestão tem confidence_score e heuristic_rule explicativa
- [ ] Retorna até 12 sugestões ordenadas por confiança
- [ ] Nenhuma IA/LLM é usada — apenas regras determinísticas

**Arquivos a entregar:** `services/analytics/__init__.py`, endpoint em `api/analytics.py`.

---

### Prompt 3.2 — Dados Agregados para Gráficos (feito)
**Contexto:** Temos sugestões. Precisamos dos dados para renderizar.

**Tarefa:** Implemente `POST /analytics/chart-data` que recebe: file_uuid, sheet_name, chart_type, dimension_columns, metric_columns, aggregation (sum/avg/count/min/max), filters (opcional), limit. Executa query DuckDB com GROUP BY e agregação, retorna dados prontos para o gráfico.

**Critérios de aceitação:**
- [ ] Bar chart: GROUP BY dimensão, SUM métrica
- [ ] Line chart: GROUP BY data, SUM métrica, ORDER BY data
- [ ] Pie chart: GROUP BY categoria, SUM métrica
- [ ] Scatter: retorna pontos (x, y) sem agregação
- [ ] Filtros são aplicados na query (WHERE)
- [ ] Limit default 1000, max 10000
- [ ] Resposta contém: data[], dimensions[], metrics[], total_rows, applied_filters

---

### Prompt 3.3 — Componentes de Gráficos Recharts
**Contexto:** Backend retorna dados agregados. Frontend precisa renderizar.

**Tarefa:** Implemente wrappers Recharts completos para: BarChart (vertical/horizontal, stacked, grouped), LineChart (com/sem área), PieChart/DonutChart, ScatterChart, RadarChart, KPICard. Cada um deve ter: tooltip customizado rico, legenda interativa (clique para esconder série), responsividade, animação suave, empty state, loading state, botões de fullscreen e export PNG.

**Critérios de aceitação:**
- [ ] BarChart renderiza dados do backend corretamente
- [ ] Click na legenda esconde/mostra série
- [ ] Tooltip mostra valor formatado (moeda, percentual, número)
- [ ] Gráfico se adapta a container pai (ResponsiveContainer)
- [ ] Empty state quando data=[]
- [ ] Loading state com skeleton
- [ ] Fullscreen funciona (modal overlay)

**Arquivos a entregar:** `components/charts/bar-chart.tsx`, `line-chart.tsx`, `pie-chart.tsx`, `scatter-chart.tsx`, `radar-chart.tsx`, `kpi-card.tsx`, `chart-wrapper.tsx`.

---

## FASE 4: Dashboard Interativo

### Prompt 4.1 — Página de Dashboard com Sugestões
**Contexto:** Upload funciona, gráficos renderizam. Precisamos da página principal.

**Tarefa:** Implemente a página `/dashboard` que: (1) lê `?file={uuid}` da URL, (2) busca metadados do arquivo, (3) mostra seletor de abas se houver múltiplas, (4) busca sugestões de gráficos, (5) mostra cards de sugestão com preview, (6) ao clicar em uma sugestão, renderiza o gráfico correspondente com dados reais, (7) mostra KPIs resumidos (total de linhas, colunas, células vazias), (8) mostra relatório de integridade com warnings/erros.

**Critérios de aceitação:**
- [ ] Ao abrir `/dashboard?file={uuid}`, carrega metadados automaticamente
- [ ] Seletor de abas funciona (troca sheet_name)
- [ ] Cards de sugestão mostram título, descrição, tipo, confidence bar
- [ ] Click em sugestão renderiza gráfico real com dados do backend
- [ ] Relatório de integridade é exibido (hash, warnings, divergências)
- [ ] Se arquivo está inconsistente, mostra alerta visual prominente

---

### Prompt 4.2 — Sistema de Filtros Cross-Dashboard
**Contexto:** Dashboard mostra gráficos. Precisamos filtrar dados.

**Tarefa:** Implemente o painel de filtros avançados: adicionar filtro por coluna (select), operador (equals, contains, greater_than, less_than, between, is_null), valor (input). Filtros são aplicados em TODOS os widgets do dashboard simultaneamente. Mostrar breadcrumbs dos filtros ativos com opção de remover individual. Contador de linhas afetadas. Opção de salvar preset de filtros. Presets salvos aparecem como badges clicáveis.

**Critérios de aceitação:**
- [ ] Adicionar filtro "Departamento = Vendas" funciona
- [ ] Filtro é aplicado no gráfico ativo (dados recarregam)
- [ ] Filtro é aplicado na tabela (dados recarregam)
- [ ] Breadcrumb mostra cada filtro ativo com X para remover
- [ ] "Limpar todos" remove todos os filtros
- [ ] Salvar preset funciona e aparece na lista
- [ ] Click em preset aplica todos os filtros de uma vez

**Arquivos a entregar:** `components/filters/filter-panel.tsx`, integração com store Zustand.

---

## FASE 5: Tabela de Dados

### Prompt 5.1 — Tabela Virtualizada com Paginação Server-Side
**Contexto:** Precisamos visualizar os dados brutos.

**Tarefa:** Implemente `POST /analytics/table-data` que retorna dados paginados (page, page_size, sort_by, sort_direction, filters). No frontend, implemente tabela com: virtualização (TanStack Virtual ou similar), paginação server-side, ordenação por coluna, mostrar/ocultar colunas, formatação por tipo (moeda, data, número), e exportar visualização atual.

**Critérios de aceitação:**
- [ ] Tabela mostra 100 linhas por página, navegação funciona
- [ ] Ordenação por coluna faz request ao backend
- [ ] Colunas podem ser ocultadas via menu
- [ ] Células formatadas conforme tipo (R$ 1.234,56 para currency, 10,5% para percentage)
- [ ] Scroll em 100k linhas não trava (virtualização)
- [ ] Filtros ativos são aplicados na tabela

---

## FASE 6: Exportação e Layouts

### Prompt 6.1 — Exportação Multi-Formato
**Contexto:** Usuário quer baixar dados filtrados.

**Tarefa:** Implemente `POST /export` que recebe file_uuid, sheet_name, format (xlsx/csv/json/parquet), filters, visible_columns. Gera arquivo e retorna URL de download temporária. No frontend, botão de exportar em cada widget (gráfico PNG/SVG, dados XLSX/CSV).

**Critérios de aceitação:**
- [ ] Exportar dados filtrados para CSV funciona
- [ ] Exportar para XLSX preserva formatação básica
- [ ] Exportar gráfico como PNG funciona (html-to-image)
- [ ] Arquivos expiram após 24h
- [ ] Download é iniciado automaticamente no browser

---

### Prompt 6.2 — Layouts Salvos do Dashboard
**Contexto:** Usuário quer salvar configuração do dashboard.

**Tarefa:** Implemente drag-and-drop de widgets (react-grid-layout) com redimensionamento. Botão "Salvar Layout" persiste no PostgreSQL. Botão "Carregar Layout" restaura. Layout inclui: posição (x,y,w,h) de cada widget, tipo, config (colunas, agregação, filtros aplicados).

**Critérios de aceitação:**
- [ ] Widgets podem ser arrastados e redimensionados
- [ ] "Salvar Layout" persiste no banco
- [ ] Ao recarregar página, layout restaura automaticamente
- [ ] Múltiplos layouts podem ser salvos por arquivo
- [ ] Layout é responsivo (se adapta a largura da tela)

---

## FASE 7: Performance e Robustez

### Prompt 7.1 — Processamento Assíncrono com Progresso
**Contexto:** Arquivos grandes travam a requisição HTTP.

**Tarefa:** Integre Celery para processamento assíncrono. Upload retorna imediatamente com status="processing". Backend processa em background. Frontend consulta status via polling ou SSE. Barra de progresso mostra: etapa atual (uploading, hashing, reading, indexing, completed), percentual, linhas processadas.

**Critérios de aceitação:**
- [ ] Upload de arquivo grande retorna em <2s
- [ ] Status é consultável em tempo real
- [ ] Progresso mostra etapa atual e percentual
- [ ] Ao completar, frontend é notificado e redireciona
- [ ] Se falhar, mostra erro detalhado

---

### Prompt 7.2 — Testes End-to-End
**Contexto:** Sistema precisa ser confiável.

**Tarefa:** Crie testes automatizados: (1) backend — testes de integração para upload de cada formato, preservação de tipos, zeros à esquerda, datas ambíguas, fórmulas, merged cells, arquivos grandes; (2) frontend — testes de componentes (renderização de gráficos, filtros, tabela).

**Critérios de aceitação:**
- [ ] Teste: CSV com "00123" preserva como string
- [ ] Teste: XLSX com fórmulas detecta fórmulas
- [ ] Teste: XLSX com merged cells detecta merged cells
- [ ] Teste: Upload 100MB não estoura memória
- [ ] Teste: Inconsistência entre engines marca como inconsistente
- [ ] Suite de testes roda via `pytest` e `npm test`

---

## CHECKLIST FINAL (End-to-End)

Antes de considerar pronto, verifique:

- [ ] Usuário arrasta CSV → upload → vê dashboard em <10s
- [ ] Dashboard mostra sugestões de gráficos automaticamente
- [ ] Click em sugestão renderiza gráfico interativo
- [ ] Filtros aplicados atualizam gráfico e tabela simultaneamente
- [ ] Tabela mostra dados paginados com formatação correta
- [ ] Exportar para Excel funciona com dados filtrados
- [ ] Layout pode ser salvo e restaurado
- [ ] Tema claro/escuro funciona
- [ ] Responsivo em tablet e desktop
- [ ] Nenhum uso de IA/LLM em nenhuma parte do pipeline
- [ ] Toda lógica é determinística e auditável
- [ ] Build de produção funciona (`docker-compose up` sem dev mode)
