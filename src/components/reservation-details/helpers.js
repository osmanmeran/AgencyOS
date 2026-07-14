import { format } from 'date-fns';
import { getCurrencySymbol } from '@/lib/formatters';
import { assetUrl } from '@/lib/assetUrl';
import {
  Clock,
  Send,
  CheckCircle,
  XCircle,
  Building,
  ArrowRightLeft,
  User,
  Coffee,
  Plane,
  Map,
  Zap,
} from 'lucide-react';

export const currSymbol = (cur) => getCurrencySymbol(cur);

export const PROPOSAL_STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
    icon: Clock,
  },
  sent: { label: 'Sent', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300', icon: Send },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
    icon: CheckCircle,
  },
  rejected: { label: 'Rejected', color: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300', icon: XCircle },
};

export const SERVICE_TYPE_CONFIG = {
  lodging: {
    label: 'Lodging',
    icon: Building,
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  transfers: {
    label: 'Transfers',
    icon: ArrowRightLeft,
    color:
      'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  },
  guides: {
    label: 'Guides',
    icon: User,
    color:
      'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  restaurants: {
    label: 'Restaurants',
    icon: Coffee,
    color:
      'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  transportation: {
    label: 'Transportation',
    icon: Plane,
    color:
      'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  },
  guided_tours: {
    label: 'Guided Tours',
    icon: Map,
    color:
      'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  extra_activities: {
    label: 'Extra Activities',
    icon: Zap,
    color: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  },
};

export function buildEmailBody(trip, appSettings) {
  const sc = currSymbol(trip.selling_currency || 'USD');
  const itineraryUrl = `${window.location.origin}/client-itinerary?id=${trip.id}`;
  const companyName = appSettings?.invoice_header?.company_name || appSettings?.app_name || 'Marvel Tour';
  const companyAddress = [
    appSettings?.invoice_header?.address_line1,
    appSettings?.invoice_header?.city,
    appSettings?.invoice_header?.country,
  ]
    .filter(Boolean)
    .join(' · ');
  const companyPhone = appSettings?.invoice_header?.phone || '';
  const logoUrl = assetUrl(appSettings?.logo_url || '');
  const footerText = appSettings?.invoice_footer || '';

  // Escape free-text fields so client-entered values can't break the HTML.
  const esc = (v) => (v == null ? '' : String(v)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmtDate = (d) => {
    try {
      return format(new Date(d), 'MMM d, yyyy');
    } catch {
      return d || '';
    }
  };

  // Per-service detail card — client-facing fields only. Supplier identity,
  // buying cost and markup are deliberately omitted ("everything except
  // supplier").
  const serviceCards = (trip.services || [])
    .map((s) => {
      const qty = parseInt(s.quantity) || 1;
      const price = ((parseFloat(s.selling_price) || 0) * qty).toFixed(2);
      const rows = [];
      const addRow = (label, value) => {
        if (value)
          rows.push(
            `<tr><td style="padding:5px 0;color:#64748b;font-size:13px;width:130px;vertical-align:top;">${label}</td><td style="padding:5px 0;color:#1e293b;font-size:13px;">${esc(value)}</td></tr>`,
          );
      };

      if (s.start_date || s.end_date) {
        const ds = s.start_date ? fmtDate(s.start_date) : '';
        const de = s.end_date ? fmtDate(s.end_date) : ds;
        addRow('Date(s)', ds && de && ds !== de ? `${ds} – ${de}` : ds || de);
      }
      if (s.location) addRow('Location', s.location);
      if (s.description) addRow('Details', s.description);
      if (s.pickup_location || s.pickup_time)
        addRow('Pick up', `${s.pickup_location || ''}${s.pickup_time ? ` @ ${s.pickup_time}` : ''}`.trim());
      if (s.dropoff_location) addRow('Drop off', s.dropoff_location);
      if (s.transfer_flight_number) addRow('Flight', s.transfer_flight_number);
      if (s.return_leg && s.return_leg.enabled) {
        const rl = s.return_leg;
        const parts = [];
        if (rl.date) parts.push(fmtDate(rl.date));
        if (rl.pickup_location)
          parts.push(`Pick up: ${rl.pickup_location}${rl.pickup_time ? ` @ ${rl.pickup_time}` : ''}`);
        if (rl.dropoff_location) parts.push(`Drop off: ${rl.dropoff_location}`);
        if (rl.flight_number) parts.push(`Flight: ${rl.flight_number}`);
        addRow('Return', parts.join(' · '));
      }
      const unitLabel = s.unit ? s.unit.replace(/_/g, ' ') : '';
      if (qty > 1 || unitLabel) addRow('Quantity', `${qty}${unitLabel ? ` × ${unitLabel}` : ''}`);

      return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:14px;background:#ffffff;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:10px;">
          <div>
            <span style="color:#0f172a;font-size:15px;font-weight:700;">${esc(s.name)}</span>
            ${s.category ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#e0f2fe;color:#0369a1;border-radius:9999px;font-size:11px;font-weight:600;vertical-align:middle;">${esc(s.category)}</span>` : ''}
          </div>
          <span style="color:#0f172a;font-size:15px;font-weight:700;white-space:nowrap;">${sc}${price}</span>
        </div>
        ${rows.length ? `<table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:32px 40px;text-align:center;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="height:48px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;">` : ''}
    <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${companyName}</h1>
    ${companyAddress ? `<p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">${companyAddress}</p>` : ''}
    ${companyPhone ? `<p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">${companyPhone}</p>` : ''}
  </div>

  <!-- Title bar -->
  <div style="background:#f0f9ff;border-bottom:1px solid #bae6fd;padding:16px 40px;text-align:center;">
    <p style="margin:0;color:#0369a1;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Travel Reservation Confirmation</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 40px;">
    <p style="color:#1e293b;font-size:16px;margin:0 0 24px;">Dear <strong>${trip.client_name || 'Valued Client'}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 28px;line-height:1.6;">Please find your travel reservation details below. We look forward to making your journey unforgettable.</p>

    <!-- Trip Info -->
    <div style="background:#f8fafc;border-radius:12px;padding:20px 24px;margin-bottom:28px;border:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;width:140px;">Reservation</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${trip.name || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Reference</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${trip.reference_number || 'Pending'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Destination</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;">${trip.destination || '—'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-size:13px;">Dates</td>
          <td style="padding:6px 0;color:#1e293b;font-size:13px;">${trip.start_date || ''} → ${trip.end_date || ''}</td>
        </tr>
      </table>
    </div>

    ${
      serviceCards
        ? `
    <!-- Services -->
    <h3 style="color:#1e293b;font-size:14px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">Services Included</h3>
    <div style="margin-bottom:16px;">${serviceCards}</div>
    <div style="background:#1a1a2e;border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
      <span style="color:#94a3b8;font-size:13px;font-weight:600;">TOTAL</span>
      <span style="color:#ffffff;font-size:16px;font-weight:700;">${sc}${(trip.total_cost || 0).toFixed(2)}</span>
    </div>`
        : ''
    }

    ${trip.notes ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:24px;"><p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;"><strong>Notes:</strong> ${trip.notes}</p></div>` : ''}

    <!-- CTA Button -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${itineraryUrl}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.2px;">View Full Itinerary Online →</a>
    </div>

    ${
      trip.terms_and_conditions
        ? `
    <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:8px;">
      <h4 style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px;">Terms & Conditions</h4>
      <p style="color:#94a3b8;font-size:12px;line-height:1.7;margin:0;">${trip.terms_and_conditions}</p>
    </div>`
        : ''
    }
  </div>

  <!-- Footer -->
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
    ${footerText ? `<p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">${footerText}</p>` : ''}
    <p style="color:#cbd5e1;font-size:11px;margin:0;">${companyName} · ${new Date().toLocaleDateString('it-IT')}</p>
  </div>

</div>
</body>
</html>`;
}
