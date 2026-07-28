import { 
  User, Product, Order, Dealer, Target, Notification, 
  Customization, Category, Officer, Payment, RetailTransaction,
  ProductStockEntry, ProductStockTransfer, TargetReward, SendAmountEntry
} from '../types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getTodayISO, getCurrentTimestamp } from '@/utils/date';

const KEYS = {
  USERS: 'erp_users',
  PRODUCTS: 'erp_products',
  ORDERS: 'erp_orders',
  DEALERS: 'erp_dealers',
  TARGETS: 'erp_targets',
  NOTIFICATIONS: 'erp_notifications',
  RETAIL: 'erp_retail',
  CONFIG: 'erp_config',
  SESSION: 'erp_session',
  CATEGORIES: 'erp_categories',
  OFFICERS: 'erp_officers',
  PAYMENTS: 'erp_payments',
  PRODUCT_STOCK_ENTRIES: 'erp_product_stock_entries',
  PRODUCT_STOCK_TRANSFERS: 'erp_product_stock_transfers',
  PRODUCT_STOCK_ENTRY_COUNTER: 'erp_product_stock_entry_counter',
  PRODUCT_STOCK_TRANSFER_COUNTER: 'erp_product_stock_transfer_counter',
  TARGET_REWARDS: 'erp_target_rewards',
  TARGET_REWARD_COUNTER: 'erp_target_reward_counter',
  ORDER_INVOICE_COUNTER: 'erp_order_invoice_counter',
  ORDER_QUOTE_COUNTER: 'erp_order_quote_counter',
  PAYMENT_REFERENCE_COUNTER: 'erp_payment_reference_counter',
  SEND_AMOUNTS: 'erp_send_amounts'
};

const TABLE_MAP: Record<string, string> = {
  [KEYS.USERS]: 'profiles',
  [KEYS.PRODUCTS]: 'products',
  [KEYS.ORDERS]: 'orders',
  [KEYS.DEALERS]: 'dealers',
  [KEYS.TARGETS]: 'targets',
  [KEYS.NOTIFICATIONS]: 'notifications',
  [KEYS.RETAIL]: 'retail_transactions',
  [KEYS.CONFIG]: 'customization',
  [KEYS.CATEGORIES]: 'categories',
  [KEYS.OFFICERS]: 'officers',
  [KEYS.PAYMENTS]: 'payments',
  [KEYS.PRODUCT_STOCK_ENTRIES]: 'product_stock_entries',
  [KEYS.PRODUCT_STOCK_TRANSFERS]: 'product_stock_transfers',
  [KEYS.TARGET_REWARDS]: 'target_rewards',
  [KEYS.SEND_AMOUNTS]: 'send_amounts'
};

const COUNTER_KEYS = new Set([
  KEYS.PRODUCT_STOCK_ENTRY_COUNTER,
  KEYS.PRODUCT_STOCK_TRANSFER_COUNTER,
  KEYS.TARGET_REWARD_COUNTER,
  KEYS.ORDER_INVOICE_COUNTER,
  KEYS.ORDER_QUOTE_COUNTER,
  KEYS.PAYMENT_REFERENCE_COUNTER
]);

const SYNCED_KEYS = Object.values(KEYS);
const isReady = () => isSupabaseConfigured && !!supabase;

const get = <T>(key: string, def: T): T => {
  const val = localStorage.getItem(key);
  try {
    const parsed = val ? JSON.parse(val) : def;
    // Enforce array return if default is an array
    if (Array.isArray(def) && !Array.isArray(parsed)) return def;
    return parsed;
  } catch {
    return def;
  }
};

const setLocal = (key: string, val: any) => {
  localStorage.setItem(key, JSON.stringify(val));
};

const isSchemaFallbackError = (error: any) => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('does not exist')
    || message.includes('column')
    || message.includes('relation')
    || message.includes('permission denied');
};

const retry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) break;
      const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

const getRemote = async <T>(key: string, def: T): Promise<T> => {
  if (!isReady()) {
    const local = get(key, def);
    return local;
  }
  
  const table = TABLE_MAP[key];
  if (COUNTER_KEYS.has(key)) {
    try {
      const { data } = await retry(() => 
        supabase!.from('counters').select('*').eq('key', key).maybeSingle()
      );
      if (data) {
        setLocal(key, data.value);
        return data.value as T;
      }
    } catch (e) {
      console.error(`Error fetching counter ${key}:`, e);
    }
    return get(key, def);
  }

  if (!table) return get(key, def);

  try {
    const { data, error } = await retry(() => 
      supabase!.from(table).select('*')
    );
    if (error) {
      if (error.code !== '42P01') { // 42P01 is Postgres for "table does not exist"
        console.error(`Error fetching remote data for ${key}:`, error.message);
      }
      return Array.isArray(def) ? (def as T) : get(key, def);
    }
    if (!data || !Array.isArray(data)) return Array.isArray(def) ? (def as T) : get(key, def);

    let mappedData: any = data;
    if (key === KEYS.USERS) {
      mappedData = data.map(row => ({
        id: row.id,
        authUserId: row.auth_user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        notificationsEnabled: row.notifications_enabled,
        allowedTabs: row.allowed_tabs || [],
        mobileQuickTabs: row.mobile_quick_tabs || [],
        officerId: row.officer_id || ''
      }));
    } else if (key === KEYS.CONFIG) {
      const row = data.find(r => r.id === 'global');
      const localConfig = get(KEYS.CONFIG, def) as Partial<Customization>;
      const baseConfig = { ...(def as any), ...(localConfig || {}) };

      if (row) {
        mappedData = {
          ...baseConfig,
          title: row.title ?? baseConfig.title,
          logo: row.logo ?? baseConfig.logo,
          sidebarColor: row.sidebar_color ?? baseConfig.sidebarColor,
          mainColor: row.main_color ?? baseConfig.mainColor,
          initialRetailAmount: Number(row.initial_retail_amount) || Number(baseConfig.initialRetailAmount) || 0,
          initialRetailAmountDhaka: Number(row.initial_retail_amount_dhaka) || Number(baseConfig.initialRetailAmountDhaka) || 0,
          initialRetailAmountChittagong: Number(row.initial_retail_amount_chittagong) || Number(baseConfig.initialRetailAmountChittagong) || 0,
          regards: row.regards ?? baseConfig.regards,
          execName: row.exec_name ?? baseConfig.execName,
          execDetails: row.exec_details ?? baseConfig.execDetails,
          customDetailText: row.custom_detail_text ?? baseConfig.customDetailText,
          customDetailHtml: row.custom_detail_html ?? baseConfig.customDetailHtml,
          customDetailBold: row.custom_detail_bold ?? baseConfig.customDetailBold ?? false,
          customDetailItalic: row.custom_detail_italic ?? baseConfig.customDetailItalic ?? false,
          customDetailBoxed: row.custom_detail_boxed ?? baseConfig.customDetailBoxed ?? false,
          orderSerialSeed: row.order_serial_seed ?? baseConfig.orderSerialSeed,
          quoteSerialSeed: row.quote_serial_seed ?? baseConfig.quoteSerialSeed,
          paymentReferenceSeed: row.payment_reference_seed ?? baseConfig.paymentReferenceSeed,
          parcelNames: Array.isArray(row.parcel_names) && row.parcel_names.length > 0
            ? row.parcel_names
            : Array.isArray(baseConfig.parcelNames)
              ? baseConfig.parcelNames
              : []
        };
      } else {
        mappedData = baseConfig;
      }
    } else if (key === KEYS.ORDERS) {
      mappedData = data.map(row => ({
        id: row.id,
        date: row.date,
        type: row.type,
        status: row.status,
        customerName: row.customer_name,
        dealerId: row.dealer_id,
        customerPhone: row.customer_phone,
        customerAddress: row.customer_address,
        officer: row.officer,
        items: row.items || [],
        subtotal: Number(row.subtotal) || 0,
        discount: Number(row.discount) || 0,
        extra: Number(row.extra) || 0,
        netTotal: Number(row.net_total) || 0,
        notes: row.notes,
        mainOrderId: row.main_order_id,
        createdBy: row.created_by,
        approvedBy: row.approved_by,
        isQuote: row.is_quote,
        retailPaymentStatus: row.retail_payment_status,
        partialAmount: Number(row.partial_amount) || 0,
        retailPaymentDate: row.retail_payment_date,
        paymentReference: row.payment_reference,
        includePriceIncreaseInCommission: row.include_price_increase_in_commission,
        inventorySource: row.inventory_source,
        showSerialsOnInvoice: row.show_serials_on_invoice,
        shipping: row.shipping
      }));
    } else if (key === KEYS.TARGETS) {
      mappedData = data.map(row => ({
        id: row.id,
        name: row.name,
        dealerId: row.dealer_id,
        dealerName: row.dealer_name,
        type: row.type,
        productIds: row.product_ids || [],
        targetValue: Number(row.target_value) || 0,
        currentValue: Number(row.current_value) || 0,
        startDate: row.start_date,
        endDate: row.end_date,
        rewardType: row.reward_type,
        rewardValue: Number(row.reward_value) || 0,
        status: row.status,
        assignedOfficerId: row.assigned_officer_id,
        rewardedDealerIds: row.rewarded_dealer_ids || [],
        rewardDisbursed: row.reward_disbursed || {}
      }));
    } else if (key === KEYS.PRODUCTS) {
      mappedData = data.map(row => ({
        id: row.id,
        name: row.name,
        version: row.version,
        categoryId: row.category_id,
        retailPrice: Number(row.retail_price) || 0,
        commission: Number(row.commission) || 0,
        status: row.status,
        dhaka: row.dhaka,
        chittagong: row.chittagong,
        slabs: row.slabs || [],
        sortOrder: row.sort_order
      }));
      // Sort products by sortOrder
      mappedData.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } else if (key === KEYS.DEALERS) {
      mappedData = data.map(row => ({
        id: row.id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        officerName: row.officer_name,
        balance: Number(row.balance) || 0,
        officerId: row.officer_id
      }));
    } else if (key === KEYS.OFFICERS) {
      mappedData = data.map(row => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        designation: row.designation,
        commissionBalance: Number(row.commission_balance) || 0,
        clearanceHistory: row.clearance_history || [],
        commissionTokens: row.commission_tokens || []
      }));
    } else if (key === KEYS.PAYMENTS) {
      mappedData = data.map(row => ({
        id: row.id,
        dealerId: row.dealer_id,
        dealerName: row.dealer_name,
        date: row.date,
        type: row.type,
        amount: Number(row.amount) || 0,
        reference: row.reference,
        notes: row.notes
      }));
    } else if (key === KEYS.PRODUCT_STOCK_ENTRIES) {
      mappedData = data.map(row => ({
        id: row.id,
        entryId: row.entry_id,
        batchId: row.batch_id,
        productId: row.product_id,
        productName: row.product_name,
        date: row.date,
        location: row.location,
        quantity: row.quantity,
        note: row.note
      }));
    } else if (key === KEYS.PRODUCT_STOCK_TRANSFERS) {
      mappedData = data.map(row => ({
        id: row.id,
        transferId: row.transfer_id,
        date: row.date,
        productId: row.product_id,
        productName: row.product_name,
        from: row.from_location,
        to: row.to_location,
        quantity: row.quantity,
        note: row.note
      }));
    } else if (key === KEYS.RETAIL) {
      mappedData = data.map(row => ({
        id: row.id,
        orderId: row.order_id,
        date: row.date,
        detail: row.detail,
        amount: Number(row.amount) || 0,
        paymentStatus: row.payment_status,
        paidAmount: Number(row.paid_amount) || 0,
        location: row.location,
        type: row.type
      }));
    } else if (key === KEYS.TARGET_REWARDS) {
      mappedData = data.map(row => ({
        id: row.id,
        rewardRef: row.reward_ref,
        targetId: row.target_id,
        targetName: row.target_name,
        dealerId: row.dealer_id,
        dealerName: row.dealer_name,
        officerId: row.officer_id,
        officerName: row.officer_name,
        date: row.date,
        cycles: row.cycles,
        amount: Number(row.amount) || 0,
        paymentId: row.payment_id,
        note: row.note,
        status: row.status
      }));
    } else if (key === KEYS.SEND_AMOUNTS) {
      mappedData = data.map(row => ({
        id: row.id,
        date: row.date,
        location: row.location,
        amount: Number(row.amount) || 0,
        note: row.note
      }));
    } else if (key === KEYS.CATEGORIES) {
      mappedData = data.map(row => ({
        id: row.id,
        name: row.name
      }));
    } else if (key === KEYS.NOTIFICATIONS) {
      mappedData = data.map(row => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        message: row.message,
        type: row.type,
        read: row.read,
        timestamp: row.timestamp
      }));
    }

    // Special case for non-collection data like CONFIG
    if (key === KEYS.CONFIG) {
      setLocal(key, mappedData);
    } else if (Array.isArray(mappedData)) {
      setLocal(key, mappedData);
    }

    return mappedData as T;
  } catch (e) {
    console.error(`Error fetching remote data for ${key}:`, e);
    return get(key, def);
  }
};

const persistLocally = (key: string, item: any) => {
  if (key === KEYS.CONFIG) {
    const currentLocal = get(KEYS.CONFIG, null) as Partial<Customization> | null;
    const merged = {
      ...(currentLocal || {}),
      ...(item || {}),
      parcelNames: Array.isArray((item as Partial<Customization>)?.parcelNames)
        ? (item as Partial<Customization>).parcelNames!
        : Array.isArray((currentLocal as Partial<Customization>)?.parcelNames)
          ? (currentLocal as Partial<Customization>).parcelNames!
          : []
    } as Customization;
    setLocal(key, merged);
  } else {
    const currentLocal = get(key, []);
    if (Array.isArray(currentLocal)) {
      const idx = currentLocal.findIndex((x: any) => x.id === item.id);
      if (idx > -1) currentLocal[idx] = item;
      else currentLocal.push(item);
      setLocal(key, currentLocal);
    }
  }
};

const pushRemote = async (key: string, item: any) => {
  const table = TABLE_MAP[key];
  let writeError: any = null;

  if (!isReady()) {
    // Still persist locally even when remote isn't ready so UI saves don't disappear.
    persistLocally(key, item);
    console.warn(`pushRemote skipped (supabase not ready) for ${key}; saved locally only.`);
    return;
  }

  try {
    if (COUNTER_KEYS.has(key)) {
      await supabase!.from('counters').upsert({ key, value: item }, { onConflict: 'key' });
      return;
    }

    if (!table) return;

    let row = item;
    if (key === KEYS.USERS) {
      row = {
        id: item.id,
        auth_user_id: item.authUserId,
        email: item.email,
        name: item.name,
        role: item.role,
        notifications_enabled: item.notificationsEnabled,
        allowed_tabs: item.allowedTabs || [],
        mobile_quick_tabs: item.mobileQuickTabs || [],
        officer_id: item.officerId
      };
    } else if (key === KEYS.CONFIG) {
      row = {
        id: 'global',
        title: item.title,
        logo: item.logo,
        sidebar_color: item.sidebarColor,
        main_color: item.mainColor,
        initial_retail_amount: item.initialRetailAmount,
        initial_retail_amount_dhaka: item.initialRetailAmountDhaka,
        initial_retail_amount_chittagong: item.initialRetailAmountChittagong,
        regards: item.regards,
        exec_name: item.execName,
        exec_details: item.execDetails,
        custom_detail_text: item.customDetailText,
        custom_detail_html: item.customDetailHtml,
        custom_detail_bold: item.customDetailBold || false,
        custom_detail_italic: item.customDetailItalic || false,
        custom_detail_boxed: item.customDetailBoxed || false,
        order_serial_seed: item.orderSerialSeed,
        quote_serial_seed: item.quoteSerialSeed,
        payment_reference_seed: item.paymentReferenceSeed,
        parcel_names: item.parcelNames || []
      };
    } else if (key === KEYS.ORDERS) {
      row = {
        id: item.id,
        date: item.date,
        type: item.type,
        status: item.status,
        customer_name: item.customerName,
        dealer_id: item.dealerId,
        customer_phone: item.customerPhone,
        customer_address: item.customerAddress,
        officer: item.officer,
        items: item.items || [],
        subtotal: item.subtotal,
        discount: item.discount,
        extra: item.extra,
        net_total: item.netTotal,
        notes: item.notes,
        main_order_id: item.mainOrderId,
        created_by: item.createdBy,
        approved_by: item.approvedBy,
        is_quote: item.isQuote,
        retail_payment_status: item.retailPaymentStatus,
        partial_amount: item.partialAmount,
        retail_payment_date: item.retailPaymentDate,
        payment_reference: item.paymentReference,
        include_price_increase_in_commission: item.includePriceIncreaseInCommission,
        inventory_source: item.inventorySource,
        show_serials_on_invoice: item.showSerialsOnInvoice,
        shipping: item.shipping
      };
    } else if (key === KEYS.TARGETS) {
      row = {
        id: item.id,
        name: item.name,
        dealer_id: item.dealerId,
        dealer_name: item.dealerName,
        type: item.type,
        product_ids: item.productIds || [],
        target_value: item.targetValue,
        current_value: item.currentValue,
        start_date: item.startDate,
        end_date: item.endDate,
        reward_type: item.rewardType,
        reward_value: item.rewardValue,
        status: item.status,
        assigned_officer_id: item.assignedOfficerId,
        rewarded_dealer_ids: item.rewardedDealerIds || [],
        reward_disbursed: item.rewardDisbursed || {}
      };
    } else if (key === KEYS.PRODUCTS) {
      row = {
        id: item.id,
        name: item.name,
        version: item.version,
        category_id: item.categoryId,
        retail_price: item.retailPrice,
        commission: item.commission,
        status: item.status,
        dhaka: item.dhaka,
        chittagong: item.chittagong,
        slabs: item.slabs || [],
        sort_order: item.sortOrder
      };
    } else if (key === KEYS.DEALERS) {
      row = {
        id: item.id,
        name: item.name,
        address: item.address,
        phone: item.phone,
        officer_name: item.officerName,
        balance: item.balance,
        officer_id: item.officerId
      };
    } else if (key === KEYS.OFFICERS) {
      row = {
        id: item.id,
        name: item.name,
        phone: item.phone,
        designation: item.designation,
        commission_balance: item.commissionBalance,
        clearance_history: item.clearanceHistory || [],
        commission_tokens: item.commissionTokens || []
      };
    } else if (key === KEYS.PAYMENTS) {
      row = {
        id: item.id,
        dealer_id: item.dealerId,
        dealer_name: item.dealerName,
        date: item.date,
        type: item.type,
        amount: item.amount,
        reference: item.reference,
        notes: item.notes
      };
    } else if (key === KEYS.PRODUCT_STOCK_ENTRIES) {
      row = {
        id: item.id,
        entry_id: item.entryId,
        batch_id: item.batchId,
        product_id: item.productId,
        product_name: item.productName,
        date: item.date,
        location: item.location,
        quantity: item.quantity,
        note: item.note
      };
    } else if (key === KEYS.PRODUCT_STOCK_TRANSFERS) {
      row = {
        id: item.id,
        transfer_id: item.transferId,
        date: item.date,
        product_id: item.productId,
        product_name: item.productName,
        from_location: item.from,
        to_location: item.to,
        quantity: item.quantity,
        note: item.note
      };
    } else if (key === KEYS.RETAIL) {
      row = {
        id: item.id,
        order_id: item.orderId,
        date: item.date,
        detail: item.detail,
        amount: item.amount,
        payment_status: item.paymentStatus,
        paid_amount: item.paidAmount,
        location: item.location,
        type: item.type
      };
    } else if (key === KEYS.TARGET_REWARDS) {
      row = {
        id: item.id,
        reward_ref: item.rewardRef,
        target_id: item.targetId,
        target_name: item.targetName,
        dealer_id: item.dealerId,
        dealer_name: item.dealerName,
        officer_id: item.officerId,
        officer_name: item.officerName,
        date: item.date,
        cycles: item.cycles,
        amount: item.amount,
        payment_id: item.paymentId,
        note: item.note,
        status: item.status
      };
    } else if (key === KEYS.SEND_AMOUNTS) {
      row = {
        id: item.id,
        date: item.date,
        location: item.location,
        amount: item.amount,
        note: item.note
      };
    } else if (key === KEYS.CATEGORIES) {
      row = {
        id: item.id,
        name: item.name
      };
    } else if (key === KEYS.NOTIFICATIONS) {
      row = {
        id: item.id,
        user_id: item.userId,
        title: item.title,
        message: item.message,
        type: item.type,
        read: item.read,
        timestamp: item.timestamp
      };
    }

    const { error } = await supabase!.from(table).upsert(row, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) {
    writeError = e;
    console.error(`Supabase push error for ${key}:`, e);
  } finally {
    // Always update local storage even if remote push fails, so UI changes persist locally.
    persistLocally(key, item);
  }

  if (writeError) {
    // Surface as re-throw so callers can toast a DB error to the user.
    throw writeError;
  }
};

const removeRemote = async (key: string, id: string) => {
  if (!isReady()) return;
  const table = TABLE_MAP[key];
  if (!table) return;
  try {
    await supabase!.from(table).delete().eq('id', id);
  } catch (e) {
    console.error(`Supabase delete error for ${key}:`, e);
  }
};

export const initializeApiStorage = async () => {
  if (!isReady()) return;
  // Initialize critical data first
  const criticalKeys = [KEYS.CONFIG, KEYS.USERS, KEYS.CATEGORIES, KEYS.PRODUCTS];
  for (const key of criticalKeys) {
    await getRemote(key, null).catch(e => console.error(`Hydration failed for ${key}`, e));
  }
  
  // Initialize the rest in background
  const otherKeys = SYNCED_KEYS.filter(k => !criticalKeys.includes(k) && k !== KEYS.SESSION);
  Promise.all(otherKeys.map(key => getRemote(key, null)))
    .catch(e => console.error("Background hydration failed", e));
};

export const api = {
  // Auth
  login: async (email: string, pass: string) => {
    if (!isReady()) return null;
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password: pass });
    if (error) return null;
    return await api.getUser();
  },
  getUser: async () => {
    if (!isReady()) return get<User | null>(KEYS.SESSION, null);
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session) return null;
    const { data: profile } = await supabase!.from('profiles').select('*').eq('auth_user_id', session.user.id).maybeSingle();
    if (!profile) return null;
    const user: User = {
      id: profile.id,
      authUserId: profile.auth_user_id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      notificationsEnabled: profile.notifications_enabled,
      allowedTabs: profile.allowed_tabs || [],
      mobileQuickTabs: profile.mobile_quick_tabs || [],
      officerId: profile.officer_id
    };
    setLocal(KEYS.SESSION, user);
    return user;
  },
  logout: async () => {
    if (isReady()) await supabase!.auth.signOut();
    localStorage.removeItem(KEYS.SESSION);
  },
  getCurrentUser: () => get<User | null>(KEYS.SESSION, null),

  // Users
  getUsers: () => getRemote<User[]>(KEYS.USERS, []),
  saveUser: async (u: User) => {
    await pushRemote(KEYS.USERS, u);
    return u;
  },
  deleteUser: async (id: string) => {
    await removeRemote(KEYS.USERS, id);
  },

  // Products
  getProducts: () => getRemote<Product[]>(KEYS.PRODUCTS, []),
  saveProduct: async (p: Product) => {
    const product = { ...p, id: p.id || `PRD-${Date.now()}` };
    await pushRemote(KEYS.PRODUCTS, product);
    return product;
  },
  deleteProduct: async (id: string) => {
    await removeRemote(KEYS.PRODUCTS, id);
  },
  syncProductStock: async (productId: string) => {
    // Use local cache directly to avoid network race conditions and improve performance
    const entries = get<ProductStockEntry[]>(KEYS.PRODUCT_STOCK_ENTRIES, []);
    const transfers = get<ProductStockTransfer[]>(KEYS.PRODUCT_STOCK_TRANSFERS, []);
    const orders = get<Order[]>(KEYS.ORDERS, []);

    const pEntries = entries.filter(e => e && e.productId === productId);
    const pTransfers = transfers.filter(t => t && t.productId === productId);
    const pOrders = orders.filter(o => o && o.status === 'approved' && !o.isQuote && o.items.some(i => i.productId === productId));

    let dhaka = 0;
    let chittagong = 0;

    // 1. Add Entries (including initial quantities)
    pEntries.forEach(e => {
      if (e.location === 'dhaka') dhaka += Number(e.quantity) || 0;
      else chittagong += Number(e.quantity) || 0;
    });

    // 2. Adjust for Transfers
    pTransfers.forEach(t => {
      const qty = Number(t.quantity) || 0;
      if (t.from === 'dhaka') dhaka -= qty;
      else if (t.from === 'chittagong') chittagong -= qty;

      if (t.to === 'dhaka') dhaka += qty;
      else if (t.to === 'chittagong') chittagong += qty;
    });

    // 3. Subtract Approved Orders
    pOrders.forEach(o => {
      o.items.forEach(item => {
        if (item && item.productId === productId) {
          const qty = Number(item.quantity) || 0;
          const loc = (item.location || o.inventorySource || 'chittagong').toLowerCase();
          if (loc === 'dhaka') dhaka -= qty;
          else chittagong -= qty;
        }
      });
    });

    // Update the product stock in remote and local
    const products = await api.getProducts();
    const product = products.find(p => p.id === productId);
    if (product) {
      const updatedProduct = { ...product, dhaka, chittagong };
      // Push directly to remote, pushRemote will update local cache
      await pushRemote(KEYS.PRODUCTS, updatedProduct);
    }
  },
  reorderProducts: async (ids: string[]) => {
    const products = await api.getProducts();
    for (let i = 0; i < ids.length; i++) {
      const product = products.find(p => p.id === ids[i]);
      if (product) {
        await api.saveProduct({ ...product, sortOrder: i + 1 });
      }
    }
  },

  // Categories
  getCategories: () => getRemote<Category[]>(KEYS.CATEGORIES, []),
  saveCategory: async (c: Category) => {
    const cat = { ...c, id: c.id || `CAT-${Date.now()}` };
    await pushRemote(KEYS.CATEGORIES, cat);
    return cat;
  },
  deleteCategory: async (id: string) => {
    await removeRemote(KEYS.CATEGORIES, id);
  },

  // Dealers
  getDealers: () => getRemote<Dealer[]>(KEYS.DEALERS, []),
  saveDealer: async (d: Dealer) => {
    const dealer = { ...d, id: d.id || `DLR-${Date.now()}` };
    await pushRemote(KEYS.DEALERS, dealer);
    return dealer;
  },
  saveDealers: async (dealers: Dealer[]) => {
    for (const d of dealers) {
      await pushRemote(KEYS.DEALERS, d);
    }
  },
  deleteDealer: async (id: string) => {
    await removeRemote(KEYS.DEALERS, id);
  },

  // Officers
  getOfficers: () => getRemote<Officer[]>(KEYS.OFFICERS, []),
  saveOfficer: async (o: Officer) => {
    const officer = { ...o, id: o.id || `OFF-${Date.now()}` };
    await pushRemote(KEYS.OFFICERS, officer);
    return officer;
  },
  deleteOfficer: async (id: string) => {
    await removeRemote(KEYS.OFFICERS, id);
  },

  // Commission Tokens
  getCommissionTokens: async () => {
    const officers = await api.getOfficers();
    const allTokens: any[] = [];
    (Array.isArray(officers) ? officers : []).forEach(o => {
      if (o && Array.isArray(o.commissionTokens)) {
        o.commissionTokens.forEach(t => {
          allTokens.push({
            ...t,
            officerId: o.id,
            officerName: o.name
          });
        });
      }
    });
    return allTokens;
  },
  disburseCommissionToken: async (officerId: string, tokenId: string) => {
    const officers = await api.getOfficers();
    const officer = (Array.isArray(officers) ? officers : []).find(o => o && o.id === officerId);
    if (officer && Array.isArray(officer.commissionTokens)) {
      const tokens = officer.commissionTokens.map(t => 
        t.id === tokenId ? { ...t, status: 'disbursed' as const, disbursedDate: getCurrentTimestamp() } : t
      );
      await api.saveOfficer({ ...officer, commissionTokens: tokens });
      return { success: true };
    }
    return { success: false };
  },
  undoCommissionTokenDisbursement: async (officerId: string, tokenId: string) => {
    const officers = await api.getOfficers();
    const officer = (Array.isArray(officers) ? officers : []).find(o => o && o.id === officerId);
    if (officer && Array.isArray(officer.commissionTokens)) {
      const tokens = officer.commissionTokens.map(t => 
        t.id === tokenId ? { ...t, status: 'pending' as const, disbursedDate: undefined } : t
      );
      await api.saveOfficer({ ...officer, commissionTokens: tokens });
      return { success: true };
    }
    return { success: false };
  },
  updateCommissionToken: async (officerId: string, tokenId: string, updates: any) => {
    const officers = await api.getOfficers();
    const officer = (Array.isArray(officers) ? officers : []).find(o => o && o.id === officerId);
    if (officer && Array.isArray(officer.commissionTokens)) {
      const tokens = officer.commissionTokens.map(t => 
        t.id === tokenId ? { ...t, ...updates } : t
      );
      await api.saveOfficer({ ...officer, commissionTokens: tokens });
      return { success: true };
    }
    return { success: false };
  },
  deleteCommissionToken: async (officerId: string, tokenId: string) => {
    const officers = await api.getOfficers();
    const officer = (Array.isArray(officers) ? officers : []).find(o => o && o.id === officerId);
    if (officer && Array.isArray(officer.commissionTokens)) {
      const tokens = officer.commissionTokens.filter(t => t.id !== tokenId);
      await api.saveOfficer({ ...officer, commissionTokens: tokens });
      return { success: true };
    }
    return { success: false };
  },

  // Orders
  getOrders: () => getRemote<Order[]>(KEYS.ORDERS, []),
  saveOrder: async (o: Order) => {
    const orders = await api.getOrders();
    const existing = orders.find(x => x.id === o.id);
    const order = { ...o, id: o.id || `ORD-${Date.now()}` };
    
    // 1. Handle Dealer Balance (only for regular/dealer orders that are approved)
    if (order.type !== 'retail' && !order.isQuote && order.status === 'approved') {
      const dealers = await api.getDealers();
      const dealer = dealers.find(d => d.id === order.dealerId);
      if (dealer) {
        let adjustment = order.netTotal;
        if (existing && existing.status === 'approved') {
          adjustment = order.netTotal - existing.netTotal;
        } else if (existing && existing.status !== 'approved') {
           // transition from non-approved to approved
           adjustment = order.netTotal;
        }
        await api.saveDealer({ ...dealer, balance: (dealer.balance || 0) - adjustment });
      }
    } else if (existing && existing.status === 'approved' && (order.status !== 'approved' || order.isQuote)) {
      // transition from approved to non-approved/quote (revert balance)
      const dealers = await api.getDealers();
      const dealer = dealers.find(d => d.id === existing.dealerId);
      if (dealer) {
        await api.saveDealer({ ...dealer, balance: (dealer.balance || 0) + existing.netTotal });
      }
    }

    // 2. Handle Stock Sync (only when approved)
    await pushRemote(KEYS.ORDERS, order);
    
    // Sync stock for all products in current and previous order state
    const productIdsToSync = new Set<string>();
    order.items.forEach(i => productIdsToSync.add(i.productId));
    if (existing) existing.items.forEach(i => productIdsToSync.add(i.productId));
    
    for (const pId of productIdsToSync) {
      await api.syncProductStock(pId);
    }
    
    // Sync linked retail transaction if location or other details changed
    if (order.type === 'retail' && !order.isQuote) {
      const txs = await api.getRetailTransactions();
      const linkedTx = txs.find(t => t.orderId === order.id);
      if (linkedTx) {
        await api.saveRetailTransaction({
          ...linkedTx,
          date: order.date,
          detail: `Retail Sale: ${order.customerName}`,
          amount: order.netTotal,
          location: order.inventorySource as any,
          paymentStatus: order.retailPaymentStatus,
          paidAmount: order.partialAmount
        });
      }
    }
    
    return order;
  },
  saveOrders: async (orders: Order[]) => {
    for (const o of orders) {
      await api.saveOrder(o);
    }
  },
  reorderOrders: async (ids: string[]) => {
    // This is primarily for local sorting persistence in current session
    // In a production app, we would save a sort_order field to the database
  },
  deleteOrder: async (id: string) => {
    const orders = await api.getOrders();
    const order = orders.find(o => o.id === id);
    if (order) {
      // 1. Revert Dealer Balance if approved
      if (order.type !== 'retail' && !order.isQuote && order.status === 'approved') {
        const dealers = await api.getDealers();
        const dealer = dealers.find(d => d.id === order.dealerId);
        if (dealer) {
          await api.saveDealer({ ...dealer, balance: (dealer.balance || 0) + order.netTotal });
        }
      }

      // 2. Revert Stock
      await removeRemote(KEYS.ORDERS, id);
      
      // Update local storage immediately so syncProductStock sees the deletion
      const currentOrders = get<Order[]>(KEYS.ORDERS, []);
      const filteredOrders = currentOrders.filter(o => o.id !== id);
      setLocal(KEYS.ORDERS, filteredOrders);

      for (const item of order.items) {
        await api.syncProductStock(item.productId);
      }

      // 3. Delete associated commission tokens
      const officers = await api.getOfficers();
      for (const officer of officers) {
        if (Array.isArray(officer.commissionTokens)) {
          const hasToken = officer.commissionTokens.some((t: any) => t.orderId === id);
          if (hasToken) {
            const updatedTokens = officer.commissionTokens.filter((t: any) => t.orderId !== id);
            await api.saveOfficer({ ...officer, commissionTokens: updatedTokens });
          }
        }
      }

      // 4. Delete linked notifications
      const allNotifications = await getRemote<Notification[]>(KEYS.NOTIFICATIONS, []);
      for (const n of (Array.isArray(allNotifications) ? allNotifications : [])) {
        if (n && (n.message.includes(id) || n.title.includes(id))) {
          await api.deleteNotification(n.id);
        }
      }
    }

    // Also delete linked retail transaction if any
    const txs = await api.getRetailTransactions();
    const linkedTx = txs.find(t => t.orderId === id);
    if (linkedTx) {
      await api.deleteRetailTransaction(linkedTx.id);
    }
  },
  setRetailOrderPaymentStatus: async (id: string, status: 'paid' | 'unpaid' | 'partial', amount?: number) => {
    const orders = await api.getOrders();
    const order = orders.find(o => o.id === id);
    if (!order) return { success: false, message: 'Order not found' };

    const updated = { 
      ...order, 
      retailPaymentStatus: status as any, 
      partialAmount: amount !== undefined ? amount : (status === 'paid' ? order.netTotal : 0),
      retailPaymentDate: status === 'paid' ? getTodayISO() : order.retailPaymentDate
    };
    await api.saveOrder(updated);

    // Sync with Retail Transaction history
    const txs = await api.getRetailTransactions();
    const linkedTx = txs.find(t => t.orderId === id);
    if (linkedTx) {
      await api.saveRetailTransaction({
        ...linkedTx,
        paymentStatus: status as any,
        paidAmount: updated.partialAmount
      });
    }

    return { success: true };
  },

  // Payments
  getPayments: () => getRemote<Payment[]>(KEYS.PAYMENTS, []),
  savePayment: async (p: Payment) => {
    const payments = await api.getPayments();
    const existing = payments.find(x => x.id === p.id);
    
    let payment = { ...p };
    if (!payment.id) {
      payment.id = await api.getNextPaymentId();
    }
    
    // If it's a new payment or modified, update dealer balance
    if (payment.dealerId) {
      const dealers = await api.getDealers();
      const dealer = dealers.find(d => d.id === payment.dealerId);
      if (dealer) {
        let balanceAdjustment = Number(payment.amount) || 0;
        if (existing) {
          // If editing, adjust by the difference
          balanceAdjustment = (Number(payment.amount) || 0) - (Number(existing.amount) || 0);
        }
        
        // CREDIT adjustments (like rewards) should increase balance, but PAYMENTS (cash/bank) should decrease it.
        // In this system, 'balance' usually means 'amount dealer owes us' or 'due'.
        // If type is Adjustment, it's likely a reward (Credit), so it should DECREASE the due.
        // If type is Cash/Bank, it DECREASES the due.
        // If type is Last balance Due, it INCREASES the due.
        
        let multiplier = -1; // Default: payments decrease due
        if (payment.type === 'Last balance Due' || payment.type === 'Purchase') {
          multiplier = 1; // These increase due
        }

        await api.saveDealer({
          ...dealer,
          balance: (Number(dealer.balance) || 0) + (balanceAdjustment * multiplier)
        });
      }
    }

    await pushRemote(KEYS.PAYMENTS, payment);
    return payment;
  },
  deletePayment: async (id: string) => {
    const payments = await api.getPayments();
    const payment = payments.find(p => p.id === id);
    if (payment && payment.dealerId) {
      const dealers = await api.getDealers();
      const dealer = dealers.find(d => d.id === payment.dealerId);
      if (dealer) {
        await api.saveDealer({
          ...dealer,
          balance: (Number(dealer.balance) || 0) - (Number(payment.amount) || 0)
        });
      }
    }
    await removeRemote(KEYS.PAYMENTS, id);
  },
  getNextPaymentId: async () => await api.getNextSerial(KEYS.PAYMENT_REFERENCE_COUNTER, 'P'),

  // Stock Entries
  getProductStockEntries: () => getRemote<ProductStockEntry[]>(KEYS.PRODUCT_STOCK_ENTRIES, []),
  saveProductStockEntry: async (entry: ProductStockEntry) => {
    const entries = await api.getProductStockEntries();
    let e = { ...entry };
    if (!e.id) {
      const lastEntry = [...entries].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true, sensitivity: 'base' })).reverse()[0];
      const lastIdMatch = lastEntry?.id?.match(/\d+/);
      const nextIdNum = lastIdMatch ? parseInt(lastIdMatch[0]) + 1 : 1;
      e.id = `E${String(nextIdNum).padStart(4, '0')}`;
    }
    
    // Sync with product stock
    await pushRemote(KEYS.PRODUCT_STOCK_ENTRIES, e);
    await api.syncProductStock(e.productId);
    return e;
  },
  saveProductStockEntries: async (entries: ProductStockEntry[]) => {
    for (const e of entries) await api.saveProductStockEntry(e);
  },
  deleteProductStockEntry: async (id: string) => {
    const entries = await api.getProductStockEntries();
    const entry = entries.find(e => e.id === id);
    if (entry) {
      await removeRemote(KEYS.PRODUCT_STOCK_ENTRIES, id);
      // Force local update for instant sync
      const current = get<ProductStockEntry[]>(KEYS.PRODUCT_STOCK_ENTRIES, []);
      setLocal(KEYS.PRODUCT_STOCK_ENTRIES, current.filter(e => e.id !== id));
      await api.syncProductStock(entry.productId);
    }
  },

  // Stock Transfers
  getProductStockTransfers: () => getRemote<ProductStockTransfer[]>(KEYS.PRODUCT_STOCK_TRANSFERS, []),
  saveProductStockTransfer: async (t: ProductStockTransfer) => {
    const transfers = await api.getProductStockTransfers();
    let transfer = { ...t };
    if (!transfer.id) {
      const lastTransfer = [...transfers].sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true, sensitivity: 'base' })).reverse()[0];
      const lastIdMatch = lastTransfer?.id?.match(/\d+/);
      const nextIdNum = lastIdMatch ? parseInt(lastIdMatch[0]) + 1 : 1;
      transfer.id = `T${String(nextIdNum).padStart(4, '0')}`;
    }
    
    // Sync with product stock
    await pushRemote(KEYS.PRODUCT_STOCK_TRANSFERS, transfer);
    await api.syncProductStock(transfer.productId);
    return transfer;
  },
  deleteProductStockTransfer: async (id: string) => {
    const transfers = await api.getProductStockTransfers();
    const transfer = transfers.find(t => t.id === id);
    if (transfer) {
      await removeRemote(KEYS.PRODUCT_STOCK_TRANSFERS, id);
      // Force local update for instant sync
      const current = get<ProductStockTransfer[]>(KEYS.PRODUCT_STOCK_TRANSFERS, []);
      setLocal(KEYS.PRODUCT_STOCK_TRANSFERS, current.filter(t => t.id !== id));
      await api.syncProductStock(transfer.productId);
    }
  },

  // Targets
  getTargets: () => getRemote<Target[]>(KEYS.TARGETS, []),
  saveTarget: async (t: Target) => {
    const target = { ...t, id: t.id || `TGT-${Date.now()}` };
    await pushRemote(KEYS.TARGETS, target);
    return target;
  },
  deleteTarget: async (id: string) => {
    await removeRemote(KEYS.TARGETS, id);
  },
  syncTargetStatuses: async () => {
    return await api.getTargets();
  },

  // Target Rewards
  getTargetRewards: () => getRemote<TargetReward[]>(KEYS.TARGET_REWARDS, []),
  saveTargetReward: async (r: TargetReward) => {
    const reward = { ...r, id: r.id || `TGR-${Date.now()}` };
    await pushRemote(KEYS.TARGET_REWARDS, reward);
    return reward;
  },
  updateTargetReward: async (id: string, updates: any) => {
    const rewards = await api.getTargetRewards();
    const reward = rewards.find(r => r.id === id);
    if (!reward) return { success: false };

    // If amount changed, adjust dealer balance
    if (updates.amount !== undefined && Number(updates.amount) !== Number(reward.amount)) {
      const diff = Number(updates.amount) - Number(reward.amount);
      const dealers = await api.getDealers();
      const dealer = dealers.find(d => d.id === reward.dealerId);
      if (dealer) {
        await api.saveDealer({
          ...dealer,
          balance: (Number(dealer.balance) || 0) - diff // Reward is credit, increasing it reduces due (balance)
        });
      }

      // Also update the linked ledger entry (Payment)
      const payments = await api.getPayments();
      const linkedPayment = payments.find(p => p.reference === reward.rewardRef && p.type === 'Adjustment');
      if (linkedPayment) {
        await api.savePayment({
          ...linkedPayment,
          amount: Number(updates.amount)
        });
      }
    }

    // If officer changed, update officer name
    if (updates.officerId && updates.officerId !== reward.officerId) {
      if (updates.officerId === 'none') {
        updates.officerId = undefined;
        updates.officerName = '';
      } else {
        const officers = await api.getOfficers();
        const officer = officers.find(o => o.id === updates.officerId);
        if (officer) updates.officerName = officer.name;
      }
    }

    await api.saveTargetReward({ ...reward, ...updates });
    return { success: true };
  },
  deleteTargetReward: async (id: string) => {
    await removeRemote(KEYS.TARGET_REWARDS, id);
  },
  undoTargetReward: async (rewardId: string) => {
    const rewards = await api.getTargetRewards();
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) return { success: false, message: 'Reward record not found' };

    // 1. Revert Dealer Balance
    const dealers = await api.getDealers();
    const dealer = dealers.find(d => d.id === reward.dealerId);
    if (dealer) {
      await api.saveDealer({
        ...dealer,
        balance: (Number(dealer.balance) || 0) + (Number(reward.amount) || 0) // Revert credit
      });
    }

    // 2. Revert Target Disbursement Tracking
    const targets = await api.getTargets();
    const target = targets.find(t => t.id === reward.targetId);
    if (target) {
      const disbursedMap = target.rewardDisbursed || {};
      const current = disbursedMap[reward.dealerId] || 0;
      disbursedMap[reward.dealerId] = Math.max(0, current - (reward.cycles || 1));
      await api.saveTarget({ ...target, rewardDisbursed: disbursedMap });
    }

    // 3. Delete linked Payment ledger entry
    const payments = await api.getPayments();
    const linkedPayment = payments.find(p => p.reference === reward.rewardRef && p.type === 'Adjustment');
    if (linkedPayment) {
      await api.deletePayment(linkedPayment.id);
    }

    // 4. Delete Reward record
    await api.deleteTargetReward(rewardId);

    return { success: true };
  },

  // Retail
  getRetailTransactions: () => getRemote<RetailTransaction[]>(KEYS.RETAIL, []),
  saveRetailTransaction: async (t: RetailTransaction) => {
    const trans = { ...t, id: t.id || `RET-${Date.now()}` };
    await pushRemote(KEYS.RETAIL, trans);
    return trans;
  },
  deleteRetailTransaction: async (id: string) => {
    await removeRemote(KEYS.RETAIL, id);
  },
  syncRetailSalesFromApprovedOrders: async () => {
    const orders = await api.getOrders();
    const approvedRetail = (Array.isArray(orders) ? orders : []).filter(o => 
      o && o.status === 'approved' && o.type === 'retail' && !o.isQuote
    );
    
    const currentTxs = await api.getRetailTransactions();
    const approvedRetailIds = new Set(approvedRetail.map(o => o.id));

    // 1. Remove orphans (transactions linked to orders that are no longer retail/approved/existent)
    for (const tx of currentTxs) {
      if (tx.orderId && !approvedRetailIds.has(tx.orderId)) {
        await api.deleteRetailTransaction(tx.id);
      }
    }

    // 2. Add missing transactions
    const updatedTxs = await api.getRetailTransactions();
    const existingOrderIds = new Set(updatedTxs.map(t => t.orderId));

    for (const order of approvedRetail) {
      if (!existingOrderIds.has(order.id)) {
        const newTx: RetailTransaction = {
          id: `RTX-AUTO-${order.id}`,
          date: order.date,
          detail: `Retail Sale: ${order.customerName}`,
          amount: order.netTotal,
          location: order.inventorySource as any,
          type: 'sale',
          orderId: order.id,
          paymentStatus: order.retailPaymentStatus,
          paidAmount: order.partialAmount
        };
        await api.saveRetailTransaction(newTx);
      }
    }
  },

  // Config
  getConfig: () => getRemote<Customization>(KEYS.CONFIG, {
    title: 'Smart ERP System',
    logo: '',
    sidebarColor: '#0f172a',
    mainColor: '#3b82f6',
    initialRetailAmount: 5000,
    regards: 'Best Regards,',
    execName: '',
    execDetails: '',
    orderSerialSeed: 'R00001',
    quoteSerialSeed: 'Q00001',
    paymentReferenceSeed: 'P00001',
    parcelNames: []
  }),
  saveConfig: async (c: Customization) => {
    const current = (get(KEYS.CONFIG, null) || {}) as Partial<Customization>;
    const merged: Customization = {
      ...(current as any),
      ...(c || {}),
      parcelNames: Array.isArray(c?.parcelNames)
        ? c.parcelNames!
        : Array.isArray(current?.parcelNames)
          ? current.parcelNames!
          : []
    } as Customization;

    try {
      await pushRemote(KEYS.CONFIG, merged);
    } catch (error) {
      console.warn('Remote config save failed, keeping local config copy.', error);
    }

    setLocal(KEYS.CONFIG, merged);
    return merged;
  },
  getCustomization: async () => await api.getConfig(),
  saveCustomization: async (c: Customization) => await api.saveConfig(c),
  getParcelNames: async () => {
    const cfg = await api.getConfig();
    return Array.isArray(cfg.parcelNames) ? [...new Set(cfg.parcelNames.filter(Boolean))] : [];
  },
  saveParcelName: async (name: string): Promise<{ saved: boolean; reason?: string }> => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { saved: false, reason: 'empty' };
    const cfg = await api.getConfig();
    const existing = Array.isArray(cfg.parcelNames) ? cfg.parcelNames.filter(Boolean) : [];
    const lower = existing.map(n => n.toLowerCase());
    if (lower.includes(trimmed.toLowerCase())) return { saved: false, reason: 'exists' };
    existing.push(trimmed);
    const next: Customization = { ...cfg, parcelNames: existing };
    await api.saveConfig(next);
    return { saved: true };
  },
  removeParcelName: async (name: string) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const cfg = await api.getConfig();
    const existing = Array.isArray(cfg.parcelNames) ? cfg.parcelNames.filter(Boolean) : [];
    const kept = existing.filter(n => n.toLowerCase() !== trimmed.toLowerCase());
    const next: Customization = { ...cfg, parcelNames: kept };
    await api.saveConfig(next);
  },

  // Notifications
  getNotifications: (userId: string) => getRemote<Notification[]>(KEYS.NOTIFICATIONS, []).then(ns => (Array.isArray(ns) ? ns : []).filter(n => n && n.userId === userId)),
  markNotificationsRead: async (userId: string) => {
    const allNs = await getRemote<Notification[]>(KEYS.NOTIFICATIONS, []);
    const updated = (Array.isArray(allNs) ? allNs : []).map(n => {
      if (n && n.userId === userId && !n.read) {
        return { ...n, read: true };
      }
      return n;
    });
    
    // Update local
    setLocal(KEYS.NOTIFICATIONS, updated);
    
    // Update remote for user's notifications
    const userNs = updated.filter(n => n && n.userId === userId && n.read);
    for (const n of userNs) {
      await pushRemote(KEYS.NOTIFICATIONS, n);
    }
  },
  clearAllNotifications: async (userId: string) => {
    const allNs = await getRemote<Notification[]>(KEYS.NOTIFICATIONS, []);
    const userNs = (Array.isArray(allNs) ? allNs : []).filter(n => n && n.userId === userId);
    for (const n of userNs) {
      await removeRemote(KEYS.NOTIFICATIONS, n.id);
    }
    const remaining = (Array.isArray(allNs) ? allNs : []).filter(n => !n || n.userId !== userId);
    setLocal(KEYS.NOTIFICATIONS, remaining);
  },
  deleteNotification: async (id: string) => {
    await removeRemote(KEYS.NOTIFICATIONS, id);
  },
  addNotification: async (n: Notification) => {
    await pushRemote(KEYS.NOTIFICATIONS, { ...n, id: n.id || `NOT-${Date.now()}` });
  },

  // Serials
  getAllSerials: async () => {
    const orders = await api.getOrders();
    const serials = new Set<string>();
    orders.forEach(o => o.items.forEach(i => i.serialNumbers?.forEach(s => serials.add(s))));
    return Array.from(serials);
  },
  getProductsWithSerials: async () => {
    const orders = await api.getOrders();
    const productsMap = new Map<string, {
      productName: string;
      version: string;
      serials: string[];
    }>();

    orders.forEach(o => {
      o.items.forEach(i => {
        if (i.serialNumbers && i.serialNumbers.length > 0) {
          const key = `${i.productId || i.productName}-${i.version}`;
          if (!productsMap.has(key)) {
            productsMap.set(key, {
              productName: i.productName,
              version: i.version || '',
              serials: []
            });
          }
          productsMap.get(key)!.serials.push(...i.serialNumbers);
        }
      });
    });

    // Deduplicate serials per product
    productsMap.forEach((product, key) => {
      productsMap.set(key, {
        ...product,
        serials: Array.from(new Set(product.serials))
      });
    });

    return Array.from(productsMap.values());
  },
  searchBySerial: async (serial: string) => {
    const orders = await api.getOrders();
    for (const order of orders) {
      for (const item of order.items) {
        if (item.serialNumbers?.some(s => s.toLowerCase() === serial.toLowerCase())) {
          return { order, item };
        }
      }
    }
    return null;
  },

  // Send Amounts
  getSendAmounts: () => getRemote<SendAmountEntry[]>(KEYS.SEND_AMOUNTS, []),
  saveSendAmount: async (s: SendAmountEntry) => {
    const entry = { ...s, id: s.id || `SND-${Date.now()}` };
    await pushRemote(KEYS.SEND_AMOUNTS, entry);
    return entry;
  },
  deleteSendAmount: async (id: string) => {
    await removeRemote(KEYS.SEND_AMOUNTS, id);
  },

  // Utils
  getNextSerial: async (key: string, prefix: string) => {
    let seed = '';
    const config = await api.getConfig();
    
    // Determine the collection to search in based on the counter key
    let collection: any[] = [];
    if (key === KEYS.ORDER_INVOICE_COUNTER) {
      const all = await api.getOrders();
      collection = all.filter(o => !o.isQuote);
      seed = config.orderSerialSeed || 'R00001';
    } else if (key === KEYS.ORDER_QUOTE_COUNTER) {
      const all = await api.getOrders();
      collection = all.filter(o => o.isQuote);
      seed = config.quoteSerialSeed || 'Q00001';
    } else if (key === KEYS.PAYMENT_REFERENCE_COUNTER) {
      collection = await api.getPayments();
      seed = config.paymentReferenceSeed || 'P00001';
    } else if (key === KEYS.TARGET_REWARD_COUNTER) {
      collection = await api.getTargetRewards();
      seed = 'G0001';
    } else if (key === 'erp_product_stock_entry_counter') {
      collection = await api.getProductStockEntries();
      seed = 'E0001';
    } else if (key === 'erp_product_stock_transfer_counter') {
      collection = await api.getProductStockTransfers();
      seed = 'T0001';
    }

    let startVal = 0;
    if (collection.length > 0) {
      // Find the highest numeric value in the IDs or References of the collection
      const numericIds = collection.map(item => {
        const idStr = item.id || '';
        const refStr = item.reference || '';
        const transIdStr = item.transferId || '';
        const entryIdStr = item.entryId || '';
        
        // Check all potential ID-like strings
        const matches = [idStr, refStr, transIdStr, entryIdStr]
          .map(s => s.match(/\d+/))
          .filter(m => m !== null) as RegExpMatchArray[];
          
        if (matches.length === 0) return 0;
        return Math.max(...matches.map(m => parseInt(m[0])));
      });
      startVal = Math.max(...numericIds);
    } else {
      // Use config seed if collection is empty
      const seedMatch = seed.match(/\d+$/);
      if (seedMatch) {
        startVal = Math.max(0, parseInt(seedMatch[0]) - 1);
      }
    }

    const next = startVal + 1;
    // Keep internal counter in sync but we prioritize history for calculation
    await pushRemote(key, next);
    setLocal(key, next);
    
    // Return formatted string. Rewards/Entry/Transfer/Payment use 4 digits, others use 5.
    const padding = (key === KEYS.TARGET_REWARD_COUNTER || key === 'erp_product_stock_entry_counter' || key === 'erp_product_stock_transfer_counter' || key === KEYS.PAYMENT_REFERENCE_COUNTER) ? 4 : 5;
    return `${prefix}${String(next).padStart(padding, '0')}`;
  },
  
  getDashboardStats: async () => {
    const orders = await api.getOrders() || [];
    const dealers = await api.getDealers() || [];
    const officers = await api.getOfficers() || [];
    
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const safeOrders = Array.isArray(orders) ? orders : [];
    const approvedOrders = safeOrders.filter(o => o && o.status === 'approved' && !o.isQuote);
    
    const monthlyOrders = approvedOrders.filter(o => {
      const d = new Date(o.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const monthlySales = monthlyOrders.reduce((sum, o) => sum + Number(o.netTotal || 0), 0);
    const monthlyQuantity = monthlyOrders.reduce((sum, o) => 
      sum + (Array.isArray(o.items) ? o.items : []).reduce((qty, item) => qty + Number(item.quantity || 0), 0), 0
    );

    const safeDealers = Array.isArray(dealers) ? dealers : [];
    const remainingDueBalance = safeDealers.reduce((sum, d) => sum + Number(d?.balance || 0), 0);
    
    const chartData = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const daySales = approvedOrders
        .filter(o => o.date === dateStr)
        .reduce((sum, o) => sum + Number(o.netTotal || 0), 0);
      
      return {
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: daySales
      };
    });

    return {
      monthlySales: monthlySales || 0,
      monthlyQuantity: monthlyQuantity || 0,
      totalOfficers: Array.isArray(officers) ? officers.length : 0,
      pendingApprovals: safeOrders.filter(o => o && o.status === 'pending' && !o.isQuote).length || 0,
      totalQuotes: safeOrders.filter(o => o && o.isQuote).length || 0,
      remainingDueBalance: remainingDueBalance || 0,
      chartData
    };
  },

  // Data Management
  getNextOrderId: async (isQuote: boolean) => {
    const key = isQuote ? KEYS.ORDER_QUOTE_COUNTER : KEYS.ORDER_INVOICE_COUNTER;
    const prefix = isQuote ? 'Q' : 'R';
    return await api.getNextSerial(key, prefix);
  },
  getNextPaymentReference: async () => {
    return await api.getNextSerial(KEYS.PAYMENT_REFERENCE_COUNTER, 'P');
  },
  placeOrder: async (order: Order) => {
    // If updating an existing approved order, reverse previous stock/balance
    if (order.id) {
      const orders = await api.getOrders();
      const existing = orders.find(o => o.id === order.id);
      if (existing && existing.status === 'approved' && !existing.isQuote) {
        // 1. Reverse Stock
        const products = await api.getProducts();
        const reversalProductsMap: Record<string, Product> = {};

        for (const item of (existing.items || [])) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const p = reversalProductsMap[product.id] || { ...product };
            const itemLocation = (item.location || existing.inventorySource || 'chittagong').toLowerCase();
            const source = itemLocation === 'dhaka' ? 'dhaka' : 'chittagong';
            const currentStock = Number(p[source]) || 0;
            p[source] = currentStock + (Number(item.quantity) || 0);
            reversalProductsMap[product.id] = p;
          }
        }

        for (const pId in reversalProductsMap) {
          await api.saveProduct(reversalProductsMap[pId]);
        }

        // 2. Reverse Dealer Balance
        if (existing.type === 'regular' && existing.dealerId) {
          const dealers = await api.getDealers();
          const dealer = dealers.find(d => d.id === existing.dealerId);
          if (dealer) {
            const currentBalance = Number(dealer.balance) || 0;
            const netTotal = Number(existing.netTotal) || 0;
            await api.saveDealer({
              ...dealer,
              balance: currentBalance + netTotal
            });
          }
        }

        // 3. Reverse Commission Tokens
        if (existing.officer && existing.type === 'regular') {
          const officers = await api.getOfficers();
          const officer = officers.find(o => o.name === existing.officer);
          if (officer) {
            const updatedTokens = (officer.commissionTokens || []).filter(t => t.orderId !== existing.id);
            await api.saveOfficer({
              ...officer,
              commissionTokens: updatedTokens
            });
          }
        }
      }
    }

    await api.saveOrder(order);

    // Notifications
    if (!order.isQuote) {
      const users = await api.getUsers();
      const currentUser = api.getCurrentUser();
      
      if (currentUser?.role === 'member') {
        // Notify admins
        const admins = users.filter(u => u.role === 'admin');
        for (const admin of admins) {
          await api.addNotification({
            userId: admin.id,
            title: 'New Order Placed',
            message: `${currentUser.name} placed a new order ${order.id}`,
            type: 'info',
            read: false,
            timestamp: getCurrentTimestamp()
          } as Notification);
        }
      }
    }

    // If order is already approved (auto-approve), re-apply effects
    if (order.status === 'approved') {
      await api.approveOrder(order.id, order.approvedBy || 'system');
    }
  },
  getOrder: async (id: string) => {
    const orders = await api.getOrders();
    return (Array.isArray(orders) ? orders : []).find(o => o && o.id === id);
  },
  approveOrder: async (id: string, approverName: string) => {
    const orders = await api.getOrders();
    const order = (Array.isArray(orders) ? orders : []).find(o => o && o.id === id);
    if (!order) return { success: false, message: 'Order not found' };
    if (order.status === 'approved') return { success: true };

    // Update status locally to trigger the saveOrder logic
    const updatedOrder = { 
      ...order, 
      status: 'approved' as const, 
      approvedBy: approverName 
    };
    
    // Generate Commission Tokens if officer is assigned (only for dealer orders, NOT quotes)
    if (order.officer && !order.isQuote && (order.type === 'dealer' || order.type === 'regular')) {
      const officers = await api.getOfficers();
      const officer = officers.find(o => o.name.trim().toLowerCase() === order.officer?.trim().toLowerCase());
      if (officer) {
        const totalCommission = (order.items || []).reduce((sum, item) => sum + (Number(item.commission) || 0), 0);
        if (totalCommission > 0) {
          const newToken: any = {
            id: `TOKEN-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            orderId: order.id,
            dealerName: order.customerName || '',
            amount: totalCommission,
            date: order.date || getTodayISO(),
            status: 'pending'
          };
          const existingTokens = Array.isArray(officer.commissionTokens) ? officer.commissionTokens : [];
          const filteredTokens = existingTokens.filter((t: any) => t.orderId !== order.id);
          const updatedTokens = [...filteredTokens, newToken];
          
          await api.saveOfficer({
            ...officer,
            commissionTokens: updatedTokens
          });
        }
      }
    }

    // saveOrder already handles stock and balance adjustment
    await api.saveOrder(updatedOrder);

    // Notify member
    if (order.createdBy) {
      const users = await api.getUsers();
      const creator = users.find(u => u.name === order.createdBy || u.id === order.createdBy);
      if (creator && creator.role === 'member') {
        await api.addNotification({
          userId: creator.id,
          title: 'Order Approved',
          message: `Your order ${order.id} has been approved by ${approverName}`,
          type: 'success',
          read: false,
          timestamp: getCurrentTimestamp()
        } as Notification);
      }
    }

    return { success: true };
  },
  rejectOrder: async (id: string) => {
    const orders = await api.getOrders();
    const order = (Array.isArray(orders) ? orders : []).find(o => o && o.id === id);
    if (!order) return { success: false, message: 'Order not found' };

    await api.saveOrder({ ...order, status: 'rejected' });
    return { success: true };
  },
  disburseTargetReward: async (targetId: string, dealerId: string, cycles: number, officerId?: string) => {
    const targets = await api.getTargets();
    const target = targets.find(t => t.id === targetId);
    if (!target) return { success: false, message: 'Target not found' };

    const dealers = await api.getDealers();
    const dealer = dealers.find(d => d.id === dealerId);
    if (!dealer) return { success: false, message: 'Dealer not found' };

    const rewardAmount = Number(target.rewardValue || 0) * cycles;
    if (rewardAmount <= 0) return { success: false, message: 'Invalid reward amount' };

    const rewardId = `TGR-${Date.now()}`;
    const rewardRef = await api.getNextSerial(KEYS.TARGET_REWARD_COUNTER, 'G');

    // 1. Create Target Reward entry
    const reward: TargetReward = {
      id: rewardId,
      rewardRef,
      targetId,
      targetName: target.name,
      dealerId,
      dealerName: dealer.name,
      officerId: officerId || target.assignedOfficerId,
      officerName: '', // Will be filled if needed or looked up
      date: getTodayISO(),
      cycles,
      amount: rewardAmount,
      status: 'active'
    };

    // Lookup officer name
    if (reward.officerId) {
      const officers = await api.getOfficers();
      const officer = officers.find(o => o.id === reward.officerId);
      if (officer) reward.officerName = officer.name;
    }

    await api.saveTargetReward(reward);

    // 2. Update Dealer Balance (Credit reward to balance)
    await api.saveDealer({
      ...dealer,
      balance: (Number(dealer.balance) || 0) + rewardAmount
    });

    // 2.1 Add Ledger Entry for Reward Adjustment
    const payments = await api.getPayments();
    const lastPayment = [...payments].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }))[0];
    const lastIdMatch = lastPayment?.id?.match(/\d+/);
    const nextIdNum = lastIdMatch ? parseInt(lastIdMatch[0]) + 1 : 1;
    const nextPaymentId = `P${String(nextIdNum).padStart(4, '0')}`;

    await api.savePayment({
      id: nextPaymentId,
      dealerId,
      dealerName: dealer.name,
      date: getTodayISO(),
      type: 'Adjustment',
      amount: rewardAmount,
      reference: rewardRef,
      notes: `Commission adjustment for "${target.name}"`
    });

    // 3. Mark target as disbursed for this dealer (local state tracking in target if needed)
    const disbursedMap = target.rewardDisbursed || {};
    disbursedMap[dealerId] = (disbursedMap[dealerId] || 0) + cycles;
    
    await api.saveTarget({
      ...target,
      rewardDisbursed: disbursedMap
    });

    return { success: true, rewardRef };
  },

  exportAllData: async () => {
    const data: any = {};
    for (const key of SYNCED_KEYS) {
      data[key] = await getRemote(key, null);
    }
    return data;
  },
  importAllData: async (data: any) => {
    for (const key in data) {
      if (SYNCED_KEYS.includes(key as any)) {
        await pushRemote(key, data[key]);
      }
    }
    return { success: true };
  },

  // System
  clearAllData: async () => {
    localStorage.clear();
    window.location.reload();
  }
};
