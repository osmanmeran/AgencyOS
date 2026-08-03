import { describe, it, expect } from 'vitest';
import { renderTemplate, isSmtpConfigured } from '../../server/services/email.js';

describe('Email Service', () => {
  describe('isSmtpConfigured', () => {
    it('should return false when SMTP is not configured', () => {
      expect(isSmtpConfigured()).toBe(false);
    });
  });

  describe('renderTemplate', () => {
    it('should render generic template', () => {
      const html = renderTemplate('generic', { content: 'Hello World' });
      expect(html).toContain('Hello World');
      expect(html).toContain('Marvelops TravelPro');
    });

    it('should render proposal template', () => {
      const html = renderTemplate('proposal', {
        clientName: 'John Doe',
        destination: 'Istanbul',
        proposalUrl: 'https://example.com/proposal/1',
        agentName: 'Alice',
      });
      expect(html).toContain('John Doe');
      expect(html).toContain('Istanbul');
      expect(html).toContain('View Your Proposal');
    });

    it('should render booking confirmation template', () => {
      const html = renderTemplate('booking_confirmation', {
        clientName: 'Jane Smith',
        reference: 'BK-001',
        destination: 'Cappadocia',
        dates: 'June 15-20, 2026',
      });
      expect(html).toContain('BK-001');
      expect(html).toContain('Cappadocia');
      expect(html).toContain('Booking Confirmed');
    });

    it('should render invoice template', () => {
      const html = renderTemplate('invoice', {
        clientName: 'Jane Smith',
        invoiceNumber: 'INV-2026-001',
        amount: '$2,500',
        dueDate: 'July 1, 2026',
        invoiceUrl: 'https://example.com/invoice/1',
      });
      expect(html).toContain('INV-2026-001');
      expect(html).toContain('$2,500');
      expect(html).toContain('View Invoice');
    });

    it('should fallback to generic for unknown template', () => {
      const html = renderTemplate('unknown', { content: 'Fallback' });
      expect(html).toContain('Fallback');
    });
  });
});
