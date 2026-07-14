import { describe, it, expect } from 'vitest';
import { effectiveClientBilling, CLIENT_BILLING_FIELDS } from '../../shared/clientBilling.js';

// A Client linked to a Company inherits the Company's markup, invoice details
// and currency when the client has not set its own. Client-owned values win.
describe('effectiveClientBilling (company -> client inheritance)', () => {
  const company = {
    type: 'Company',
    name: 'ACME Corp',
    default_markup: 20,
    preferred_currency: 'EUR',
    tax_id: 'COMP-TAX',
    invoice_address: 'Company Street 1',
    payment_method: 'bank',
  };

  it('inherits every field when the client sets none', () => {
    const client = { type: 'Client', name: 'Jane', company_id: company.id };
    const eff = effectiveClientBilling(client, company);
    expect(eff).toMatchObject({
      default_markup: 20,
      preferred_currency: 'EUR',
      tax_id: 'COMP-TAX',
      invoice_address: 'Company Street 1',
      payment_method: 'bank',
    });
  });

  it('client values take precedence over the company', () => {
    const client = {
      type: 'Client',
      name: 'Jane',
      company_id: company.id,
      default_markup: 5,
      preferred_currency: 'USD',
      tax_id: 'CLI-TAX',
      invoice_address: 'Client Avenue 9',
      payment_method: 'card',
    };
    const eff = effectiveClientBilling(client, company);
    expect(eff).toMatchObject({
      default_markup: 5,
      preferred_currency: 'USD',
      tax_id: 'CLI-TAX',
      invoice_address: 'Client Avenue 9',
      payment_method: 'card',
    });
  });

  it('treats a 0/absent markup as unset so it inherits from the company', () => {
    const client = { type: 'Client', name: 'Jane', company_id: company.id, default_markup: 0 };
    expect(effectiveClientBilling(client, company).default_markup).toBe(20);
    const noMarkup = { type: 'Client', name: 'Jane', company_id: company.id };
    expect(effectiveClientBilling(noMarkup, company).default_markup).toBe(20);
  });

  it('falls back to the client value when the company has none', () => {
    const bareCompany = { type: 'Company', name: 'ACME Corp' };
    const client = { type: 'Client', name: 'Jane', company_id: bareCompany.id, preferred_currency: 'GBP' };
    expect(effectiveClientBilling(client, bareCompany).preferred_currency).toBe('GBP');
  });

  it('returns client defaults when no company is linked', () => {
    const client = { type: 'Client', name: 'Jane', preferred_currency: 'USD', default_markup: 10 };
    const eff = effectiveClientBilling(client, null);
    expect(eff.preferred_currency).toBe('USD');
    expect(eff.default_markup).toBe(10);
  });

  it('does not mutate the original client object', () => {
    const client = { type: 'Client', name: 'Jane', company_id: company.id };
    const snapshot = { ...client };
    effectiveClientBilling(client, company);
    expect(client).toEqual(snapshot);
  });

  it('exposes the expected billing field set', () => {
    expect([...CLIENT_BILLING_FIELDS].sort()).toEqual(
      ['default_markup', 'preferred_currency', 'tax_id', 'invoice_address', 'payment_method'].sort(),
    );
  });
});
