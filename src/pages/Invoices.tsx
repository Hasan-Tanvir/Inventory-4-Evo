"use client";

import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { api } from '@/services/api';
import { Order, Customization, User, Dealer } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, FileText, Download } from 'lucide-react';
import { generateInvoiceHtml, printDoc } from '@/utils/invoice-generator';
import html2pdf from 'html2pdf.js';
import { cn } from '@/lib/utils';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

const Invoices = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [config, setConfig] = useState<Customization | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [dealers, setDealers] = useState<Dealer[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const user = api.getCurrentUser();
      setCurrentUser(user);
      setOrders(await api.getOrders());
      setConfig(await api.getCustomization());
      setDealers(await api.getDealers());
    };
    loadData();
  }, []);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const isDocumentQuote = (o: Order) => !!o.isQuote;

  const visibleOrders = currentUser?.role === 'member'
    ? orders.filter(o => {
        const dealer = dealers.find(d => d.id === o.dealerId);
        return dealer && (dealer.officerId === currentUser.officerId || dealer.officerName === currentUser.name);
      })
    : orders;

  const handlePrint = () => {
    if (selectedOrder && config) {
      const html = generateInvoiceHtml(selectedOrder, isDocumentQuote(selectedOrder), config);
      printDoc(html);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedOrder || !config) return;
    const html = generateInvoiceHtml(selectedOrder, isDocumentQuote(selectedOrder), config);
    const element = document.createElement('div');
    element.innerHTML = html;
    
    if (Capacitor.isNativePlatform()) {
      try {
        // First, generate the PDF blob using html2pdf
        const pdfBlob = await html2pdf().set({
          margin: 10,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(element).output('blob');

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          const fileName = `${selectedOrder.id}.pdf`;
          
          // Write file to filesystem
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });

          // Share the file
          await Share.share({
            title: fileName,
            text: isDocumentQuote(selectedOrder) ? 'Quotation' : 'Invoice',
            url: savedFile.uri,
            dialogTitle: `Share ${isDocumentQuote(selectedOrder) ? 'Quotation' : 'Invoice'}`,
          });
        };
      } catch (error) {
        console.error('Error sharing PDF:', error);
      }
    } else {
      // Web version
      await html2pdf().set({
        margin: 10,
        filename: `${selectedOrder.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element).save();
    }
  };

  const filteredBySearch = visibleOrders.filter(o => 
    o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice().reverse();

  return (
    <Layout>
      <div className="space-y-6 no-print">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Document Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 relative">
              <label className="text-xs font-bold uppercase text-slate-500">Search Invoice or Quotation</label>
              <div className="relative">
                <Input
                  className="h-11 rounded-xl pr-10"
                  placeholder="Search by ID or Customer Name..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    if (!e.target.value) setSelectedOrderId('');
                  }}
                />
                {searchTerm && filteredBySearch.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    {filteredBySearch.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSelectedOrderId(o.id);
                          setSearchTerm(`${o.id} - ${o.customerName}`);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-3 text-xs hover:bg-slate-50 border-b last:border-0 flex justify-between items-center",
                          selectedOrderId === o.id && "bg-blue-50"
                        )}
                      >
                        <div>
                          <span className={isDocumentQuote(o) ? "text-orange-600 font-bold" : "text-blue-600 font-bold"}>
                            {isDocumentQuote(o) ? '[QUOTE]' : '[INV]'}
                          </span>
                          <span className="ml-2 font-bold text-slate-800">{o.id}</span>
                          <div className="text-slate-500 mt-0.5">{o.customerName}</div>
                        </div>
                        <div className="text-right font-bold text-slate-900">{o.netTotal.toLocaleString()}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} disabled={!selectedOrder} className="h-11 px-4 bg-slate-900 hover:bg-slate-800 gap-2">
                <Printer className="w-4 h-4" /> Print
              </Button>
              <Button onClick={handleDownloadPdf} disabled={!selectedOrder} variant="outline" className="h-11 px-4 gap-2">
                <Download className="w-4 h-4" /> Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedOrder && config ? (
          <div className="mt-8 flex justify-center bg-slate-100 p-3 md:p-6 rounded-2xl border-2 border-dashed border-slate-200 overflow-auto">
            <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] md:scale-90 lg:scale-100 sm:scale-[0.65] scale-[0.45] origin-top mx-auto">
              <div dangerouslySetInnerHTML={{ __html: generateInvoiceHtml(selectedOrder, isDocumentQuote(selectedOrder), config) }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <FileText className="w-16 h-16 text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium">Select a document from the dropdown to preview</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Invoices;
