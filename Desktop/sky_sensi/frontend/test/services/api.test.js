import { describe, expect, it, beforeEach } from 'vitest';
import briefingFixture from '../fixtures/briefing.json';

const axiosMocks = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const requestInterceptor = { use: vi.fn() };
  const responseInterceptor = { use: vi.fn() };

  return {
    mockGet,
    mockPost,
    requestInterceptor,
    responseInterceptor,
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
      interceptors: {
        request: requestInterceptor,
        response: responseInterceptor
      }
    }))
  };
});

vi.mock('axios', () => ({
  default: { create: axiosMocks.create },
  create: axiosMocks.create
}));

const { mockGet, mockPost } = axiosMocks;

import { fetchBriefing, sendChatMessage, withRetry } from '../../src/services/api.js';

describe('api service', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    axiosMocks.requestInterceptor.use.mockReset();
    axiosMocks.responseInterceptor.use.mockReset();
    axiosMocks.create.mockClear();
  });

  it('normalizes route before fetching briefing', async () => {
    mockGet.mockResolvedValueOnce({
      data: briefingFixture
    });

    const result = await fetchBriefing('klax, ksfo ');

    expect(mockGet).toHaveBeenCalledWith('/briefing', {
      params: { route: 'KLAX,KSFO' }
    });
    expect(result).toEqual(briefingFixture);
  });

  it('throws when route format is invalid', async () => {
    await expect(fetchBriefing('INVALID')).rejects.toThrow(/Route must be/);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('rejects when the server returns an invalid briefing payload', async () => {
    mockGet.mockResolvedValueOnce({ data: { route: 'KLAX,KSFO' } });

    await expect(fetchBriefing('KLAX,KSFO')).rejects.toThrow(/Invalid briefing response/);
    expect(mockGet).toHaveBeenCalledWith('/briefing', {
      params: { route: 'KLAX,KSFO' }
    });
  });

  it('retries failed requests using withRetry', async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValue('success');

    const result = await withRetry(call, 3, 10);

    expect(result).toBe('success');
    expect(call).toHaveBeenCalledTimes(3);
  });

  it('sends trimmed chat message payload', async () => {
    mockPost.mockResolvedValueOnce({ data: { answer: 'Hi' } });

    const briefingData = {
      route: 'KLAX,KSFO',
      generatedAt: '2024-02-12T15:30:00Z',
      aiSummary: null,
      summary: {},
      airports: [],
      rawData: {
        metarsByIcao: {},
        tafsByIcao: {}
      }
    };

    const response = await sendChatMessage('  Test question?  ', briefingData);

    expect(mockPost).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({
      question: 'Test question?'
    }));
    expect(response).toEqual({ answer: 'Hi' });
  });
});
