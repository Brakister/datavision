import * as React from 'react';
import { useAppStore } from '@/stores';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  X,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { FilterOperator, ColumnSchema } from '@/types';

interface FilterPanelProps {
  columns: ColumnSchema[];
  onApplyFilters?: (filters: FilterOperator[]) => void;
}

export function FilterPanel({ columns, onApplyFilters }: FilterPanelProps) {
  const {
    activeFilters,
    addFilter,
    removeFilter,
    clearFilters,
    savedPresets,
    savePreset,
    deletePreset,
  } = useAppStore();

  const [isExpanded, setIsExpanded] = React.useState(true);
  const [newFilterColumn, setNewFilterColumn] = React.useState('');
  const [newFilterOperator, setNewFilterOperator] = React.useState('equals');
  const [newFilterValue, setNewFilterValue] = React.useState('');
  const [presetName, setPresetName] = React.useState('');
  const [showSavePreset, setShowSavePreset] = React.useState(false);

  const operatorOptions = [
    { value: 'equals', label: 'Igual a' },
    { value: 'not_equals', label: 'Diferente de' },
    { value: 'contains', label: 'Contem' },
    { value: 'not_contains', label: 'Nao contem' },
    { value: 'starts_with', label: 'Comeca com' },
    { value: 'ends_with', label: 'Termina com' },
    { value: 'greater_than', label: 'Maior que' },
    { value: 'less_than', label: 'Menor que' },
    { value: 'between', label: 'Entre' },
    { value: 'in', label: 'Em lista' },
    { value: 'is_null', label: 'Nulo' },
    { value: 'is_not_null', label: 'Nao nulo' },
  ];

  const handleAddFilter = () => {
    if (!newFilterColumn) return;
    const filter: FilterOperator = {
      column: newFilterColumn,
      operator: newFilterOperator as FilterOperator['operator'],
      value: newFilterValue,
    };
    addFilter(filter);
    setNewFilterValue('');
    onApplyFilters?.([...activeFilters, filter]);
  };

  const handleRemoveFilter = (index: number) => {
    removeFilter(index);
    onApplyFilters?.(activeFilters.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    clearFilters();
    onApplyFilters?.([]);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset({
      name: presetName,
      filters: [...activeFilters],
      created_at: new Date().toISOString(),
    });
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleLoadPreset = (preset: typeof savedPresets[0]) => {
    useAppStore.getState().setFilters(preset.filters);
    onApplyFilters?.(preset.filters);
  };

  const getOperatorLabel = (op: string) => {
    return operatorOptions.find((o) => o.value === op)?.label || op;
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Filtros Avancados</CardTitle>
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">{activeFilters.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {activeFilters.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearAll}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4">
              {/* Filtros ativos */}
              {activeFilters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Filtros Ativos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {activeFilters.map((filter, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          layout
                        >
                          <Badge variant="secondary" className="gap-1 pr-1">
                            <span className="font-medium">{filter.column}</span>
                            <span className="text-muted-foreground">{getOperatorLabel(filter.operator)}</span>
                            {filter.value !== undefined && filter.value !== '' && (
                              <span className="font-medium">{String(filter.value)}</span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 ml-1 hover:bg-destructive/20"
                              onClick={() => handleRemoveFilter(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              <Separator />

              {/* Adicionar filtro */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Adicionar Filtro
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Select
                    options={columns.map((c) => ({ value: c.name, label: c.name }))}
                    value={newFilterColumn}
                    onChange={(e) => setNewFilterColumn(e.target.value)}
                    className="text-xs"
                  />
                  <Select
                    options={operatorOptions}
                    value={newFilterOperator}
                    onChange={(e) => setNewFilterOperator(e.target.value)}
                    className="text-xs"
                  />
                  <Input
                    placeholder="Valor..."
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                    className="text-xs h-10"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                  />
                  <Button size="sm" onClick={handleAddFilter} className="h-10">
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Presets */}
              {savedPresets.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Presets Salvos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {savedPresets.map((preset) => (
                        <Badge
                          key={preset.name}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent gap-1"
                          onClick={() => handleLoadPreset(preset)}
                        >
                          {preset.name}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePreset(preset.name);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Salvar preset */}
              {activeFilters.length > 0 && (
                <div className="flex items-center gap-2">
                  {showSavePreset ? (
                    <>
                      <Input
                        placeholder="Nome do preset..."
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        className="text-xs h-8 flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                      />
                      <Button size="sm" className="h-8" onClick={handleSavePreset}>
                        <Save className="h-3 w-3 mr-1" />
                        Salvar
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowSavePreset(true)}>
                      <Save className="h-3 w-3 mr-1" />
                      Salvar como preset
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
