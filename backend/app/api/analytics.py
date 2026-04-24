"""Endpoints de analytics e graficos."""
from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query

from app.services.analytics import analytics_service
from app.schemas import ChartSuggestion, ChartDataRequest, ChartDataResponse, TableDataRequest, TableDataResponse

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/{file_uuid}/sheets/{sheet_name}/suggestions")
async def get_chart_suggestions(file_uuid: str, sheet_name: str) -> list[ChartSuggestion]:
    """Retorna sugestoes de graficos baseadas em heurísticas determinísticas."""
    suggestions = analytics_service.suggest_charts(file_uuid, sheet_name)
    return suggestions


@router.post("/chart-data", response_model=ChartDataResponse)
async def get_chart_data(request: ChartDataRequest):
    """Retorna dados agregados para renderizacao de grafico."""
    result = analytics_service.get_chart_data(
        file_uuid=request.file_uuid,
        sheet_name=request.sheet_name,
        chart_type=request.chart_type,
        dimension_columns=request.dimension_columns,
        metric_columns=request.metric_columns,
        aggregation=request.aggregation,
        filters=request.filters,
        limit=request.limit,
    )

    return ChartDataResponse(
        chart_type=result["chart_type"],
        dimensions=result["dimensions"],
        metrics=result["metrics"],
        data=result["data"],
        total_rows=result["total_rows"],
        applied_filters=result["applied_filters"],
        generated_at=result["generated_at"],
    )

@router.post("/{file_uuid}/chart-data", response_model=ChartDataResponse, include_in_schema=False)
async def get_chart_data_legacy(file_uuid: str, request: ChartDataRequest):
    del file_uuid
    return await get_chart_data(request)

@router.post("/table-data")
async def get_table_data(request: TableDataRequest):
    """Retorna dados paginados para tabela interativa."""
    result = analytics_service.get_table_data(
        file_uuid=request.file_uuid,
        sheet_name=request.sheet_name,
        page=request.page,
        page_size=request.page_size,
        sort_by=request.sort_by,
        sort_direction=request.sort_direction,
        filters=[f.model_dump() for f in request.filters],
        visible_columns=request.visible_columns,
    )

    return result

@router.post("/{file_uuid}/table-data", include_in_schema=False)
async def get_table_data_legacy(file_uuid: str, request: TableDataRequest):
    del file_uuid
    return await get_table_data(request)
