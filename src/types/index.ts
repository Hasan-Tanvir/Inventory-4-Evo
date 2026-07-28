export type Role = 'admin' | 'member';
export type OrderStatus = 'pending' | 'approved' | 'rejected';
export type TargetType = 'amount' | 'quantity';
export type RetailTransactionType = 'sale' | 'adjustment' | 'expense' | 'sent_to_main' | 'other';

export interface User {
  id: string;
  authUserId?: string;
  email?: string;
  name: string;
  password?: string;
  role: Role;
  photo?: string;
  notificationsEnabled: boolean;
  allowedTabs?: string[];
  mobileQuickTabs?: string[];
  officerId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'approval' | 'system' | 'reminder';
  read: boolean;
  timestamp: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Slab {
  title?: string;
  min: number;
  max: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  version: string;
  categoryId: string;
  retailPrice: number;
  commission: number;
  status: 'active' | 'inactive';
  dhaka: number;
  chittagong: number;
  slabs: Slab[];
  sortOrder?: number;
}

export interface ProductStockEntry {
  id: string;
  entryId?: string;
  batchId?: string;
  productId: string;
  productName: string;
  date: string;
  location: 'dhaka' | 'chittagong';
  quantity: number;
  note?: string;
}

export interface ProductStockTransfer {
  id: string;
  transferId?: string;
  date: string;
  productId: string;
  productName: string;
  from: 'dhaka' | 'chittagong';
  to: 'dhaka' | 'chittagong';
  quantity: number;
  note?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  version: string;
  quantity: number;
  basePrice?: number;
  price: number;
  total: number;
  location: 'dhaka' | 'chittagong';
  commission: number;
  serialNumbers: string[];
}

export interface OrderShippingDetail {
  shippingDate?: string;
  parcelName?: string;
  parcelId?: string;
  isComplete: boolean;
  completedAt?: string;
  status?: 'pending' | 'in_progress' | 'hold' | 'cancelled' | 'completed';
}

export interface Order {
  id: string;
  date: string;
  type: 'dealer' | 'retail';
  status: OrderStatus;
  customerName: string;
  dealerId?: string;
  customerPhone: string;
  customerAddress: string;
  officer: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  extra: number;
  netTotal: number;
  notes: string;
  mainOrderId?: string;
  createdBy: string;
  approvedBy?: string;
  isQuote: boolean;
  retailPaymentStatus?: 'paid' | 'unpaid' | 'partial';
  partialAmount?: number;
  retailPaymentDate?: string;
  paymentReference?: string;
  includePriceIncreaseInCommission?: boolean;
  inventorySource: 'dhaka' | 'chittagong' | 'mixed';
  showSerialsOnInvoice: boolean;
  shipping?: OrderShippingDetail;
}

export interface Dealer {
  id: string;
  name: string;
  address: string;
  phone: string;
  officerName: string;
  balance: number;
  officerId?: string;
}

export interface CommissionClearance {
  id: string;
  date: string;
  amount: number;
  note: string;
}

export interface CommissionToken {
  id: string;
  orderId: string;
  date: string;
  amount: number;
  status: 'pending' | 'disbursed';
  disbursedDate?: string;
}

export interface Officer {
  id: string;
  name: string;
  phone?: string;
  designation: string;
  commissionBalance: number;
  clearanceHistory: CommissionClearance[];
  commissionTokens?: CommissionToken[];
}

export interface Payment {
  id: string;
  dealerId: string;
  dealerName: string;
  date: string;
  type: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Purchase' | 'Adjustment' | 'Last balance Due';
  amount: number;
  reference?: string;
  notes?: string;
}

export interface Target {
  id: string;
  name?: string;
  dealerId: string; // 'all' for global
  dealerName: string;
  type: TargetType;
  productIds: string[]; // Empty for all products
  targetValue: number;
  currentValue: number;
  startDate: string;
  endDate: string;
  rewardType: 'percentage' | 'fixed';
  rewardValue: number;
  status: 'active' | 'achieved' | 'expired';
  assignedOfficerId?: string;
  rewardedDealerIds?: string[];
  rewardDisbursed?: Record<string, number>;
}

export interface TargetReward {
  id: string;
  rewardRef: string;
  targetId: string;
  targetName: string;
  dealerId: string;
  dealerName: string;
  officerId?: string;
  officerName?: string;
  date: string;
  cycles: number;
  amount: number;
  paymentId: string;
  note?: string;
  status: 'active' | 'reversed';
}

export interface SendAmountEntry {
  id: string;
  date: string;
  location: 'dhaka' | 'chittagong';
  amount: number;
  note: string;
}

export interface RetailTransaction {
  id: string;
  orderId?: string;
  date: string;
  detail: string;
  amount: number;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  paidAmount?: number;
  location: 'dhaka' | 'chittagong';
  type: RetailTransactionType;
}

export interface Customization {
  title: string;
  logo: string;
  sidebarColor: string;
  mainColor: string;
  initialRetailAmount: number;
  initialRetailAmountDhaka?: number;
  initialRetailAmountChittagong?: number;
  regards: string;
  execName: string;
  execDetails: string;
  customDetailText?: string;
  customDetailHtml?: string;
  customDetailBold?: boolean;
  customDetailItalic?: boolean;
  customDetailBoxed?: boolean;
  orderSerialSeed?: string;
  quoteSerialSeed?: string;
  paymentReferenceSeed?: string;
  parcelNames?: string[];
}