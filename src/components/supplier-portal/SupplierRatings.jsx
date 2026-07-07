import { db } from '@/lib/DbContext';

import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/card';
import { Star, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function SupplierRatings({ supplierId }) {
  const { data: reviews = /** @type {any} */ ([]) } = /** @type {any} */ (
    useQuery({
      queryKey: ['supplierReviews', supplierId],
      queryFn: () => db.entities.SupplierReview.filter({ supplier_id: supplierId }, '-created_date'),
      enabled: !!supplierId,
    })
  );

  const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const avgServiceQuality =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.service_quality || r.rating), 0) / reviews.length : 0;

  const avgValueForMoney =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.value_for_money || r.rating), 0) / reviews.length : 0;

  const avgCommunication =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.communication || r.rating), 0) / reviews.length : 0;

  const recommendCount = reviews.filter((r) => r.would_recommend).length;

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-5 h-5 ${i <= rating ? 'text-yellow-500 dark:text-yellow-300 fill-yellow-500' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  if (reviews.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No reviews yet</h3>
        <p className="text-muted-foreground">Reviews from clients will appear here</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4">Rating Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-foreground mb-2">{avgRating.toFixed(1)}</div>
            {renderStars(Math.round(avgRating))}
            <div className="text-sm text-muted-foreground mt-1">Overall Rating</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">{avgServiceQuality.toFixed(1)}</div>
            {renderStars(Math.round(avgServiceQuality))}
            <div className="text-sm text-muted-foreground mt-1">Service Quality</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">{avgValueForMoney.toFixed(1)}</div>
            {renderStars(Math.round(avgValueForMoney))}
            <div className="text-sm text-muted-foreground mt-1">Value for Money</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground mb-2">{avgCommunication.toFixed(1)}</div>
            {renderStars(Math.round(avgCommunication))}
            <div className="text-sm text-muted-foreground mt-1">Communication</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex items-center justify-center gap-2">
          <ThumbsUp className="w-5 h-5 text-green-600 dark:text-green-300" />
          <span className="text-lg font-semibold">
            {recommendCount} of {reviews.length}
          </span>
          <span className="text-muted-foreground">would recommend</span>
        </div>
      </Card>

      {/* Individual Reviews */}
      <Card className="p-6 bg-card">
        <h3 className="text-lg font-bold text-foreground mb-4">Reviews ({reviews.length})</h3>
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-start mb-2">
                {renderStars(review.rating)}
                <div className="flex items-center gap-1 text-sm">
                  {review.would_recommend ? (
                    <>
                      <ThumbsUp className="w-4 h-4 text-green-600 dark:text-green-300" /> Recommends
                    </>
                  ) : (
                    <>
                      <ThumbsDown className="w-4 h-4 text-red-600 dark:text-red-300" /> Does not recommend
                    </>
                  )}
                </div>
              </div>
              {review.review_text && <p className="text-foreground mt-2">{review.review_text}</p>}
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>Service: {review.service_quality}/5</span>
                <span>Value: {review.value_for_money}/5</span>
                <span>Communication: {review.communication}/5</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
