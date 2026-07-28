# 🏗️ Bicycle Inventory ERP System - Deep Dive Analysis

---

## 📋 Executive Summary

**Project:** Smart ERP System for Bicycle Inventory Management  
**Tech Stack:** React 19 + TypeScript + Vite + Supabase + Shadcn/Radix UI  
**Status:** Feature-rich application, but the current deployment model is still browser-first and is not yet a fully isolated multi-user SaaS architecture.
**Database:** PostgreSQL (Supabase) with localStorage fallback  

> Note: The app now syncs data to dedicated Supabase tables with row-level security enabled on each entity table.

---

## 🎯 Core Architecture

### 1. **State Management Hierarchy**

```
┌─────────────────────────────────────────────────────────────┐
│              App Component (Root)                          │
│  ├─ QueryClientProvider (React Query)                      │
│  ├─ TooltipProvider (Radix UI)                             │
│  ├─ TabStateProvider (Custom Context)                      │
│  ├─ HistoryProvider (Custom Context)                       │
│  ├─ Toast Systems (Sonner + Shadcn Toaster)               │
│  └─ BrowserRouter (18 Routes)                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. **Storage Architecture**

**Three-Tier Data Persistence:**

1. **Runtime Memory** → React State (immediate UI updates)
2. **Browser Storage** → localStorage (session persistence)
3. **Remote Backend** → Supabase PostgreSQL (distributed sync)

**Hybrid Sync Model:**
```typescript
// When Supabase is configured:
// Data flows: localStorage ←→ Supabase (async)
// 
// When Supabase is NOT configured:
// Data only persists in: localStorage (fallback mode)

isSupabaseConfigured = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY)
```

**Data Storage Tables (Supabase):**
- `profiles` - authenticated user profiles, admin/member roles, and app-specific metadata
- `products` - product catalog, stocks, slabs, and pricing
- `orders` - dealer and retail orders with invoice/quote metadata
- `dealers` - dealer contact data and current balances
- `officers` - sales officers, commissions, and clearance history
- `targets` - sales targets and reward state
- `payments` - payment receipts and dealer settlement records
- `retail_transactions` - retail sale transactions and adjustments
- `categories` - product categories
- `notifications` - per-user notifications and approval alerts
- `customization` - app branding and serial seed settings
- `product_stock_entries` / `product_stock_transfers` - stock movements
- `target_rewards` - reward payout history
- `counters` - serialized counter state for invoice/quote/payment numbering

---

## 🧩 Type System & Data Models

### **Core Entity Types:**

#### **User System**
```typescript
type Role = 'admin' | 'member'

interface User {
  id: string
  name: string
  password?: string
  role: Role
  photo?: string
  notificationsEnabled: boolean
  allowedTabs?: string[]  // Member-specific access control
  officerId?: string
}
```
- **Default Admin:** `id: 'admin'`, `password: 'whotheadmin'`
- **Member Defaults:** Limited to `/`, `/new-order`, `/orders`, `/invoices`, `/balance`, `/serial-search`, `/dealers`

#### **Product Model**
```typescript
interface Product {
  id: string
  name: string
  version: string
  categoryId: string
  retailPrice: number
  commission: number  // Per unit commission for officers
  status: 'active' | 'inactive'
  dhaka: number       // Stock in Dhaka warehouse
  chittagong: number  // Stock in Chittagong warehouse
  slabs: Slab[]       // Bulk pricing tiers
}

interface Slab {
  min: number
  max: number
  price: number
}
```

#### **Order Model** (Dual-mode)
```typescript
type OrderStatus = 'pending' | 'approved' | 'rejected'
type OrderType = 'dealer' | 'retail'

interface Order {
  id: string
  date: string
  type: OrderType
  status: OrderStatus
  customerName: string
  dealerId?: string           // For dealer orders
  customerPhone: string
  customerAddress: string
  officer: string             // Assigned sales officer
  items: OrderItem[]
  subtotal: number
  discount: number
  extra: number              // Additional charges
  netTotal: number
  notes: string
  createdBy: string
  approvedBy?: string
  isQuote: boolean           // Quote vs Invoice
  retailPaymentStatus?: 'paid' | 'unpaid'
  includePriceIncreaseInCommission?: boolean
  inventorySource: 'dhaka' | 'chittagong' | 'mixed'
  showSerialsOnInvoice: boolean
}

interface OrderItem {
  productId: string
  productName: string
  version: string
  quantity: number
  basePrice?: number
  price: number
  total: number
  location: 'dhaka' | 'chittagong'
  commission: number
  serialNumbers: string[]
}
```

#### **Commission & Target System**
```typescript
interface Officer {
  id: string
  name: string
  designation: string
  commissionBalance: number      // Current earned commission
  clearanceHistory: CommissionClearance[]
  commissionTokens?: CommissionToken[]
}

interface CommissionToken {
  id: string
  orderId: string
  date: string
  amount: number
  status: 'pending' | 'disbursed'
}

interface Target {
  id: string
  dealerId: string  // Can be 'all' for global targets
  dealerName: string
  type: 'amount' | 'quantity'  // Revenue or unit targets
  productIds: string[]  // Empty = all products
  targetValue: number
  currentValue: number
  startDate: string
  endDate: string
  rewardType: 'percentage' | 'fixed'
  rewardValue: number
  status: 'active' | 'achieved' | 'expired'
  assignedOfficerId?: string
  rewardedDealerIds?: string[]
  rewardDisbursed?: Record<string, number>  // Dealer ID → cycles count
}

interface TargetReward {
  id: string
  rewardRef: string  // Unique reference (TR-00001 format)
  targetId: string
  targetName: string
  dealerId: string
  dealerName: string
  officerId?: string
  officerName?: string
  date: string
  cycles: number     // Times this reward achieved
  amount: number
  paymentId: string
  note?: string
  status: 'active' | 'reversed'
}
```

#### **Dealer & Balance Model**
```typescript
interface Dealer {
  id: string
  name: string
  address: string
  phone: string
  officerName: string
  balance: number        // Amount owed/owing
  officerId?: string
}

interface Payment {
  id: string
  dealerId: string
  dealerName: string
  date: string
  type: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Purchase' | 'Adjustment'
  amount: number
  reference?: string
  notes?: string
}
```

#### **Stock Management**
```typescript
interface ProductStockEntry {
  id: string
  entryId?: string       // Batch ID (EN-0001 format)
  productId: string
  productName: string
  date: string
  location: 'dhaka' | 'chittagong'
  quantity: number
  note?: string
}

interface ProductStockTransfer {
  id: string
  transferId?: string    // Transfer reference (TR-0001 format)
  date: string
  productId: string
  productName: string
  from: 'dhaka' | 'chittagong'
  to: 'dhaka' | 'chittagong'
  quantity: number
  note?: string
}

interface SendAmountEntry {
  id: string
  date: string
  location: 'dhaka' | 'chittagong'
  amount: number
  note: string
}
```

---

## 🔄 Data Flow & Key Business Processes

### **1. Order Approval Workflow**

```
Create Order (pending)
    ↓
[Admin reviews]
    ↓
Approve Order
    ├─ Update order status → 'approved'
    ├─ Deduct inventory from selected location
    ├─ Update dealer balance (+netTotal)
    ├─ Generate commission token for officer
    ├─ Sync retail sales (if applicable)
    └─ Persist to localStorage & push to Supabase
    
OR

Reject Order
    └─ Update status → 'rejected' (no inventory impact)
```

### **2. Commission Calculation**

**For Approved Dealer Orders:**

```typescript
// Base commission
orderCommission = SUM(item.commission × item.quantity)

// Optional: Include price increase as commission
if (order.includePriceIncreaseInCommission) {
  priceIncrease = SUM((currentPrice - basePrice) × quantity)
  orderCommission += priceIncrease
}

// Add order-level extra amount
totalCommission = orderCommission + order.extra

// Store as "CommissionToken" (pending → disbursed workflow)
```

### **3. Target & Reward Management**

```
Create Target (global or per-dealer)
    ↓
[Track progress against currentValue]
    ↓
(Achievement Cycles Detected)
    ├─ Generate TargetReward record
    ├─ Create Payment entry
    ├─ Increment rewardDisbursed[dealerId]
    ├─ Link to officer (if assigned)
    └─ Status: 'active' (can be reversed later)

Undo Reward
    ├─ Delete linked payment
    ├─ Decrement rewardDisbursed count
    └─ Mark reward status: 'reversed'
```

### **4. Stock Management**

```
Add Stock Entry
    ├─ Create ProductStockEntry record
    ├─ Auto-generate entryId (EN-0001)
    ├─ Update product inventory
    │  └─ If Dhaka: product.dhaka += quantity
    │  └─ If Chittagong: product.chittagong += quantity
    └─ Persist to Supabase

Transfer Stock Between Locations
    ├─ Validate sufficient stock in source
    ├─ Deduct from source, add to destination
    ├─ Create ProductStockTransfer record
    ├─ Auto-generate transferId (TR-0001)
    └─ Persist changes
```

---

## 🌐 Context & State Management

### **TabStateContext** - Page-Level State Persistence

**Purpose:** Preserve page state when switching between tabs

```typescript
interface TabState {
  [tabPath: string]: Record<string, any>
}

// Usage Example:
// Save filters/search on /orders page
saveTabState('/orders', { 
  searchQuery: 'dealer1', 
  filterStatus: 'pending',
  sortBy: 'date'
})

// Get state when returning to page
const state = getTabState('/orders')
```

**Storage:** localStorage (key: `tabState`)

### **HistoryContext** - Activity Audit Trail

**Tracks:** Orders, Payments, Commissions, Stock changes, Customer actions, System events

```typescript
interface HistoryItem {
  id: string                    // HIS-${timestamp}
  type: 'order' | 'payment' | 'commission' | 'stock' | 'customer' | 'system'
  title: string
  description: string
  timestamp: string             // ISO date
  icon?: React.ReactNode
  metadata?: Record<string, any>
}

// Methods:
addHistoryItem(item)
clearHistory(type?)             // Clear by type or all
getHistoryByType(type)
```

---

## 📱 UI Component Architecture

### **ui/ Components** (Shadcn/Radix-based)

**30+ Pre-built Components:**
- Form Controls: `input`, `select`, `checkbox`, `radio-group`, `toggle`, `switch`
- Display: `card`, `badge`, `alert`, `skeleton`, `progress`, `chart`
- Dialogs: `dialog`, `alert-dialog`, `drawer`, `popover`, `hover-card`
- Navigation: `tabs`, `breadcrumb`, `navigation-menu`, `pagination`, `sidebar`
- Lists: `table`, `command`, `scroll-area`
- Menus: `context-menu`, `dropdown-menu`, `menubar`
- Layout: `separator`, `aspect-ratio`, `resizable`
- Notifications: `toast`, `toaster` (Sonner)
- Special: `carousel`, `calendar`, `slider`, `toggle-group`, `input-otp`

### **Custom Components**

| Component | Purpose |
|-----------|---------|
| `Layout.tsx` | Main app shell with sidebar + header + user profile |
| `AIAssistant.tsx` | Floating AI chat bot (simulated intelligence) |
| `OrderItemsGrid.tsx` | Reusable order items display |
| `CommissionTokensPanel.tsx` | Officer commission management UI |
| `ScrollableHistory.tsx` | Activity feed visualization |

### **Layout Structure**

```
┌──────────────────────────────────────────────────┐
│  Header (Notifications, User Menu)               │
│  ┌────────────────────────────────────────────┐  │
│  │ Sidebar (Desktop)     │   Page Content     │  │
│  │ 16 Menu Items         │                    │  │
│  │ User Profile          │   Dynamic Routes   │  │
│  │ Logout Button         │                    │  │
│  │                       │                    │  │
│  └────────────────────────────────────────────┘  │
│  Mobile: Hamburger Sheet Navigation              │
└──────────────────────────────────────────────────┘
```

---

## 🔐 Authentication & Authorization

**Authentication Model:**
- Simple ID/Password (stored in localStorage/Supabase)
- No external OAuth
- Session stored in `erp_session` key

**Authorization Model:**

| Role | Default Tabs | Capabilities |
|------|---|---|
| **admin** | All 16 tabs | Full system access, approve orders, manage all entities |
| **member** | 7 tabs | `/`, `/new-order`, `/orders`, `/invoices`, `/balance`, `/serial-search`, `/dealers` (restricted) |

**Custom Tab Access:**
- Admins define `allowedTabs` for each member
- Enforced on Layout component
- Member redirected to first allowed tab if accessing restricted path

---

## �_Routes & Pages (18 Total)

| Route | Component | Features | Access |
|-------|-----------|----------|--------|
| `/login` | Login.tsx | ID/password auth | All |
| `/` | Index.tsx | Dashboard, stats, AI assistant | Both |
| `/new-order` | NewOrder.tsx | Create/edit orders, quotes, commission calc | Both |
| `/new-order/:orderId` | NewOrder.tsx | Edit existing order | Both |
| `/orders` | Orders.tsx | List, filter, approve/reject, view details | Both |
| `/dealers` | Dealers.tsx | CRUD dealers, view balance, payment history | Admin |
| `/products` | Products.tsx | CRUD products, manage categories, pricing slabs | Admin |
| `/retail-sales` | RetailSales.tsx | Retail transaction logs, sync details | Admin |
| `/stock-balance` | StockBalance.tsx | Dual-location inventory, add stock, transfers | Admin |
| `/serial-search` | SerialSearch.tsx | Find items by serial number | Both |
| `/officers` | Officers.tsx | CRUD officers, commission tokens, clearance history | Admin |
| `/payments` | Payments.tsx | Record payments, track dealer dues | Admin |
| `/balance` | Balance.tsx | Dealer balance summary, aging analysis | Both |
| `/invoices` | Invoices.tsx | Generate/view invoices, export to HTML | Both |
| `/reports` | Reports.tsx | Sales analytics, dealer performance, commission reports | Admin |
| `/targets` | Targets.tsx | Create targets (global/per-dealer), track achievement | Admin |
| `/rewards` | Rewards.tsx | Manage target rewards, disbursement tracking | Admin |
| `/customization` | Customization.tsx | System branding, serial seeds, default amounts | Admin |
| `*` | NotFound.tsx | 404 error page | All |

---

## 🎯 Key Business Workflows

### **Workflow 1: Place & Approve Order**

```
1. Open /new-order
2. Select order type (dealer/retail)
3. Pick customer + products + quantities
4. System auto-calculates:
   - Slab pricing
   - Item totals
   - Subtotal
   - Discount
   - Shipping/extra charges
   - Net total
5. Add order notes
6. (Optional) Save as quote instead of invoice
7. Submit → status: pending
8. Admin receives notification
9. Admin opens /orders
10. Reviews order details
11. Approve → triggers:
    - Inventory deduction
    - Dealer balance update
    - Commission token generation
    - Retail sync (if applicable)
```

### **Workflow 2: Officer Commission Processing**

```
1. Officer earns commission from approved orders
2. Commission stored as "pending" tokens
3. Admin visits /officers
4. Views officer's commission balance
5. Selects token to disburse
6. Creates payment record
7. Token marked "disbursed"
8. Commission balance reduced
9. Payment logged with reference
10. (Optional) Reverse by deleting payment + resetting token
```

### **Workflow 3: Sales Target & Reward**

```
1. Admin creates target (amount or quantity-based)
2. Applies to all dealers or specific dealer
3. System tracks progress weekly/monthly
4. When achievement detected:
   - Auto-generate reward record
   - Calculate reward (fixed/percentage)
   - Create payment entry
   - Link to officer if assigned
5. Reward appears in audit trail
6. (Optional) Edit reward details or reverse
```

### **Workflow 4: Inventory Management**

```
Two-warehouse model (Dhaka + Chittagong):

Add Stock:
├─ Specify location, quantity, product, date, notes
├─ Auto-generate batch ID (EN-0001)
└─ Update product inventory

Transfer Between Locations:
├─ Select product, from/to locations, quantity
├─ Validate sufficient stock
├─ Auto-generate transfer ID (TR-0001)
├─ Update both locations
└─ Create audit trail

Consume Stock:
├─ Happens on order approval
├─ Deducted from order's inventory source
└─ Tracked in product.dhaka or product.chittagong
```

---

## 🔌 API Service Layer (`api.ts`)

**All data operations centralized through `api` object:**

### **Auth Methods**
- `login(id, password)` → User
- `getCurrentUser()` → User | null
- `getUsers()` → User[]
- `saveUser(user)` → void
- `deleteUser(id)` → void
- `logout()` → void

### **Order Methods**
- `getOrders()` → Order[]
- `getOrder(id)` → Order | undefined
- `getNextOrderId(isQuote)` → string (auto-generates R-0001, Q-0001)
- `placeOrder(order)` → void
- `deleteOrder(id)` → void
- `approveOrder(id, adminId)` → void (complex cascading logic)
- `rejectOrder(id)` → void

### **Product Methods**
- `getProducts()` → Product[]
- `saveProduct(product)` → Product
- `deleteProduct(id)` → void
- `getCategories()` → Category[]
- `saveCategory(category)` → void
- `deleteCategory(id)` → void

### **Inventory Methods**
- `getProductStockEntries()` → ProductStockEntry[]
- `saveProductStockEntry(entry, options?)` → void
- `getProductStockTransfers()` → ProductStockTransfer[]
- `saveProductStockTransfer(transfer)` → {success: boolean, message?: string}

### **Dealer Methods**
- `getDealers()` → Dealer[]
- `saveDealer(dealer)` → void
- `deleteDealer(id)` → void

### **Officer Methods**
- `getOfficers()` → Officer[]
- `saveOfficer(officer)` → void
- `deleteOfficer(id)` → void
- `disburseCommissionToken(officerId, tokenId, note?)` → {success: boolean}
- `updateClearance(officerId, clearance)` → void
- `deleteClearance(officerId, clearanceId)` → void

### **Target & Reward Methods**
- `getTargets()` → Target[]
- `saveTarget(target)` → void
- `deleteTarget(id)` → void
- `updateTargetProgress(targetId, value)` → void
- `checkAndDisburseRewards(targetId)` → {success: boolean, pendingCycles, rewardRef}
- `updateTargetReward(rewardId, updates)` → {success: boolean}
- `undoTargetReward(rewardId)` → {success: boolean}

### **Payment Methods**
- `getPayments()` → Payment[]
- `savePayment(payment)` → void
- `deletePayment(id)` → void

### **Utilities**
- `getDashboardStats()` → {monthlySales, pendingApprovals, totalOrders, chartData}
- `getConfig()` → Customization
- `saveConfig(config)` → void
- `getNotifications(userId)` → Notification[]

---

## 🛠️ Utilities & Helpers

### **Date Utilities** (`utils/date.ts`)

```typescript
getTodayISO()           // Returns YYYY-MM-DD
formatDisplayDate(date) // Returns DD-MMM-YYYY (e.g., "15-Apr-2026")
```

### **Class Utilities** (`lib/utils.ts`)

```typescript
cn(...inputs)           // Merge Tailwind classes (clsx + twMerge)
numberToWords(num)      // Convert 1234567 → "Twelve Lakh Thirty Four Thousand..."
                        // Supports Crore, Lakh, Thousand (Indian system)
```

### **Serial/Counter Generation**

```typescript
nextSerial(key, prefix)           // Generates: PREFIX-0001, PREFIX-0002, etc
nextSeedSerial(counterKey, seed)  // Custom seed parsing: "RX123" → RX0124
nextTargetRewardRef()             // Generates: TR-00001, TR-00002, etc
```

---

## 🎨 Customization System

**Editable System Configuration** (`Customization` type):

| Setting | Type | Purpose |
|---------|------|---------|
| `title` | string | App name in sidebar |
| `logo` | string | Logo URL |
| `sidebarColor` | string | Sidebar background color (hex) |
| `mainColor` | string | Primary accent color (hex) |
| `initialRetailAmount` | number | Default retail cash initial amount |
| `initialRetailAmountDhaka` | number | Dhaka-specific initial |
| `initialRetailAmountChittagong` | number | Chittagong-specific initial |
| `regards` | string | Invoice closing salutation |
| `execName` | string | Executive name for invoices |
| `execDetails` | string | Executive contact/designation |
| `customDetailText` | string | Custom invoice footer text |
| `customDetailHtml` | string | Custom HTML in footer |
| `customDetailBold` | boolean | Bold footer text |
| `customDetailItalic` | boolean | Italic footer text |
| `customDetailBoxed` | boolean | Box footer section |
| `orderSerialSeed` | string | Order number format (default: R00001) |
| `quoteSerialSeed` | string | Quote number format (default: Q00001) |
| `paymentReferenceSeed` | string | Payment ref format (default: P00001) |

**Editable via:** Admin → /customization page

---

## 📊 Dashboard Analytics

**Dashboard Statistics** (`getDashboardStats`):

```typescript
{
  monthlySales: number        // Sum of approved orders this month
  pendingApprovals: number    // Count of pending orders
  totalOrders: number         // All orders across time
  chartData: {                // Mock data for visualizations
    name: string              // "Day 1", "Day 2", etc
    sales: number             // Random sales for demo
  }[]
}
```

---

## 🤖 AI Assistant Component

**Location:** Floating button (bottom-right)  
**Status:** Simulated intelligence prototype

**Detects Keywords:**
- "sales" / "revenue" → Shows monthly sales + approved orders
- "pending" / "approval" → Shows count of pending orders
- "help" → Shows available commands
- "reminder" → Acknowledges and stores reminder

**Stack:**
- Real implementation ready for actual LLM/API integration

---

## 🔄 Data Sync Flow

### **Initialization Process:**

```typescript
1. App mounts
2. Detect if Supabase is configured
   if (VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY) {
3. Call initializeApiStorage()
4. Hydrate session from Supabase auth profile
5. Fetch data from each configured entity table
6. Populate localStorage and app state
```

### **Ongoing Sync:**

```typescript
Every api.set(key, value) call:
├─ localStorage.setItem(key, JSON.stringify(value))
└─ pushToRemote(key, value) [async, non-blocking]
    └─ supabase.from(mappedTable).delete() + insert(rows)

Every api.remove(key) call:
├─ localStorage.removeItem(key)
└─ removeFromRemote(key) [async, non-blocking]
    └─ supabase.from(mappedTable).delete()
```

**Error Handling:** Errors are logged to the console, and the app continues using localStorage as a fallback when necessary.

---

## 🚀 Performance & Scalability

### **Current Architecture Strengths:**
- ✅ Instant UI updates (localStorage-first)
- ✅ Works offline (falls back to localStorage)
- ✅ No complex caching layer needed
- ✅ Supabase handles persistence and auth

### **Potential Bottlenecks:**
- ⚠️ All data in single table → consider partitioning for high volume
- ⚠️ No pagination on getX() methods → pulls entire dataset
- ⚠️ AI Assistant is mock → needs real LLM backend

### **Scaling Recommendations:**
1. Implement pagination/virtualization for large lists
2. Add query builders for filtered data fetching
3. Implement proper error boundaries
4. Add request debouncing for rapid updates
5. Consider Redux/Zustand for complex state (if needed)

---

## 🐛 Notable Implementation Details

### **Commission Calculation Logic**

```typescript
// Key: includePriceIncreaseInCommission flag
// Allows officers to earn commission on markup/price increases

if (includePriceIncreaseInCommission) {
  priceIncrease = (currentPrice - basePrice) × quantity
  commission += priceIncrease  // Incentivize higher margins
}

// ALWAYS included: order-level extra/charges
commission += order.extra
```

### **Dealer Balance Tracking**

```typescript
// Dealer balance updates in TWO scenarios:

// 1. Order Approved (adds to balance)
dealer.balance += order.netTotal

// 2. Payment Recorded (reduces balance)
dealer.balance -= payment.amount

// Result: Positive = dealer owes, Negative = company owes dealer
```

### **Stock Deduction Timing**

```typescript
// Inventory is deducted ONLY on order approval
// Not on creation or quote → reduces over-booking risk

approveOrder() {
  order.items.forEach(item => {
    product[item.location] -= item.quantity
  })
}
```

### **User ID Normalization**

```typescript
// All comparisons use lowercase trim
normalizeUserId(id) = (id || '').trim().toLowerCase()

// Prevents duplicate users due to case sensitivity
```

---

## 📚 Dependencies Overview

### **Core Framework**
- `react@19.0+` - UI framework
- `typescript@5.x` - Static typing
- `react-router-dom@6.x` - Routing

### **State & Data**
- `@tanstack/react-query@5.x` - Server state (caching)
- Custom Context API (localStorage-based)

### **UI Components**
- `@radix-ui/*` (30+ packages) - Unstyled accessible components
- `shadcn-ui` - Pre-built component library
- `lucide-react` - Icons (200+ icons)
- `tailwindcss@3.x` - Utility-first CSS
- `recharts` - Charts & graphs

### **Forms & Validation**
- `react-hook-form@7.x` - Form state
- `@hookform/resolvers` - Schema validation bridges
- `zod` - Schema validation

### **Utilities**
- `date-fns@3.x` - Date manipulation
- `clsx` + `tailwind-merge` - Utility merging
- `cmdk` - Command palette

### **Backend**
- `@supabase/supabase-js@2.x` - Supabase client
- PostgreSQL (Supabase) - Database

### **Build & Dev**
- `vite@5.x` - Build tool
- `eslint` - Linting
- `postcss` - CSS processing

---

## 🎓 Architecture Patterns Used

| Pattern | Implementation | Benefit |
|---------|---|---|
| **Provider Pattern** | TabStateProvider, HistoryProvider | Centralized state without Redux |
| **Custom Hooks** | useTabState(), useHistory() | Encapsulated context logic |
| **Hybrid Storage** | localStorage + Supabase | Offline-first with sync |
| **Service Layer** | `api.ts` centralized CRUD | Single source of truth |
| **Serial Generation** | nextSerial() functions | Auto-incrementing IDs |
| **Fallback Mode** | isSupabaseConfigured checks | Graceful degradation |
| **Component Composition** | Shadcn + custom components | Reusable & maintainable |
| **Route-Based Splitting** | 18 separate page components | Code splitting friendly |

---

## 🔍 Code Quality Observations

**Strengths:**
1. ✅ Strong typing throughout (TypeScript)
2. ✅ Centralized API service (no scattered fetch calls)
3. ✅ Clear business logic separation
4. ✅ Accessible UI (Radix foundation)
5. ✅ Responsive design (Tailwind)
6. ✅ Comprehensive type definitions
7. ✅ Organized folder structure

**Areas for Improvement:**
1. ⚠️ Add error boundaries for React catch boundaries
2. ⚠️ Add loading/error states to all pages
3. ⚠️ Implement form validation feedback
4. ⚠️ Add activity/audit logging for compliance
5. ⚠️ Improve performance monitoring
6. ⚠️ Add unit tests for critical business logic
7. ⚠️ Implement rate limiting for API calls

---

## 📝 Summary of Key Takeaways

1. **Dual-Mode System:** Works with or without Supabase cloud backend
2. **Role-Based Access:** Admin vs Member with tab-level granularity
3. **Complex Commission Logic:** Tracks pending → disbursed workflow
4. **Dual-Location Inventory:** Separate stock tracking for 2 warehouses
5. **Target & Reward Engine:** Multi-tier achievement tracking system
6. **Invoice Generation:** Full billing cycle from quote to paid
7. **Audit Trail:** History tracking for all major operations
8. **Customizable:** Branding, serial formats, default values
9. **No External Auth:** Self-contained authentication
10. **Supabase-Agnostic:** Doesn't break if Supabase not configured

---

**Generated:** April 16, 2026  
**Format:** Markdown  
**Intended Audience:** Developers, stakeholders, technical leads
