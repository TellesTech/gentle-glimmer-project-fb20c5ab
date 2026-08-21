import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReportTabs } from './useReportTabs';

// Mock crypto.randomUUID
if (!global.crypto) {
  (global as any).crypto = {
    randomUUID: () => Math.random().toString(36).substring(2),
  };
}

describe('useReportTabs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should initialize with one tab containing OM context', () => {
    const omContext = { omNumber: '123', omTitle: 'Test OM' };
    const { result } = renderHook(() => useReportTabs('proj1', '2026-08-21', omContext));

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].formData.maintenanceOrderNumber).toBe('123');
    expect(result.current.tabs[0].formData.maintenanceOrderTitle).toBe('Test OM');
  });

  it('should preserve OM context when adding a new tab', () => {
    const omContext = { omNumber: '123', omTitle: 'Test OM' };
    const { result } = renderHook(() => useReportTabs('proj1', '2026-08-21', omContext));

    act(() => {
      result.current.addTab();
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.tabs[1].formData.maintenanceOrderNumber).toBe('123');
    expect(result.current.tabs[1].formData.maintenanceOrderTitle).toBe('Test OM');
  });

  it('should recover tabs from localStorage', () => {
    const projectId = 'proj1';
    const date = '2026-08-21';
    const storageKey = `report-tabs-${projectId}-${date}`;
    
    const savedState = {
      tabs: [{
        id: 'tab-1',
        label: 'RDO 1 - Diurno',
        formData: { maintenanceOrderNumber: 'Saved', shift: 'morning' },
        isDirty: false,
        createdAt: new Date().toISOString()
      }],
      activeTabId: 'tab-1'
    };
    
    localStorage.setItem(storageKey, JSON.stringify(savedState));

    const { result } = renderHook(() => useReportTabs(projectId, date));
    expect(result.current.tabs[0].formData.maintenanceOrderNumber).toBe('Saved');
  });
});
