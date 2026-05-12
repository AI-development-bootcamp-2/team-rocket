/// <reference types="jest" />
/**
 * Unit tests — auditLog.middleware.ts
 *
 * extractIpAddress: pure function, no mocks needed.
 * auditLogMiddleware: mocks writeAuditLog and Express req/res/next objects.
 */

import { Request, Response } from 'express';

// Mock writeAuditLog so we never touch the DB.
jest.mock('../../../src/services/auth.service', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { extractIpAddress, auditLogMiddleware } from '../../../src/middleware/auditLog.middleware';
import { writeAuditLog } from '../../../src/services/auth.service';

const mockWriteAuditLog = writeAuditLog as jest.MockedFunction<typeof writeAuditLog>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/clients',
    headers: {},
    ip: '1.2.3.4',
    user: { id: 99, role: 'admin' },
    ...overrides,
  } as unknown as Request;
}

function makeRes(statusCode = 200): Response & { json: jest.Mock } {
  const res = {
    statusCode,
    json: jest.fn().mockReturnThis(),
  } as unknown as Response & { json: jest.Mock };
  return res;
}


// ── extractIpAddress ──────────────────────────────────────────────────────────

describe('extractIpAddress', () => {
  it('returns the first address from x-forwarded-for when present', () => {
    const req = makeReq({ headers: { 'x-forwarded-for': '203.0.113.5' } });
    expect(extractIpAddress(req)).toBe('203.0.113.5');
  });

  it('returns only the first hop when x-forwarded-for is comma-separated', () => {
    const req = makeReq({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 172.16.0.1' } });
    expect(extractIpAddress(req)).toBe('203.0.113.5');
  });

  it('trims whitespace from the first hop', () => {
    const req = makeReq({ headers: { 'x-forwarded-for': '  203.0.113.5  , 10.0.0.1' } });
    expect(extractIpAddress(req)).toBe('203.0.113.5');
  });

  it('falls back to req.ip when x-forwarded-for is absent', () => {
    const req = makeReq({ headers: {}, ip: '192.168.1.100' });
    expect(extractIpAddress(req)).toBe('192.168.1.100');
  });

  it('returns empty string when both x-forwarded-for and req.ip are absent', () => {
    const req = makeReq({ headers: {}, ip: undefined });
    expect(extractIpAddress(req)).toBe('');
  });

  it('truncates the result to 45 characters (IPv6 column max)', () => {
    const longIp = 'a'.repeat(60);
    const req = makeReq({ headers: { 'x-forwarded-for': longIp } });
    expect(extractIpAddress(req)).toHaveLength(45);
  });

  it('handles a full IPv6 address from x-forwarded-for', () => {
    const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    const req = makeReq({ headers: { 'x-forwarded-for': ipv6 } });
    expect(extractIpAddress(req)).toBe(ipv6);
  });
});

// ── auditLogMiddleware — skipping conditions ───────────────────────────────────

describe('auditLogMiddleware — skips and calls next()', () => {
  beforeEach(() => mockWriteAuditLog.mockClear());

  it('calls next() immediately for GET requests without patching res.json', () => {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    const next = jest.fn();
    const originalJson = res.json;

    auditLogMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('calls next() for POST to an unmapped path without patching res.json', () => {
    const req = makeReq({ method: 'POST', path: '/unknown-resource' });
    const res = makeRes();
    const next = jest.fn();
    const originalJson = res.json;

    auditLogMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it('calls next() for PATCH (unmapped method) without patching res.json', () => {
    const req = makeReq({ method: 'PATCH', path: '/clients' });
    const res = makeRes();
    const next = jest.fn();
    const originalJson = res.json;

    auditLogMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });
});

// ── auditLogMiddleware — patching res.json ────────────────────────────────────

describe('auditLogMiddleware — patches res.json for mapped mutations', () => {
  beforeEach(() => mockWriteAuditLog.mockClear());

  it('replaces res.json with a wrapper and still calls next()', () => {
    const req = makeReq({ method: 'POST', path: '/clients' });
    const res = makeRes();
    const next = jest.fn();
    const originalJson = res.json;

    auditLogMiddleware()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toBe(originalJson);
  });

  it('calls writeAuditLog with correct params on 2xx response with authenticated user', async () => {
    const req = makeReq({
      method: 'POST',
      path: '/clients',
      ip: '10.0.0.1',
      user: { id: 7, role: 'admin' },
    });
    const res = makeRes(201);
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    res.json({ id: 42, name: 'Acme' });

    // Allow the fire-and-forget promise to resolve
    await Promise.resolve();

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 7,
        entityType: 'CLIENT',
        entityId: 42,
        action: 'CREATE',
        ipAddress: '10.0.0.1',
      }),
    );
  });

  it('maps DELETE method → action DELETE', async () => {
    const req = makeReq({ method: 'DELETE', path: '/users/5', user: { id: 1, role: 'admin' } });
    const res = makeRes(204);
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    res.json(null);

    await Promise.resolve();

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entityType: 'USER' }),
    );
  });

  it('maps PUT method → action UPDATE', async () => {
    const req = makeReq({ method: 'PUT', path: '/time-entries/3', user: { id: 2, role: 'user' } });
    const res = makeRes(200);
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    res.json({ id: 3 });

    await Promise.resolve();

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE', entityType: 'TIME_ENTRY' }),
    );
  });

  it('sets entityId to null when response body has no numeric id', async () => {
    const req = makeReq({ method: 'DELETE', path: '/clients', user: { id: 1, role: 'admin' } });
    const res = makeRes(204);
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    res.json(null);

    await Promise.resolve();

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: null }),
    );
  });

  it('does NOT call writeAuditLog on a 4xx response', async () => {
    const req = makeReq({ method: 'POST', path: '/clients', user: { id: 1, role: 'admin' } });
    const res = makeRes(400);
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    res.json({ error: 'Bad Request' });

    await Promise.resolve();

    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('does NOT call writeAuditLog when req.user is absent (unauthenticated)', async () => {
    const req = makeReq({ method: 'POST', path: '/clients', user: undefined });
    const res = makeRes(201);
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    res.json({ id: 5 });

    await Promise.resolve();

    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it('still returns the original res.json result after patching', () => {
    const req = makeReq({ method: 'POST', path: '/clients', user: { id: 1, role: 'admin' } });
    const returnValue = {};
    const res = {
      statusCode: 201,
      json: jest.fn().mockReturnValue(returnValue),
    } as unknown as Response & { json: jest.Mock };
    const next = jest.fn();

    auditLogMiddleware()(req, res, next);
    const result = res.json({ id: 1 });

    expect(result).toBe(returnValue);
  });
});
