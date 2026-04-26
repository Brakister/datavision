import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  FileMetadata,
  FileStatus,
  FilterOperator,
  FilterPreset,
  DashboardLayout,
  WidgetLayout,
  ChartSuggestion,
} from '@/types';

type UploadSessionState = {
  fileUuid: string | null;
  fileName: string;
  fileSizeBytes: number;
  strictMode: boolean;
  status: 'idle' | FileStatus;
  stage: string;
  progress: number;
  message: string;
  updatedAt: string | null;
};

interface AppState {
  // Tema
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Arquivo atual
  currentFile: FileMetadata | null;
  setCurrentFile: (file: FileMetadata | null) => void;

  // Aba selecionada
  selectedSheet: string | null;
  setSelectedSheet: (sheet: string | null) => void;

  // Upload em andamento
  uploadDraftFile: File | null;
  setUploadDraftFile: (file: File | null) => void;
  uploadDraftStrictMode: boolean;
  setUploadDraftStrictMode: (value: boolean) => void;
  uploadSession: UploadSessionState | null;
  setUploadSession: (session: UploadSessionState | null) => void;
  updateUploadSession: (updates: Partial<NonNullable<UploadSessionState>>) => void;
  clearUploadSession: () => void;

  // Filtros ativos
  activeFilters: FilterOperator[];
  addFilter: (filter: FilterOperator) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
  setFilters: (filters: FilterOperator[]) => void;

  // Presets de filtro
  savedPresets: FilterPreset[];
  savePreset: (preset: FilterPreset) => void;
  deletePreset: (name: string) => void;

  // Layout do dashboard
  currentLayout: WidgetLayout[];
  setLayout: (layout: WidgetLayout[]) => void;
  addWidget: (widget: WidgetLayout) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<WidgetLayout>) => void;

  // Layouts salvos
  savedLayouts: DashboardLayout[];
  saveLayout: (layout: DashboardLayout) => void;

  // Sugestoes de graficos
  chartSuggestions: ChartSuggestion[];
  setChartSuggestions: (suggestions: ChartSuggestion[]) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;

  // Loading global
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Notificacoes
  notifications: Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }>;
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        theme: 'dark',
        toggleTheme: () =>
          set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            return { theme: newTheme };
          }),

        currentFile: null,
        setCurrentFile: (file) => set({ currentFile: file }),

        selectedSheet: null,
        setSelectedSheet: (sheet) => set({ selectedSheet: sheet }),

        uploadDraftFile: null,
        setUploadDraftFile: (file) => set({ uploadDraftFile: file }),

        uploadDraftStrictMode: false,
        setUploadDraftStrictMode: (value) => set({ uploadDraftStrictMode: value }),

        uploadSession: null,
        setUploadSession: (session) => set({ uploadSession: session }),
        updateUploadSession: (updates) =>
          set((state) => ({
            uploadSession: state.uploadSession ? { ...state.uploadSession, ...updates } : state.uploadSession,
          })),
        clearUploadSession: () => set({ uploadSession: null, uploadDraftFile: null, uploadDraftStrictMode: false }),

        activeFilters: [],
        addFilter: (filter) =>
          set((state) => ({
            activeFilters: [...state.activeFilters.filter((f) => f.column !== filter.column), filter],
          })),
        removeFilter: (index) =>
          set((state) => ({
            activeFilters: state.activeFilters.filter((_, i) => i !== index),
          })),
        clearFilters: () => set({ activeFilters: [] }),
        setFilters: (filters) => set({ activeFilters: filters }),

        savedPresets: [],
        savePreset: (preset) =>
          set((state) => ({
            savedPresets: [...state.savedPresets.filter((p) => p.name !== preset.name), preset],
          })),
        deletePreset: (name) =>
          set((state) => ({
            savedPresets: state.savedPresets.filter((p) => p.name !== name),
          })),

        currentLayout: [],
        setLayout: (layout) => set({ currentLayout: layout }),
        addWidget: (widget) =>
          set((state) => ({
            currentLayout: [...state.currentLayout, widget],
          })),
        removeWidget: (id) =>
          set((state) => ({
            currentLayout: state.currentLayout.filter((w) => w.id !== id),
          })),
        updateWidget: (id, updates) =>
          set((state) => ({
            currentLayout: state.currentLayout.map((w) =>
              w.id === id ? { ...w, ...updates } : w
            ),
          })),

        savedLayouts: [],
        saveLayout: (layout) =>
          set((state) => ({
            savedLayouts: [...state.savedLayouts.filter((l) => l.id !== layout.id), layout],
          })),

        chartSuggestions: [],
        setChartSuggestions: (suggestions) => set({ chartSuggestions: suggestions }),

        sidebarCollapsed: false,
        mobileSidebarOpen: false,
        toggleSidebar: () =>
          set((state) => {
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
            if (isMobile) {
              return { mobileSidebarOpen: !state.mobileSidebarOpen };
            }
            return { sidebarCollapsed: !state.sidebarCollapsed };
          }),
        setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),

        isLoading: false,
        setIsLoading: (loading) => set({ isLoading: loading }),

        notifications: [],
        addNotification: (notification) =>
          set((state) => ({
            notifications: [
              ...state.notifications,
              { ...notification, id: crypto.randomUUID() },
            ],
          })),
        removeNotification: (id) =>
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          })),
      }),
      {
        name: 'datavision-store',
        partialize: (state) => ({
          theme: state.theme,
          currentFile: state.currentFile,
          selectedSheet: state.selectedSheet,
          uploadDraftStrictMode: state.uploadDraftStrictMode,
          savedPresets: state.savedPresets,
          savedLayouts: state.savedLayouts,
          uploadSession: state.uploadSession,
          sidebarCollapsed: state.sidebarCollapsed,
          mobileSidebarOpen: state.mobileSidebarOpen,
        }),
      }
    )
  )
);
