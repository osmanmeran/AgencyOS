const STORAGE_PREFIX = 'marvelops_mock_';
const CURRENT_USER_KEY = STORAGE_PREFIX + 'current_user';
const SEEDED_KEY = STORAGE_PREFIX + 'seeded';

const ENTITIES = [
  'AppSettings', 'BookingRequest', 'BookingTemplate', 'Client', 'ClientPayment',
  'ClientTask', 'EmailLog', 'Invoice', 'ItineraryEvent', 'Message', 'PackingItem',
  'Proposal', 'ProposalTemplate', 'ReferenceCounter', 'ServiceCategory',
  'ServiceTemplate', 'Supplier', 'SupplierBooking', 'SupplierCategory',
  'SupplierInvoice', 'SupplierPricing', 'SupplierReview', 'SupplierService',
  'SupplierSubcategory', 'Trip', 'Suggestion'
];

const UIDS = new Set();
function uid() {
  let id;
  do { id = Math.random().toString(36).slice(2, 10); } while (UIDS.has(id));
  UIDS.add(id);
  return id;
}

function loadCollection(name) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + name) || '[]');
  } catch { return []; }
}

function saveCollection(name, data) {
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));
}

function createEntityApi(entityName) {
  return {
    list: (sort) => {
      const records = loadCollection(entityName);
      if (sort) {
        const dir = sort.startsWith('-') ? -1 : 1;
        const field = sort.replace(/^-/, '');
        records.sort((a, b) => {
          const av = a[field] ?? '', bv = b[field] ?? '';
          return dir * (typeof av === 'string' ? av.localeCompare(bv) : av - bv);
        });
      }
      return records;
    },
    filter: (query, sort) => {
      let records = loadCollection(entityName);
      if (query && typeof query === 'object') {
        records = records.filter(r =>
          Object.entries(query).every(([k, v]) => {
            if (typeof v === 'object' && v !== null && '$in' in v) {
              return v.$in.includes(r[k]);
            }
            if (typeof v === 'object' && v !== null && '$gte' in v) {
              return r[k] >= v.$gte;
            }
            if (typeof v === 'object' && v !== null && '$lte' in v) {
              return r[k] <= v.$lte;
            }
            return String(r[k] ?? '').toLowerCase() === String(v).toLowerCase();
          })
        );
      }
      if (sort) {
        const dir = sort.startsWith('-') ? -1 : 1;
        const field = sort.replace(/^-/, '');
        records.sort((a, b) => {
          const av = a[field] ?? '', bv = b[field] ?? '';
          return dir * (typeof av === 'string' ? av.localeCompare(bv) : av - bv);
        });
      }
      return records;
    },
    get: (id) => {
      const records = loadCollection(entityName);
      return records.find(r => r.id === id) || null;
    },
    create: (data) => {
      const records = loadCollection(entityName);
      const record = { id: uid(), ...data, created_date: new Date().toISOString(), updated_date: new Date().toISOString() };
      records.push(record);
      saveCollection(entityName, records);
      return record;
    },
    update: (id, data) => {
      const records = loadCollection(entityName);
      const idx = records.findIndex(r => r.id === id);
      if (idx === -1) return null;
      records[idx] = { ...records[idx], ...data, updated_date: new Date().toISOString() };
      saveCollection(entityName, records);
      return records[idx];
    },
    delete: (id) => {
      const records = loadCollection(entityName);
      const idx = records.findIndex(r => r.id === id);
      if (idx === -1) return null;
      const removed = records.splice(idx, 1)[0];
      saveCollection(entityName, records);
      return removed;
    },
  };
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
  } catch { return null; }
}

function setCurrentUser(user) {
  if (user) {
    // Only store non-sensitive fields
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      language: user.language,
    }));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

const MOCK_USERS_STORED = [
  {
    id: 'user_admin_001', name: 'Admin User', email: 'admin@travelpro.com', language: 'en',
    user_tier: 'admin', role: 'admin', custom_permissions: [],
    client_id: null, linked_supplier_id: null,
  },
  {
    id: 'user_mgr_001', name: 'Manager User', email: 'manager@travelpro.com', language: 'en',
    user_tier: 'manager', role: 'manager', custom_permissions: [],
    client_id: null, linked_supplier_id: null,
  },
  {
    id: 'user_agent_001', name: 'Agent User', email: 'agent@travelpro.com', language: 'en',
    user_tier: 'agent', role: 'agent', custom_permissions: [],
    client_id: null, linked_supplier_id: null,
  },
];

function seedData() {
  if (localStorage.getItem(SEEDED_KEY)) return;
  localStorage.setItem(SEEDED_KEY, 'true');

  const now = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];

  // AppSettings
  saveCollection('AppSettings', [{
    id: uid(), app_name: 'Marvelops TravelPro', default_language: 'en',
    logo_url: '', reference_format: { prefix: 'TRP', include_department: true, include_category: true, include_year: true, include_client: false },
    departments: ['Luxury', 'Adventure', 'Corporate', 'Cruise'],
    invoice_header: { company_name: 'Marvelops Travel', address_line1: '123 Travel St', city: 'New York', country: 'USA', email: 'billing@marvelops.com', tax_id: 'TAX-12345', bank_details: 'Bank of America ••••4242' },
    default_payment_terms: 'Due within 30 days',
    default_invoice_notes: 'Thank you for your business!',
    created_date: now.toISOString(),
  }]);

  // SupplierCategory
  const cats = ['Accommodation', 'Transportation', 'Activities', 'Restaurants', 'Guides', 'Venues'];
  const catRecords = cats.map((name, i) => ({
    id: uid(), name, description: `${name} category`, sort_order: i + 1, is_active: true
  }));
  saveCollection('SupplierCategory', catRecords);

  // SupplierSubcategory
  const subcats = [
    { name: 'Hotels', category: 'Accommodation' }, { name: 'Resorts', category: 'Accommodation' }, { name: 'Villas', category: 'Accommodation' },
    { name: 'Flights', category: 'Transportation' }, { name: 'Transfers', category: 'Transportation' }, { name: 'Car Rental', category: 'Transportation' },
    { name: 'Tours', category: 'Activities' }, { name: 'Water Sports', category: 'Activities' }, { name: 'Cultural', category: 'Activities' },
    { name: 'Fine Dining', category: 'Restaurants' }, { name: 'Casual', category: 'Restaurants' },
    { name: 'Local Guides', category: 'Guides' },
    { name: 'Event Spaces', category: 'Venues' },
  ];
  const subcatRecords = subcats.map(s => ({
    id: uid(), name: s.name, category_name: s.category, is_active: true
  }));
  saveCollection('SupplierSubcategory', subcatRecords);

  // Suppliers
  const supplierData = [
    { name: 'Grand Plaza Hotel', contact_person: 'John Smith', email: 'reservations@grandplaza.com', phone: '+1-212-555-0100', city: 'New York', area: 'Manhattan', rating: 5, category_id: catRecords[0].id, pricing_info: 'From $350/night' },
    { name: 'Skyline Luxury Resort', contact_person: 'Sarah Johnson', email: 'concierge@skylineresort.com', phone: '+1-305-555-0200', city: 'Miami', area: 'South Beach', rating: 5, category_id: catRecords[0].id, pricing_info: 'From $450/night' },
    { name: 'Alpine Retreat', contact_person: 'Mark Williams', email: 'info@alpineretreat.com', phone: '+1-970-555-0300', city: 'Aspen', area: 'Downtown', rating: 4, category_id: catRecords[0].id, pricing_info: 'From $280/night' },
    { name: 'City Wings Airlines', contact_person: 'Emily Davis', email: 'groups@citywings.com', phone: '+1-800-555-0400', city: 'Atlanta', area: 'Airport', rating: 4, category_id: catRecords[1].id, pricing_info: 'Custom quotes' },
    { name: 'Express Transfers Inc', contact_person: 'Mike Brown', email: 'dispatch@expresstransfers.com', phone: '+1-312-555-0500', city: 'Chicago', area: 'Metro', rating: 4, category_id: catRecords[1].id, pricing_info: 'From $65/transfer' },
    { name: 'Ocean Adventures', contact_person: 'Lisa Garcia', email: 'bookings@oceanadventures.com', phone: '+1-808-555-0600', city: 'Honolulu', area: 'Waikiki', rating: 5, category_id: catRecords[2].id, pricing_info: 'From $120/person' },
    { name: 'Wine Country Tours', contact_person: 'Robert Chen', email: 'tours@winecountry.com', phone: '+1-707-555-0700', city: 'Napa', area: 'Valley', rating: 4, category_id: catRecords[2].id, pricing_info: 'From $85/person' },
    { name: 'Le Bistro Chic', contact_person: 'Pierre Dupont', email: 'reservations@lebistrochic.com', phone: '+1-415-555-0800', city: 'San Francisco', area: 'Downtown', rating: 5, category_id: catRecords[3].id, pricing_info: '$$$' },
    { name: 'Heritage Guide Services', contact_person: 'Anna Kowalski', email: 'info@heritageguides.com', phone: '+1-617-555-0900', city: 'Boston', area: 'Historical District', rating: 4, category_id: catRecords[4].id, pricing_info: 'From $200/day' },
  ];
  const supplierRecords = supplierData.map(s => ({
    id: uid(), ...s, status: 'active', website: `https://${s.name.toLowerCase().replace(/\s+/g, '')}.com`,
    address: `123 ${s.name} Blvd`, country: 'USA', notes: '', custom_fields: {},
    created_date: now.toISOString(),
  }));
  saveCollection('Supplier', supplierRecords);

  // SupplierService
  const serviceData = [];
  supplierRecords.forEach(s => {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      serviceData.push({
        id: uid(), supplier_id: s.id, subcategory_id: subcatRecords[i % subcatRecords.length].id,
        service_name: `${s.name} Service ${i + 1}`, description: `Service offered by ${s.name}`,
        budgeted_cost: 100 + Math.random() * 900, actual_cost: 100 + Math.random() * 900,
        currency: 'USD', unit: 'per_person', status: 'quoted', approval_status: 'approved',
        notes: '',
      });
    }
  });
  saveCollection('SupplierService', serviceData);

  // SupplierPricing
  const pricingRecords = supplierRecords.slice(0, 6).map(s => ({
    id: uid(), supplier_id: s.id, service_id: uid(), subcategory_id: subcatRecords[0].id,
    name: `${s.name} - Standard`, description: 'Standard pricing tier', base_price: 100 + Math.random() * 800,
    client_price: 150 + Math.random() * 1200, currency: 'USD', unit: 'per_person',
    season_type: 'all_year', min_quantity: 1, markup_percentage: 25, is_active: true,
    approval_status: 'approved', notes: '',
  }));
  saveCollection('SupplierPricing', pricingRecords);

  // Clients
  const clientData = [
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1-212-555-1001', company: 'Acme Corp', city: 'New York', country: 'USA', status: 'vip', type: 'client' },
    { name: 'Bob Williams', email: 'bob@example.com', phone: '+1-310-555-1002', company: 'GlobalTech', city: 'Los Angeles', country: 'USA', status: 'active', type: 'client' },
    { name: 'Carolina Perez', email: 'carolina@example.com', phone: '+1-305-555-1003', company: 'Perez Group', city: 'Miami', country: 'USA', status: 'active', type: 'client' },
    { name: 'David Kim', email: 'david@example.com', phone: '+1-415-555-1004', company: 'Kim Consulting', city: 'San Francisco', country: 'USA', status: 'active', type: 'client' },
    { name: 'Emma Thompson', email: 'emma@example.com', phone: '+1-617-555-1005', company: 'Thompson Travels', city: 'Boston', country: 'USA', status: 'vip', type: 'client' },
    { name: 'Frank Miller', email: 'frank@example.com', phone: '+1-312-555-1006', company: 'Miller Enterprises', city: 'Chicago', country: 'USA', status: 'inactive', type: 'client' },
    { name: 'Grace Lee', email: 'grace@example.com', phone: '+1-206-555-1007', company: 'Lee & Associates', city: 'Seattle', country: 'USA', status: 'active', type: 'client' },
  ];
  const clientRecords = clientData.map(c => ({
    id: uid(), ...c, address: `Suite ${Math.floor(Math.random() * 500) + 100}, ${Math.floor(Math.random() * 9999) + 1} Main St`,
    region: '', postal_code: '', notes: '', passport_number: '', tax_id: '',
    portal_access: true, total_paid: 0,
    created_date: new Date(now - Math.random() * 90 * 86400000).toISOString(),
  }));
  saveCollection('Client', clientRecords);

  // Trips
  const statuses = ['draft', 'active', 'completed', 'cancelled'];
  const tripRecords = clientRecords.slice(0, 5).map((c, i) => {
    const start = new Date(now.getTime() + (i - 2) * 30 * 86400000);
    const end = new Date(start.getTime() + (3 + Math.floor(Math.random() * 10)) * 86400000);
    return {
      id: uid(), client_id: c.id, client_name: c.name, client_email: c.email,
      name: `${c.name}'s ${['European Adventure', 'Beach Getaway', 'Corporate Retreat', 'Family Vacation', 'Honeymoon Trip'][i]}`,
      destination: ['Paris', 'Cancun', 'Tokyo', 'Orlando', 'Santorini'][i],
      start_date: fmt(start), end_date: fmt(end),
      status: statuses[i % statuses.length], proposal_status: (i < 3 ? 'confirmed' : 'draft'),
      total_cost: 2000 + Math.random() * 8000, currency: 'USD',
      num_travelers: 1 + Math.floor(Math.random() * 4),
      notes: '', passengers: [{ name: c.name, email: c.email }],
      activities: [], services: [], created_date: new Date(now - (5 - i) * 7 * 86400000).toISOString(),
    };
  });
  saveCollection('Trip', tripRecords);

  // Proposals
  const proposalRecords = clientRecords.slice(0, 6).map((c, i) => ({
    id: uid(), client_id: c.id, client_name: c.name, client_email: c.email,
    title: `${c.name}'s ${['Luxury Europe Tour', 'Caribbean Escape', 'Asia Discovery', 'US Road Trip', 'Mediterranean Cruise', 'Safari Adventure'][i]}`,
    status: ['draft', 'sent', 'accepted', 'rejected', 'draft', 'sent'][i],
    total_cost: 3000 + Math.random() * 12000, currency: 'USD',
    num_travelers: 1 + Math.floor(Math.random() * 4),
    source_trip_id: i < 3 ? tripRecords[i]?.id : null, notes: '',
    proposal_data: { introduction: 'Thank you for choosing us!', itinerary_summary: 'A wonderful journey awaits...' },
    created_date: new Date(now - (6 - i) * 5 * 86400000).toISOString(),
  }));
  saveCollection('Proposal', proposalRecords);

  // Invoices
  const invoiceStatuses = ['draft', 'sent', 'paid', 'overdue'];
  const invoiceRecords = clientRecords.slice(0, 6).map((c, i) => ({
    id: uid(), client_id: c.id, client_name: c.name, client_email: c.email,
    trip_id: i < 3 ? tripRecords[i]?.id : null, proposal_id: i < 3 ? proposalRecords[i]?.id : null,
    invoice_number: `INV-${2024}${String(i + 1).padStart(4, '0')}`,
    status: invoiceStatuses[i % invoiceStatuses.length],
    issue_date: fmt(new Date(now - (6 - i) * 15 * 86400000)),
    due_date: fmt(new Date(now - (6 - i) * 15 * 86400000 + 30 * 86400000)),
    total_amount: 1500 + Math.random() * 6000, amount_paid: 0, amount_due: 1500 + Math.random() * 6000,
    currency: 'USD', tax_rate: 8.5, line_items: [
      { description: 'Accommodation', quantity: 5, unit_price: 350, amount: 1750 },
      { description: 'Transfers', quantity: 3, unit_price: 85, amount: 255 },
    ],
    notes: '', cancelled_by: '',
    created_date: new Date(now - (6 - i) * 15 * 86400000).toISOString(),
  }));
  saveCollection('Invoice', invoiceRecords);

  // SupplierBooking
  const bookingRecords = tripRecords.slice(0, 3).flatMap(t => {
    const supp = supplierRecords.slice(0, 3);
    return supp.map(s => ({
      id: uid(), supplier_id: s.id, supplier_name: s.name, category_name: s.category_id ? catRecords.find(c => c.id === s.category_id)?.name : '',
      trip_id: t.id, service_date: fmt(new Date(t.start_date)), num_people: t.num_travelers || 2,
      status: 'confirmed', total_cost: 200 + Math.random() * 1500, currency: 'USD',
      pricing_id: uid(), pricing_name: 'Standard', notes: '', service_type: 'Standard',
    }));
  });
  saveCollection('SupplierBooking', bookingRecords);

  // BookingRequest
  const brRecords = bookingRecords.slice(0, 4).map(b => ({
    id: uid(), supplier_id: b.supplier_id, trip_id: b.trip_id, client_id: uid(),
    service_date: b.service_date, num_guests: 2, status: 'sent',
    reference_number: `BR-${uid().slice(0, 6).toUpperCase()}`,
    notes: '', total_cost: b.total_cost,
  }));
  saveCollection('BookingRequest', brRecords);

  // ClientPayment
  const paymentRecords = invoiceRecords.filter(i => i.status === 'paid').map(i => ({
    id: uid(), client_id: i.client_id, invoice_id: i.id, trip_id: i.trip_id,
    amount: i.total_amount, currency: 'USD',
    payment_date: fmt(i.issue_date), payment_method: 'credit_card',
    status: 'completed', transaction_id: `TXN-${uid().toUpperCase()}`,
    notes: '', receipt_url: '',
  }));
  saveCollection('ClientPayment', paymentRecords);

  // SupplierInvoice
  const siRecords = bookingRecords.slice(0, 4).map(b => ({
    id: uid(), supplier_id: b.supplier_id, booking_request_id: uid(),
    invoice_number: `SI-${uid().slice(0, 6).toUpperCase()}`,
    status: 'pending', total_amount: b.total_cost, currency: 'USD',
    issue_date: fmt(now), due_date: fmt(new Date(now.getTime() + 30 * 86400000)),
    notes: '',
  }));
  saveCollection('SupplierInvoice', siRecords);

  // ServiceCategory (for ServiceLibrary)
  const serviceCats = ['Tours', 'Transfers', 'Accommodation', 'Activities', 'Dining', 'Wellness'];
  const scRecords = serviceCats.map((name, i) => ({
    id: uid(), name, description: `${name} services`, icon: 'star', sort_order: i + 1, is_active: true,
  }));
  saveCollection('ServiceCategory', scRecords);

  // ServiceTemplate
  const stRecords = scRecords.slice(0, 4).flatMap(sc => [
    { id: uid(), category_id: sc.id, name: `Standard ${sc.name}`, description: `Standard ${sc.name} package`, base_price: 100 + Math.random() * 400, currency: 'USD', price_unit: 'per_person', is_active: true, duration: '2 hours', supplier_ids: [], supplier_contacts: [], meeting_point: '', meeting_time: '', included: '', not_included: '' },
    { id: uid(), category_id: sc.id, name: `Premium ${sc.name}`, description: `Premium ${sc.name} package`, base_price: 300 + Math.random() * 700, currency: 'USD', price_unit: 'per_person', is_active: true, duration: '4 hours', supplier_ids: [], supplier_contacts: [], meeting_point: '', meeting_time: '', included: '', not_included: '' },
  ]);
  saveCollection('ServiceTemplate', stRecords);

  // ReferenceCounter
  saveCollection('ReferenceCounter', [
    { id: uid(), department: 'Luxury', year: now.getFullYear(), month: now.getMonth() + 1, counter: 5 },
    { id: uid(), department: 'Adventure', year: now.getFullYear(), month: now.getMonth() + 1, counter: 3 },
    { id: uid(), department: 'Corporate', year: now.getFullYear(), month: now.getMonth() + 1, counter: 8 },
  ]);

  // BookingTemplate
  saveCollection('BookingTemplate', [
    { id: uid(), name: 'Standard Booking Request', html_content: '<h2>Booking Request</h2><p>Service: {{reference_number}}</p>', is_default: true },
    { id: uid(), name: 'VIP Booking Request', html_content: '<h2>VIP Booking Request</h2><p>Service: {{reference_number}}</p>', is_default: false },
  ]);

  // ClientTask
  const taskData = [
    { client_id: clientRecords[0].id, title: 'Send welcome package', description: 'Prepare and send welcome materials', status: 'pending', due_date: fmt(new Date(now.getTime() + 3 * 86400000)), priority: 'high' },
    { client_id: clientRecords[0].id, title: 'Confirm flight preferences', description: 'Call client to confirm seat and meal preferences', status: 'in_progress', due_date: fmt(new Date(now.getTime() + 7 * 86400000)), priority: 'medium' },
    { client_id: clientRecords[1].id, title: 'Book restaurant reservations', description: 'Make dinner reservations for client', status: 'pending', due_date: fmt(new Date(now.getTime() + 5 * 86400000)), priority: 'medium' },
  ];
  saveCollection('ClientTask', taskData.map(t => ({ id: uid(), ...t, created_date: now.toISOString() })));

  // EmailLog
  saveCollection('EmailLog', [
    { id: uid(), to: 'alice@example.com', subject: 'Trip Confirmation', body: 'Your trip has been confirmed!', status: 'sent', sent_date: now.toISOString() },
    { id: uid(), to: 'bob@example.com', subject: 'Invoice Reminder', body: 'Your invoice is due soon.', status: 'sent', sent_date: now.toISOString() },
  ]);

  // ItineraryEvent
  if (tripRecords.length > 0) {
    const events = [];
    tripRecords.slice(0, 2).forEach(t => {
      ['Day 1: Arrival', 'Day 2: City Tour', 'Day 3: Free Time', 'Day 4: Excursion', 'Day 5: Departure'].forEach((title, i) => {
        const d = new Date(t.start_date);
        d.setDate(d.getDate() + i);
        events.push({
          id: uid(), trip_id: t.id, title, description: `${title} event description`,
          date: fmt(d), time: '09:00', location: t.destination, category: 'activity',
          notes: '', sort_order: i + 1,
        });
      });
    });
    saveCollection('ItineraryEvent', events);
  }

  // Message
  saveCollection('Message', [
    { id: uid(), client_id: clientRecords[0]?.id, subject: 'Question about itinerary', body: 'Can we add a day trip?', sender: 'client', status: 'unread', created_date: new Date(now - 2 * 86400000).toISOString() },
    { id: uid(), client_id: clientRecords[0]?.id, subject: 'Re: Question about itinerary', body: 'Sure, let me check availability!', sender: 'agent', status: 'read', created_date: new Date(now - 1 * 86400000).toISOString() },
  ]);

  // PackingItem
  tripRecords.slice(0, 2).forEach(t => {
    saveCollection('PackingItem', [
      { id: uid(), trip_id: t.id, category: 'Clothing', item: 'Shirts', quantity: 5, is_packed: false },
      { id: uid(), trip_id: t.id, category: 'Clothing', item: 'Pants', quantity: 3, is_packed: false },
      { id: uid(), trip_id: t.id, category: 'Toiletries', item: 'Toothbrush', quantity: 1, is_packed: true },
      { id: uid(), trip_id: t.id, category: 'Documents', item: 'Passport', quantity: 1, is_packed: true },
    ]);
  });

  // SupplierReview
  supplierRecords.slice(0, 5).forEach(s => {
    saveCollection('SupplierReview', [
      { id: uid(), supplier_id: s.id, rating: 4 + Math.floor(Math.random() * 2), title: 'Great service', comment: 'Very professional and responsive.', reviewer_name: 'Alice Johnson', created_date: new Date(now - Math.random() * 60 * 86400000).toISOString() },
    ]);
  });
}

export function initMockBackend() {
  seedData();

  const db = globalThis.__B44_DB__;
  if (!db) return null;

  // Build localStorage-backed entity APIs
  const entityApis = {};
  ENTITIES.forEach(name => {
    entityApis[name] = createEntityApi(name);
  });

  // Mutate the existing object so all existing references (const db in other files) see the updates
  Object.assign(db, {
    auth: {
      isAuthenticated: async () => !!getCurrentUser(),
      me: async () => getCurrentUser(),
      loginViaEmailPassword: async (email, password) => {
        const user = MOCK_USERS_STORED.find(u => u.email === email);
        if (user) {
          setCurrentUser(user);
          return user;
        }
        if (email.includes('admin') || email === 'admin@travelpro.com') {
          setCurrentUser(MOCK_USERS_STORED[0]);
          return MOCK_USERS_STORED[0];
        }
        throw new Error('Invalid credentials');
      },
      login: async (email) => {
        const user = MOCK_USERS_STORED.find(u => u.email === email) || { ...MOCK_USERS_STORED[0], email, name: email.split('@')[0] };
        setCurrentUser(user);
        return user;
      },
      updateMe: async (data) => {
        const user = getCurrentUser();
        if (!user) return null;
        const updated = { ...user, ...data };
        setCurrentUser(updated);
        return updated;
      },
      logout: (redirectUrl) => {
        setCurrentUser(null);
      },
      redirectToLogin: (returnUrl) => {
        window.location.href = '/mock-login?returnUrl=' + encodeURIComponent(returnUrl || window.location.href);
      },
      microsoftLogin: async (idToken) => {
        const user = MOCK_USERS_STORED[0];
        setCurrentUser(user);
        return user;
      },
    },
    entities: entityApis,
    integrations: {
      Core: {
        UploadFile: async (data) => {
          const file = data?.file;
          if (file instanceof File || file instanceof Blob) {
            const url = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(file);
            });
            return { file_url: url };
          }
          return { file_url: URL.createObjectURL(new Blob([data?.content || ''])) };
        },
        SendEmail: async ({ to, subject, body }) => {
          console.log('[Mock Email] To:', to, 'Subject:', subject);
          const logs = loadCollection('EmailLog');
          logs.push({ id: uid(), to, subject, body, status: 'sent', sent_date: new Date().toISOString() });
          saveCollection('EmailLog', logs);
          return { success: true };
        },
        SendSMS: async ({ to, message }) => {
          console.log('[Mock SMS] To:', to, 'Message:', message);
          return { success: true };
        },
        InvokeLLM: async ({ prompt }) => {
          console.log('[Mock LLM] Prompt:', prompt);
          return { result: `Mock response for: ${prompt.slice(0, 50)}...` };
        },
        GenerateImage: async ({ prompt }) => {
          return { image_url: '' };
        },
        ExtractDataFromUploadedFile: async (fileUrl) => {
          return { data: { name: 'Extracted Name', email: 'extracted@example.com' } };
        },
        SupplierWebSearch: async ({ name, city }) => {
          console.log('[Mock Web Search]', name, city);
          return {
            success: true,
            results: [
              {
                name: name || 'Example Hotel',
                address: `123 ${name || 'Example'} St, ${city || 'Istanbul'}, Turkey`,
                phone: '+90-212-555-0100',
                website: `https://${(name || 'example').toLowerCase().replace(/\s+/g, '')}.com`,
                email: `info@${(name || 'example').toLowerCase().replace(/\s+/g, '')}.com`,
                description: `${name || 'Example Hotel'} is a premier provider in ${city || 'Istanbul'}. Known for exceptional service and quality accommodations.`,
                rating: 4.5,
                source: 'nominatim',
              },
            ],
          };
        },
      },
    },
    appLogs: {
      logUserInApp: async (pageName) => {
        console.log('[Mock Log] Page:', pageName);
      },
    },
    Query: {
      query: async (sql) => {
        console.log('[Mock Query] SQL:', sql);
        return [];
      }
    },
  });

  db.User = db.auth;
  db.Core = db.integrations.Core;
  db.entities.Query = db.Query;

  return db;
}
