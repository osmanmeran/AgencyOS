import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { DollarSign, Star, Calendar, CheckCircle } from 'lucide-react';

// const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function SupplierAnalytics({ supplierId }) {
  const { data: bookings = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierBookings', supplierId],
      queryFn: () => db.entities.BookingRequest.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  const { data: reviews = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierReviews', supplierId],
      queryFn: () => db.entities.SupplierReview.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  const { data: invoices = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierInvoices', supplierId],
      queryFn: () => db.entities.SupplierInvoice.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  // Calculate monthly booking trends
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(new Date(), i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const monthBookings = bookings.filter((b) => {
      if (!b.service_date) return false;
      const serviceDate = parseISO(b.service_date);
      return isWithinInterval(serviceDate, { start: monthStart, end: monthEnd });
    });

    const monthInvoices = invoices.filter((inv) => {
      if (!inv.issue_date) return false;
      const issueDate = parseISO(inv.issue_date);
      return isWithinInterval(issueDate, { start: monthStart, end: monthEnd });
    });

    monthlyData.push({
      month: format(monthDate, 'MMM'),
      bookings: monthBookings.length,
      revenue: monthInvoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0),
      confirmed: monthBookings.filter((b) => b.status === 'confirmed').length,
    });
  }

  // Booking status distribution
  const statusData = [
    { name: 'Confirmed', value: bookings.filter((b) => b.status === 'confirmed').length, color: '#10b981' },
    { name: 'Pending', value: bookings.filter((b) => b.status === 'pending').length, color: '#f59e0b' },
    { name: 'Completed', value: bookings.filter((b) => b.status === 'completed').length, color: '#3b82f6' },
    { name: 'Cancelled', value: bookings.filter((b) => b.status === 'cancelled').length, color: '#ef4444' },
  ].filter((s) => s.value > 0);

  // Rating breakdown
  const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => ({
    rating: `${rating} Stars`,
    count: reviews.filter((r) => Math.floor(r.rating) === rating).length,
  }));

  // Calculate stats
  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);
  const pendingPayments = invoices.filter((i) => i.status === 'approved').reduce((sum, i) => sum + (i.amount || 0), 0);
  const avgRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 'N/A';
  const confirmationRate =
    bookings.length > 0
      ? Math.round(
          (bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length / bookings.length) * 100,
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Total Revenue</span>
            <DollarSign className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${totalRevenue.toFixed(0)}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Pending Payments</span>
            <Calendar className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">${pendingPayments.toFixed(0)}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Avg Rating</span>
            <Star className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{avgRating}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Confirmation Rate</span>
            <CheckCircle className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{confirmationRate}%</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-card">
          <h3 className="text-lg font-bold text-foreground mb-4">Booking Trends</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="bookings" name="Total Bookings" fill="#3b82f6" />
              <Bar dataKey="confirmed" name="Confirmed" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-card">
          <h3 className="text-lg font-bold text-foreground mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `$${Number(value).toFixed(0)}`} />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-card">
          <h3 className="text-lg font-bold text-foreground mb-4">Booking Status Distribution</h3>
          {statusData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No booking data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-card">
          <h3 className="text-lg font-bold text-foreground mb-4">Rating Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={ratingBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="rating" type="category" width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Reviews Summary */}
      {reviews.length > 0 && (
        <Card className="p-6 bg-card">
          <h3 className="text-lg font-bold text-foreground mb-4">Recent Reviews</h3>
          <div className="space-y-4">
            {reviews.slice(0, 5).map((review) => (
              <div key={review.id} className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 dark:text-yellow-300 fill-yellow-500' : 'text-muted-foreground'}`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(review.created_date), 'MMM d, yyyy')}
                  </span>
                </div>
                {review.review_text && <p className="text-sm text-foreground">{review.review_text}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
