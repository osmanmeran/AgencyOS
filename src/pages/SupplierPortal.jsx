const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import { useState, useEffect } from 'react';
import { useT } from '@/lib/i18n/I18nContext';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonList } from '@/components/ui/skeletons';
import { 
  Package, Star, ClipboardList, 
  CheckCircle, Clock
} from 'lucide-react';
import SupplierServices from '../components/supplier-portal/SupplierServices';
import SupplierBookings from '../components/supplier-portal/SupplierBookings';
import SupplierInvoices from '../components/supplier-portal/SupplierInvoices';
import SupplierRatings from '../components/supplier-portal/SupplierRatings';
import SupplierQuoteRequests from '../components/supplier-portal/SupplierQuoteRequests';
import SupplierAnalytics from '../components/supplier-portal/SupplierAnalytics';

export default function SupplierPortal() {
  const { t } = useT();
  const [user, setUser] = useState(null);
  const [supplier, setSupplier] = useState(null);

  useEffect(() => {
    db.auth.me().then(async (currentUser) => {
      setUser(currentUser);
      if (currentUser.linked_supplier_id) {
        try {
          const allSuppliers = await db.entities.Supplier.list();
          const found = allSuppliers.find(s => s.id === currentUser.linked_supplier_id);
          if (found) setSupplier(found);
        } catch (e) {
          console.error('Failed to load supplier', e);
        }
      }
    });
  }, []);

  const { data: bookings = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierBookings', supplier?.id],
    queryFn: () => db.entities.BookingRequest.filter({ supplier_id: supplier.id }),
    enabled: !!supplier
  }));

  const { data: reviews = /** @type {any} */ ([]) } = /** @type {any} */ (useQuery({
    queryKey: ['supplierReviews', supplier?.id],
    queryFn: () => db.entities.SupplierReview.filter({ supplier_id: supplier.id }),
    enabled: !!supplier
  }));

  if (!user) return <SkeletonList />;

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <Card className="max-w-md mx-auto p-8">
          <Package className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Supplier Portal</h2>
          <p className="text-slate-600">{t('supplierPortal.notLinked')}</p>
        </Card>
      </div>
    );
  }

  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
    : 'N/A';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">{t('supplierPortal.welcome', { name: supplier.name })}</h1>
        <p className="text-slate-600">{t('supplierPortal.manageServices')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">{t('supplierPortal.pendingBookings')}</span>
            <Clock className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{pendingBookings}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">{t('supplierPortal.confirmed')}</span>
            <CheckCircle className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{confirmedBookings}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">{t('supplierPortal.totalBookings')}</span>
            <ClipboardList className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{bookings.length}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">{t('supplierPortal.avgRating')}</span>
            <Star className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{avgRating}</div>
        </Card>
      </div>

      <Tabs defaultValue="bookings" className="space-y-6">
        <TabsList className="bg-white border flex-wrap">
          <TabsTrigger value="bookings">{t('supplierPortal.bookingRequests')}</TabsTrigger>
          <TabsTrigger value="quotes">{t('supplierPortal.quoteRequests')}</TabsTrigger>
          <TabsTrigger value="services">{t('supplierPortal.myServices')}</TabsTrigger>
          <TabsTrigger value="invoices">{t('supplierPortal.myInvoices')}</TabsTrigger>
          <TabsTrigger value="reviews">{t('supplierPortal.reviews')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('supplierPortal.analytics')}</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings">
          <SupplierBookings supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="quotes">
          <SupplierQuoteRequests supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="services">
          <SupplierServices supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="invoices">
          <SupplierInvoices supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="reviews">
          <SupplierRatings supplierId={supplier.id} />
        </TabsContent>

        <TabsContent value="analytics">
          <SupplierAnalytics supplierId={supplier.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}