import React, { useMemo } from 'react';
import { useHistory, HistoryItem } from '@/context/HistoryContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { formatDisplayDate } from '@/utils/date';
import { cn } from '@/lib/utils';

interface ScrollableHistoryProps {
  title?: string;
  filterType?: HistoryItem['type'];
  maxHeight?: string;
  compact?: boolean;
  onClearAll?: () => void;
}

const typeColors: Record<HistoryItem['type'], string> = {
  order: 'bg-blue-100 text-blue-800',
  payment: 'bg-green-100 text-green-800',
  commission: 'bg-orange-100 text-orange-800',
  stock: 'bg-purple-100 text-purple-800',
  customer: 'bg-pink-100 text-pink-800',
  system: 'bg-gray-100 text-gray-800',
};

const typeIcons: Record<HistoryItem['type'], string> = {
  order: '📦',
  payment: '💳',
  commission: '💰',
  stock: '📊',
  customer: '👤',
  system: '⚙️',
};

export const ScrollableHistory: React.FC<ScrollableHistoryProps> = ({ 
  title = 'Recent Activity',
  filterType,
  maxHeight = 'max-h-[500px]',
  compact = false,
  onClearAll
}) => {
  const { history, clearHistory, getHistoryByType } = useHistory();

  const displayHistory = useMemo(() => {
    const items = filterType ? getHistoryByType(filterType) : history;
    return items.slice(0, 100); // Limit to 100 items for performance
  }, [history, filterType, getHistoryByType]);

  if (displayHistory.length === 0) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400 text-sm">
            No activity yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader className={cn("bg-slate-50/50 border-b", compact ? "pb-2" : "pb-3")}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn("uppercase tracking-wider text-slate-600", compact ? "text-xs font-bold" : "text-sm font-bold")}>
            {title}
          </CardTitle>
          {onClearAll && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-slate-400 hover:text-slate-600"
              onClick={() => onClearAll()}
              title="Clear history"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <ScrollArea className={cn("border-t", maxHeight)}>
        <div className="divide-y divide-slate-100">
          {displayHistory.map((item, idx) => (
            <div 
              key={item.id}
              className={cn(
                "hover:bg-slate-50/50 transition-colors",
                compact ? "p-3" : "p-4"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "text-lg flex-shrink-0 mt-0.5",
                  compact && "text-base"
                )}>
                  {item.icon || typeIcons[item.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("text-[10px]", typeColors[item.type])}>
                      {item.type.toUpperCase()}
                    </Badge>
                    <span className={cn("font-semibold text-slate-900", compact ? "text-xs" : "text-sm")}>
                      {item.title}
                    </span>
                  </div>
                  <p className={cn("text-slate-600 mt-1", compact ? "text-[11px]" : "text-xs")}>
                    {item.description}
                  </p>
                  <div className={cn("text-slate-400 mt-1 flex items-center justify-between", compact ? "text-[10px]" : "text-[11px]")}>
                    <span>{formatDisplayDate(item.timestamp)}</span>
                    {item.metadata?.amount && (
                      <span className="font-bold text-slate-900">
                        {Number(item.metadata.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default ScrollableHistory;
