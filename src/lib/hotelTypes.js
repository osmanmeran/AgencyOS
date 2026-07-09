export const HOTEL_TYPE_OPTIONS = [
  { value: 5, label: '5 Stars' },
  { value: 4, label: '4 Stars' },
  { value: 3, label: '3 Stars' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'cave', label: 'Cave' },
];

export function isNumericStar(rating) {
  return typeof rating === 'number' || !isNaN(Number(rating));
}

export function formatHotelType(rating) {
  if (rating === 'boutique') return 'Boutique Hotel';
  if (rating === 'cave') return 'Cave Hotel';
  const n = Number(rating);
  if (!isNaN(n) && n >= 1 && n <= 5) return `${n} Stars`;
  return '';
}
