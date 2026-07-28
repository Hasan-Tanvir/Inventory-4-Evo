import React from 'react';
import { Officer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Wallet, RotateCcw, Check } from 'lucide-react';
import { formatDisplayDate } from '@/utils/date';
import { cn } from '@/lib/utils';

interface CommissionTokensPanel {
  officer: Officer;
  tokenNote: string;
  onTokenNoteChange: (note: string) => void;
  onDisburseToken: (officerId: string, tokenId: string) => void;
  onUndoDisburse: (officerId: string, tokenId: string) => void;
}

export const CommissionTokensPanel: React.FC<CommissionTokensPanel> = ({
  officer,
  tokenNote,
  onTokenNoteChange,
  onDisburseToken,
  onUndoDisburse
}) => {
  const tokens = (officer.commissionTokens || []).sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
  });
  const pendingTokens = tokens.filter(t => t.status === 'pending');
  const disbursedTokens = tokens.filter(t => t.status === 'disbursed');
  const totalPending = pendingTokens.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="bg-slate-50/50 border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Commission Tokens
            </CardTitle>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 text-[10px] font-bold">
              {totalPending.toLocaleString()}
            </Badge>
          </div>
          <Wallet className="w-4 h-4 text-slate-400" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {tokens.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No tokens generated yet
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2 pr-4">
              {/* Pending Tokens */}
              {pendingTokens.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">
                    Pending ({pendingTokens.length})
                  </div>
                  <div className="space-y-2">
                    {pendingTokens.map(token => (
                      <div
                        key={token.id}
                        className="bg-white border border-slate-100 rounded-lg p-3 hover:border-orange-200 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">{token.id}</div>
                            <div className="text-[10px] text-slate-500">
                              {formatDisplayDate(token.date)} | Order: {token.orderId}
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-[9px]">
                            PENDING
                          </Badge>
                        </div>
                        <div className="bg-slate-50 rounded px-2 py-1.5 mb-2 border border-slate-100">
                          <div className="text-[10px] font-bold text-slate-500 mb-0.5">Amount</div>
                          <div className="text-lg font-black text-orange-600">
                            {token.amount.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onDisburseToken(officer.id, token.id)}
                          className="w-full h-8 bg-orange-600 hover:bg-orange-700 text-white text-xs"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Disburse Token
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disbursed Tokens */}
              {disbursedTokens.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">
                    Disbursed ({disbursedTokens.length})
                  </div>
                  <div className="space-y-2">
                    {disbursedTokens.map(token => (
                      <div
                        key={token.id}
                        className="bg-white border border-slate-100 rounded-lg p-3 hover:border-green-200 transition-colors opacity-75"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="text-xs font-bold text-slate-900">{token.id}</div>
                            <div className="text-[10px] text-slate-500">
                              {formatDisplayDate(token.date)}
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-green-100 text-green-800 text-[9px]">
                            DISBURSED
                          </Badge>
                        </div>
                        <div className="bg-slate-50 rounded px-2 py-1.5 mb-2 border border-slate-100">
                          <div className="text-lg font-black text-green-600">
                            {token.amount.toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onUndoDisburse(officer.id, token.id)}
                          className="w-full h-8 text-slate-500 hover:text-slate-700 text-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Undo Disbursement
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Token Note Input */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <label className="text-[10px] font-bold uppercase text-slate-500">
            Disbursement Note (Optional)
          </label>
          <Input
            value={tokenNote}
            onChange={(e) => onTokenNoteChange(e.target.value)}
            placeholder="Add note for this disbursement..."
            className="h-8 text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default CommissionTokensPanel;
