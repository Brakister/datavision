import { Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function FiltersPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Filter className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Filters</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Esta pagina esta em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
