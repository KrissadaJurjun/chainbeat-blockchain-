import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/uiStore';
import { useRefreshMs } from './useChainData';

describe('useRefreshMs', () => {
  afterEach(() => useUiStore.getState().setRefresh('live'));

  it('follows the refresh preference: live → base interval, slow → at least 30 s, manual → never', () => {
    const { result } = renderHook(() => useRefreshMs(6_000));
    expect(result.current).toBe(6_000);
    act(() => useUiStore.getState().setRefresh('slow'));
    expect(result.current).toBe(30_000);
    act(() => useUiStore.getState().setRefresh('manual'));
    expect(result.current).toBe(false);
    act(() => useUiStore.getState().setRefresh('live'));
    expect(result.current).toBe(6_000);
  });

  it('never makes an already slow interval faster', () => {
    const { result } = renderHook(() => useRefreshMs(60_000));
    act(() => useUiStore.getState().setRefresh('slow'));
    expect(result.current).toBe(60_000);
  });
});
