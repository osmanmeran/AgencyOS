import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { generateBookingConfirmation, generateProposal, generateInvoice } from '../../server/services/pdf.js';

describe('PDF Service', () => {
  it('should generate a booking confirmation PDF', async () => {
    const { filePath, filename } = await generateBookingConfirmation({
      clientName: 'John Doe',
      reference: 'BK-001',
      destination: 'Istanbul',
      dates: 'June 15-20, 2026',
    });
    expect(fs.existsSync(filePath)).toBe(true);
    expect(filename).toContain('BK-001');
    expect(filePath).toContain('pdfs');
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(100);
    fs.unlinkSync(filePath);
  });

  it('should generate a proposal PDF', async () => {
    const { filePath, filename } = await generateProposal({
      clientName: 'Jane Smith',
      destination: 'Cappadocia',
      agentName: 'Alice',
    });
    expect(fs.existsSync(filePath)).toBe(true);
    expect(filename).toContain('Jane_Smith');
    fs.unlinkSync(filePath);
  });

  it('should generate an invoice PDF', async () => {
    const { filePath, filename } = await generateInvoice({
      clientName: 'Jane Smith',
      invoiceNumber: 'INV-001',
      amount: '$2,500',
      dueDate: 'July 1, 2026',
    });
    expect(fs.existsSync(filePath)).toBe(true);
    expect(filename).toContain('INV-001');
    fs.unlinkSync(filePath);
  });
});
