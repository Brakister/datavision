# DataVision

> **Transforme Excel e CSV em Dashboards Interativos de Alta Performance**

Sistema full-stack determinístico, auditável e profissional para leitura, validação e visualização de dados tabulares. Zero uso de IA/LLM — toda a lógica é algorítmica, heurística e completamente transparente.

---

## Arquitetura

```
DataVision/
├── frontend/          # React 18 + TypeScript + Vite + Tailwind + Recharts
│   ├── src/
│   │   ├── components/    # UI, Charts, Filters, Tables, Layout
│   │   ├── pages/         # Upload, Dashboard, Charts, Table, Filters
│   │   ├── stores/        # Zustand (estado global)
│   │   ├── services/      # API clients (TanStack Query)
│   │   ├── types/         # TypeScript strict
│   │   └── utils/         # Utilitários
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── backend/           # Python 3.12 + FastAPI + Polars + DuckDB
│   ├── app/
│   │   ├── api/           # Endpoints REST
│   │   ├── core/          # Config, Logging, Exceptions
│   │   ├── models/        # SQLAlchemy (PostgreSQL)
│   │   ├── schemas/       # Pydantic v2
│   │   ├── services/      # Ingestion, Analytics, Validation, Export
│   │   ├── workers/       # Celery tasks
│   │   └── main.py        # App FastAPI
│   ├── requirements.txt
│   └── Dockerfile
│
├── infra/
│   └── docker-compose.yml   # PostgreSQL + Redis + Backend + Frontend
│
└── docs/              # Documentação
```

---

## Stack Tecnológica

### Frontend
- **React 18** com TypeScript strict
- **Vite** (build tool)
- **TailwindCSS** + shadcn/ui (design system)
- **Recharts** (gráficos interativos)
- **Zustand** (estado global)
- **TanStack Query** (cache e sincronização)
- **TanStack Table + Virtual** (tabelas virtuais)
- **react-dropzone** (upload)
- **Framer Motion** (animações)
- **react-grid-layout** (dashboard dinâmico)

### Backend
- **Python 3.12+**
- **FastAPI** + Uvicorn
- **Pydantic v2** (validação)
- **Polars** (engine principal de transformação)
- **Pandas** (compatibilidade)
- **python-calamine** (leitura rápida Excel)
- **openpyxl** (verificação estrutural xlsx)
- **pyxlsb** (arquivos .xlsb)
- **DuckDB** (consultas analíticas)
- **pyarrow** (interoperabilidade)
- **orjson** (serialização rápida)
- **Celery + Redis** (processamento assíncrono)
- **PostgreSQL** (metadados e auditoria)

---

## Funcionalidades

### Ingestão de Dados
- Suporte a `.xlsx`, `.xls`, `.xlsm`, `.xlsb`, `.csv`, `.tsv`, `.ods`
- Leitura multi-engine com validação cruzada
- Detecção de schema com preservação de tipos
- Relatório de integridade completo (hash, divergências, warnings)
- Modo estrito (bloqueia em inconsistências)
- Arquivos até 500MB

### Dashboard
- Heurísticas determinísticas para sugestão de gráficos
- Tipos suportados: bar, line, area, pie, donut, scatter, radar, treemap, funnel, radial_bar, KPI
- Tooltips customizados, legendas interativas, drill-down
- Filtros avançados cross-dashboard
- Tabelas virtuais com paginação server-side
- Layouts salvos e presets de filtros

### Confiabilidade
- **Determinístico**: mesma entrada → mesma saída
- **Auditável**: log de todas as transformações
- **Fail-fast**: falha explicitamente em vez de inferir silenciosamente
- **Zero IA**: nenhum LLM, embedding ou heurística probabilística opaca

---

## Quick Start

### Pré-requisitos
- Docker + Docker Compose
- Ou: Node.js 20+, Python 3.12+, PostgreSQL 16, Redis 7

### Com Docker (recomendado)

```bash
# Clonar o repositório
cd datavision

# Iniciar todos os serviços
docker-compose -f infra/docker-compose.yml up --build

# Acessar
# Frontend: http://localhost:5173
# API Docs: http://localhost:8000/docs
```

### Sem Docker

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

---

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/upload` | Upload de arquivo |
| GET | `/upload/{uuid}/status` | Status do processamento |
| GET | `/files/{uuid}/metadata` | Metadados completos |
| GET | `/files/{uuid}/sheets/{name}/schema` | Schema da aba |
| GET | `/analytics/{uuid}/sheets/{name}/suggestions` | Sugestões de gráficos |
| POST | `/analytics/chart-data` | Dados agregados para gráfico |
| POST | `/analytics/table-data` | Dados paginados para tabela |
| POST | `/layouts` | Salvar layout |
| GET | `/layouts?file_uuid=` | Listar layouts |
| POST | `/export` | Exportar dados |

Documentação completa em: `http://localhost:8000/docs` (Swagger/OpenAPI)

### Teste rapido de upload (curl)

```bash
# Upload CSV (deve retornar status=pending e file_uuid)
curl -X POST "http://localhost:8000/upload" \
	-F "file=@data/samples/vendas_rh.csv" \
	-F "strict_mode=false"

# Verificar status
curl "http://localhost:8000/upload/<FILE_UUID>/status"
```

### Teste no Postman

1. Metodo: POST
2. URL: `http://localhost:8000/upload`
3. Body: form-data
4. Campo `file`: tipo File (CSV/XLSX/TSV/ODS)
5. Campo `strict_mode`: `true` ou `false`
6. Enviar e validar retorno com `file_uuid`, `file_size_bytes` e `status=pending`

---

## Heurísticas de Sugestão de Gráficos

Todas as sugestões são determinísticas e auditáveis:

| Regra | Condição | Gráfico |
|-------|----------|---------|
| `categorical_1_metric_1` | 1 dimensão categórica (card ≤50) + 1 métrica | Bar Chart |
| `temporal_1_metric_1` | 1 coluna temporal + 1 métrica | Line Chart |
| `temporal_1_metric_1_area` | 1 coluna temporal + 1 métrica | Area Chart |
| `low_cardinality_pie` | Categoria cardinalidade 2-8 + 1 métrica | Pie Chart |
| `low_cardinality_donut` | Categoria cardinalidade 2-8 + 1 métrica | Donut Chart |
| `two_metrics_scatter` | 2 métricas numéricas | Scatter Plot |
| `multi_metric_grouped_bar` | 1 categoria + múltiplas métricas | Grouped Bar |
| `hierarchy_treemap` | Múltiplas colunas categóricas | Treemap |
| `single_kpi_radial` | 1 métrica isolada | Radial Bar |
| `single_kpi_card` | 1 métrica isolada | KPI Card |
| `multi_metric_radar` | 1 categoria + 3+ métricas | Radar Chart |

---

## Testes

```bash
# Backend
cd backend
pytest app/tests/ -v

# Frontend
cd frontend
npm run lint
```

---

## Licença

MIT

---

## Autor

DataVision Team
