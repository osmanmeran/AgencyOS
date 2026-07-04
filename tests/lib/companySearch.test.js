import { describe, it, expect } from 'vitest';
import { filterClientsByCompany, colleaguesOf, normalizeCompany } from '../../src/lib/companySearch.js';

const clients = [
  { id: '1', name: 'Jane Doe', email: 'jane@acme.com', company: 'Acme Corp', phone: '111' },
  { id: '2', name: 'John Smith', email: 'john@acme.com', company: 'acme corp', phone: '222' },
  { id: '3', name: 'Mary Poppins', email: 'mary@globex.com', company: 'Globex', phone: '333' },
  { id: '4', name: 'Solo Freelancer', email: 'solo@nowhere.com', company: '', phone: '444' },
];

describe('normalizeCompany', () => {
  it('trims and lowercases', () => {
    expect(normalizeCompany('  Acme Corp ')).toBe('acme corp');
    expect(normalizeCompany(null)).toBe('');
  });
});

describe('filterClientsByCompany', () => {
  it('returns everything for an empty query', () => {
    const { results, colleagueIds } = filterClientsByCompany(clients, '');
    expect(results).toHaveLength(4);
    expect(colleagueIds.size).toBe(0);
  });

  it('searching a company name returns all contacts in that company', () => {
    const { results } = filterClientsByCompany(clients, 'acme');
    expect(results.map(c => c.id).sort()).toEqual(['1', '2']);
  });

  it('groups case-insensitively despite differing company casing', () => {
    const { results } = filterClientsByCompany(clients, 'Acme Corp');
    expect(results.map(c => c.id).sort()).toEqual(['1', '2']);
  });

  it('searching one person pulls in their colleagues and flags them', () => {
    const { results, colleagueIds } = filterClientsByCompany(clients, 'jane');
    expect(results.map(c => c.id).sort()).toEqual(['1', '2']);
    // John is included only because he shares Jane's company.
    expect(colleagueIds.has('2')).toBe(true);
    expect(colleagueIds.has('1')).toBe(false);
  });

  it('does not group contacts that have no company', () => {
    const { results } = filterClientsByCompany(clients, 'solo');
    expect(results.map(c => c.id)).toEqual(['4']);
  });

  it('returns no results when nothing matches', () => {
    const { results } = filterClientsByCompany(clients, 'zzz');
    expect(results).toHaveLength(0);
  });
});

describe('colleaguesOf', () => {
  it('returns other contacts at the same company, excluding self', () => {
    const cols = colleaguesOf(clients[0], clients);
    expect(cols.map(c => c.id)).toEqual(['2']);
  });

  it('returns empty for a contact with no company', () => {
    expect(colleaguesOf(clients[3], clients)).toEqual([]);
  });
});
