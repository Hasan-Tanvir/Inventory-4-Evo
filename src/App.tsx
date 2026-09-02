import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TabStateProvider } from "@/context/TabStateContext";
import { HistoryProvider } from "@/context/HistoryContext";
import Index from "./pages/Index";
import NewOrder from "./pages/NewOrder";
import Orders from "./pages/Orders";
import Dealers from "./pages/Dealers";
import Products from "./pages/Products";
import RetailSales from "./pages/RetailSales";
import StockBalance from "./pages/StockBalance";
import Reports from "./pages/Reports";
import Customization from "./pages/Customization";
import SerialSearch from "./pages/SerialSearch";
import Officers from "./pages/Officers";
import Payments from "./pages/Payments";
import Balance from "./pages/Balance";
import Calendar from "./pages/Calendar";
import Invoices from "./pages/Invoices";
import Targets from "./pages/Targets";
import Rewards from "./pages/Rewards";
import Quotes from "./pages/Quotes";
import CentralStock from "./pages/CentralStock";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TabStateProvider>
        <HistoryProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Index />} />
              <Route path="/new-order" element={<NewOrder />} />
              <Route path="/new-order/:orderId" element={<NewOrder />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/dealers" element={<Dealers />} />
              <Route path="/products" element={<Products />} />
              <Route path="/retail-sales" element={<RetailSales />} />
              <Route path="/stock-balance" element={<StockBalance />} />
              <Route path="/serial-search" element={<SerialSearch />} />
              <Route path="/officers" element={<Officers />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/balance" element={<Balance />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/targets" element={<Targets />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/customization" element={<Customization />} />
              <Route path="/central-stock" element={<CentralStock />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </HistoryProvider>
      </TabStateProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
