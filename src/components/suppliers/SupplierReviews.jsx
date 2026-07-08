import { db } from '@/lib/DbContext';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Plus, ThumbsUp, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useT } from '@/lib/i18n/I18nContext';

export default function SupplierReviews({ supplierId }) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    rating: 5,
    service_quality: 5,
    value_for_money: 5,
    communication: 5,
    review_text: '',
    would_recommend: true,
    trip_id: '',
  });

  const { data: reviews = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierReviews', supplierId],
      queryFn: () => db.entities.SupplierReview.filter({ supplier_id: supplierId }),
      enabled: !!supplierId,
    })
  );

  const { data: trips = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['trips'],
      queryFn: () => db.entities.Trip.list(),
    })
  );

  const { data: clients = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['clients'],
      queryFn: () => db.entities.Client.list(),
    })
  );

  const createMutation = /** @type {any} */ (
    useMutation({
      mutationFn: (/** @type {any} */ data) => db.entities.SupplierReview.create({ ...data, supplier_id: supplierId }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['supplierReviews', supplierId] });
        setModalOpen(false);
        setFormData({
          rating: 5,
          service_quality: 5,
          value_for_money: 5,
          communication: 5,
          review_text: '',
          would_recommend: true,
          trip_id: '',
        });
      },
    })
  );

  const avgRating =
    reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;

  const avgServiceQuality =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.service_quality || r.rating), 0) / reviews.length).toFixed(1)
      : 0;

  const recommendRate =
    reviews.length > 0 ? Math.round((reviews.filter((r) => r.would_recommend).length / reviews.length) * 100) : 0;

  const getClientName = (id) => clients.find((c) => c.id === id)?.name || t('supplierReviews.anonymousFallback');
  const getTripName = (id) => trips.find((t) => t.id === id)?.name || '';

  const StarRating = ({ value, onChange = (_v) => {}, readonly = false }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          className={`${readonly ? '' : 'hover:scale-110 transition-transform cursor-pointer'}`}
        >
          <Star className={`w-5 h-5 ${star <= value ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'}`} />
        </button>
      ))}
    </div>
  );

  return (
    <Card className="p-6 bg-card shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          {t('supplierReviews.title')}
        </h2>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t('supplierReviews.addReview')}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{avgRating}</div>
          <div className="flex justify-center mt-1">
            <StarRating value={Math.round(Number(avgRating))} readonly />
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {reviews.length === 1
              ? t('supplierReviews.reviewsCountSingular', { count: reviews.length })
              : t('supplierReviews.reviewsCountPlural', { count: reviews.length })}
          </div>
        </div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{avgServiceQuality}</div>
          <div className="text-sm text-muted-foreground mt-2">{t('supplierReviews.serviceQuality')}</div>
        </div>
        <div className="bg-muted rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-300">{recommendRate}%</div>
          <div className="text-sm text-muted-foreground mt-2">{t('supplierReviews.wouldRecommend')}</div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t('supplierReviews.noReviewsYet')}</div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-medium text-foreground">{getClientName(review.client_id)}</div>
                  {review.trip_id && (
                    <div className="text-sm text-muted-foreground">
                      {t('supplierReviews.tripLabel', { trip: getTripName(review.trip_id) })}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <StarRating value={review.rating} readonly />
                  <div className="text-xs text-muted-foreground mt-1">
                    {review.created_date && format(new Date(review.created_date), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
              {review.review_text && <p className="text-foreground text-sm mt-2">{review.review_text}</p>}
              {review.would_recommend && (
                <div className="flex items-center gap-1 mt-2 text-green-600 dark:text-green-300 text-sm">
                  <ThumbsUp className="w-4 h-4" />
                  {t('supplierReviews.wouldRecommendBadge')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Review Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('supplierReviews.addReview')}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(formData);
            }}
            className="space-y-4 mt-4"
          >
            <div className="space-y-2">
              <Label>{t('supplierReviews.tripOptionalLabel')}</Label>
              <Select value={formData.trip_id} onValueChange={(v) => setFormData({ ...formData, trip_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('supplierReviews.selectTripPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>{t('common.none')}</SelectItem>
                  {trips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>
                      {trip.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('supplierReviews.overallRatingLabel')}</Label>
              <StarRating value={formData.rating} onChange={(v) => setFormData({ ...formData, rating: v })} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">{t('supplierReviews.serviceQuality')}</Label>
                <StarRating
                  value={formData.service_quality}
                  onChange={(v) => setFormData({ ...formData, service_quality: v })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t('supplierReviews.valueForMoney')}</Label>
                <StarRating
                  value={formData.value_for_money}
                  onChange={(v) => setFormData({ ...formData, value_for_money: v })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t('supplierReviews.communication')}</Label>
                <StarRating
                  value={formData.communication}
                  onChange={(v) => setFormData({ ...formData, communication: v })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('supplierReviews.reviewLabel')}</Label>
              <Textarea
                value={formData.review_text}
                onChange={(e) => setFormData({ ...formData, review_text: e.target.value })}
                rows={3}
                placeholder={t('supplierReviews.reviewPlaceholder')}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recommend"
                checked={formData.would_recommend}
                onChange={(e) => setFormData({ ...formData, would_recommend: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="recommend">{t('supplierReviews.recommendCheckboxLabel')}</Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                {t('supplierReviews.submitReview')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
