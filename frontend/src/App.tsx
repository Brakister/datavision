import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { ChartsPage } from '@/pages/charts-page';
import { TablePage } from '@/pages/table-page';
import { FiltersPage } from '@/pages/filters-page';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<ChartsPage />} />
            <Route path="/charts" element={<ChartsPage />} />
            <Route path="/table" element={<TablePage />} />
            <Route path="/filters" element={<FiltersPage />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
