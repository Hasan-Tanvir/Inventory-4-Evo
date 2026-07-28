import React from 'react';
import { OrderItem, Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItemsGridProps {
  items: OrderItem[];
  products: Product[];
  orderType: 'dealer' | 'retail';
  inventorySource: 'dhaka' | 'chittagong' | 'mixed';
  onAddItem: () => void;
  onUpdateItem: (index: number, field: keyof OrderItem, value: any) => void;
  onRemoveItem: (index: number) => void;
  onUpdateSerials: (index: number, value: string) => void;
}

export const OrderItemsGrid: React.FC<OrderItemsGridProps> = ({
  items,
  products,
  orderType,
  inventorySource,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onUpdateSerials
}) => {
  if (!products || products.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sticky top-0 z-10 bg-white px-3 py-3 border-b border-slate-200">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Order Items ({items.length})
          </h3>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onAddItem} 
            className="h-8 px-3 border-slate-200 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Item
          </Button>
        </div>
        <div className="text-center py-8 text-slate-500">
          <p>No products available. Please add products from the Products page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm min-h-[260px]">
        <div className="sticky top-0 z-20 bg-white px-3 py-2 border-b border-slate-200 flex justify-end">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onAddItem} 
            className="h-8 px-3 border-slate-200 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Item
          </Button>
        </div>
        <div className="hidden sm:grid grid-cols-[1.6fr_0.55fr_0.55fr_0.75fr_1.1fr_0.5fr] gap-2 px-3 py-3 text-[10px] uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-[56px] z-10">
          <span>Product</span>
          <span className="text-center">Qty</span>
          <span className="text-center">Price</span>
          <span className="text-center">Total</span>
          <span>Serials</span>
          <span className="text-right">Action</span>
        </div>

        <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={index}
              className="px-3 py-2 border-b border-slate-100 text-xs space-y-2"
            >
              {/* Desktop Row */}
              <div className="hidden sm:grid grid-cols-[1.6fr_0.55fr_0.55fr_0.75fr_1.1fr_0.5fr] gap-2 items-center">
                <div className="space-y-2">
                  <Select 
                    value={item.productId} 
                    onValueChange={(v) => onUpdateItem(index, 'productId', v)}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-100">
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {inventorySource === 'mixed' && (
                    <Select 
                      value={item.location} 
                      onValueChange={(v: 'dhaka' | 'chittagong') => onUpdateItem(index, 'location', v)}
                    >
                      <SelectTrigger className="h-8 text-[10px] border-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dhaka" className="text-xs">Dhaka</SelectItem>
                        <SelectItem value="chittagong" className="text-xs">CTG</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Input 
                  type="number" 
                  value={item.quantity} 
                  onChange={(e) => onUpdateItem(index, 'quantity', Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const parent = e.currentTarget.closest('.sm\\:grid');
                      if (parent) {
                        const priceInput = parent.querySelector('input[type="number"]:nth-of-type(2)') as HTMLInputElement;
                        if (priceInput) priceInput.focus();
                      }
                    }
                  }}
                  className="h-9 text-xs border-slate-100 text-center"
                />

                <Input 
                  type="number" 
                  value={item.price} 
                  onChange={(e) => onUpdateItem(index, 'price', Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && index === items.length - 1) {
                      e.preventDefault();
                      onAddItem();
                    }
                  }}
                  className="h-9 text-xs border-slate-100 text-center"
                />

                <div className="text-slate-900 text-sm">
                  {item.total.toLocaleString()}
                </div>

                <Input
                  value={(item.serialNumbers || []).join(', ')}
                  onChange={(e) => onUpdateSerials(index, e.target.value)}
                  placeholder="Serials"
                  className="h-9 text-xs border-slate-100"
                />

                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onRemoveItem(index)}
                  className="text-slate-400 hover:text-red-500 h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile Layout */}
              <div className="sm:hidden space-y-2">
                {/* Product Selection */}
                <div>
                  <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Product</span>
                  <Select 
                    value={item.productId} 
                    onValueChange={(v) => onUpdateItem(index, 'productId', v)}
                  >
                    <SelectTrigger className="h-9 text-xs border-slate-100">
                      <SelectValue placeholder="Product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {inventorySource === 'mixed' && (
                    <Select 
                      value={item.location} 
                      onValueChange={(v: 'dhaka' | 'chittagong') => onUpdateItem(index, 'location', v)}
                    >
                      <SelectTrigger className="h-8 text-[10px] border-slate-100 mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dhaka" className="text-xs">Dhaka</SelectItem>
                        <SelectItem value="chittagong" className="text-xs">CTG</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Qty, Price, Total in one row */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Qty</span>
                    <Input 
                      type="number" 
                      value={item.quantity} 
                      onChange={(e) => onUpdateItem(index, 'quantity', Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const priceInput = e.currentTarget.parentElement?.parentElement?.querySelector('div:nth-child(2) input') as HTMLInputElement;
                          if (priceInput) priceInput.focus();
                        }
                      }}
                      className="h-8 text-xs border-slate-100 text-center"
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Price</span>
                    <Input 
                      type="number" 
                      value={item.price} 
                      onChange={(e) => onUpdateItem(index, 'price', Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && index === items.length - 1) {
                          e.preventDefault();
                          onAddItem();
                        }
                      }}
                      className="h-8 text-xs border-slate-100 text-center"
                    />
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Total</span>
                    <div className="h-8 flex items-center justify-center text-slate-900 text-sm border border-slate-100 rounded">
                      {item.total.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Serials and Action */}
                <div className="grid grid-cols-[1fr_40px] gap-2">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-400 mb-1">Serials</span>
                    <Input
                      value={(item.serialNumbers || []).join(', ')}
                      onChange={(e) => onUpdateSerials(index, e.target.value)}
                      placeholder="Serials"
                      className="h-8 text-xs border-slate-100"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onRemoveItem(index)}
                      className="text-slate-400 hover:text-red-500 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
};

export default OrderItemsGrid;
