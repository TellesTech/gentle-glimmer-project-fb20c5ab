import { useState, useEffect, useCallback } from 'react';
import { ReportFormData } from '@/components/reports/QuickReportFormContent';

export interface ReportTab {
  id: string;
  label: string;
  formData: ReportFormData;
  isDirty: boolean;
  createdAt: string;
}

export interface ReportTabsState {
  tabs: ReportTab[];
  activeTabId: string;
}

const MAX_TABS = 5;

function getStorageKey(projectId: string, date: string): string {
  return `report-tabs-${projectId}-${date}`;
}

function createInitialFormData(date: string): ReportFormData {
  const hour = new Date().getHours();
  const defaultShift = hour >= 6 && hour < 18 ? 'morning' : 'night';
  
  return {
    date,
    shift: defaultShift as 'morning' | 'night',
    startTime: defaultShift === 'morning' ? '07:00' : '17:00',
    endTime: defaultShift === 'morning' ? '17:00' : '07:00',
    location: localStorage.getItem('lastReportLocation') || '',
    dailyProgress: 0,
    activities: [{ description: '', completed: false, progress: 0 }],
    attendance: [],
    hasDeviations: false,
    deviations: [],
    photos: [],
    comments: '',
    aiSummary: '',
    operationalDeviationHours: '',
    operationalDeviationReason: '',
    operationalDeviationDetails: '',
    climaticDeviationHours: '',
    climaticDeviationReason: '',
    climaticDeviationDetails: '',
    amtDeviationHours: '',
    amtDeviationReason: '',
    amtDeviationDetails: '',
    useWeightedProgress: false,
    activitySteps: [],
    plannedWorkforce: 0,
    realPercentage: 0,
  };
}

function createNewTab(date: string, tabNumber: number): ReportTab {
  const formData = createInitialFormData(date);
  const shiftLabel = formData.shift === 'morning' ? 'Diurno' : 'Noturno';
  
  return {
    id: crypto.randomUUID(),
    label: `RDO ${tabNumber} - ${shiftLabel}`,
    formData,
    isDirty: false,
    createdAt: new Date().toISOString(),
  };
}

export function useReportTabs(projectId: string, initialDate: string) {
  const [state, setState] = useState<ReportTabsState>(() => {
    // Try to recover from localStorage
    const storageKey = getStorageKey(projectId, initialDate);
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ReportTabsState;
        if (parsed.tabs.length > 0) {
          // Migrate old label format to new "RDO N - Shift" format
          const migratedTabs = parsed.tabs.map((tab, index) => {
            if (!tab.label.startsWith('RDO ')) {
              const shiftLabel = tab.formData.shift === 'morning' ? 'Diurno' : 'Noturno';
              return { ...tab, label: `RDO ${index + 1} - ${shiftLabel}` };
            }
            return tab;
          });
          return { ...parsed, tabs: migratedTabs };
        }
      } catch {
        // Ignore parse errors
      }
    }
    
    // Create initial tab
    const initialTab = createNewTab(initialDate, 1);
    return {
      tabs: [initialTab],
      activeTabId: initialTab.id,
    };
  });

  // Persist to localStorage
  useEffect(() => {
    const storageKey = getStorageKey(projectId, initialDate);
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, projectId, initialDate]);

  const addTab = useCallback(() => {
    if (state.tabs.length >= MAX_TABS) return;
    
    const newTab = createNewTab(initialDate, state.tabs.length + 1);
    setState(prev => ({
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id,
    }));
  }, [state.tabs.length, initialDate]);

  const removeTab = useCallback((tabId: string) => {
    setState(prev => {
      const filteredTabs = prev.tabs.filter(t => t.id !== tabId);
      
      // If no tabs left, create a new one
      if (filteredTabs.length === 0) {
        const newTab = createNewTab(initialDate, 1);
        return {
          tabs: [newTab],
          activeTabId: newTab.id,
        };
      }
      
      // If removing active tab, switch to another
      let newActiveId = prev.activeTabId;
      if (prev.activeTabId === tabId) {
        const removedIndex = prev.tabs.findIndex(t => t.id === tabId);
        newActiveId = filteredTabs[Math.min(removedIndex, filteredTabs.length - 1)].id;
      }
      
      return {
        tabs: filteredTabs,
        activeTabId: newActiveId,
      };
    });
  }, [initialDate]);

  const setActiveTab = useCallback((tabId: string) => {
    setState(prev => ({
      ...prev,
      activeTabId: tabId,
    }));
  }, []);

  const updateTabData = useCallback((tabId: string, data: Partial<ReportFormData>) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab => {
        if (tab.id !== tabId) return tab;
        
        const newFormData = { ...tab.formData, ...data };
        
        // Update label based on shift change, preserving "RDO N" prefix
        let newLabel = tab.label;
        if (data.shift) {
          const shiftLabel = data.shift === 'morning' ? 'Diurno' : 'Noturno';
          const rdoPrefix = tab.label.match(/^RDO \d+/)?.[0] || 'RDO';
          newLabel = `${rdoPrefix} - ${shiftLabel}`;
        }
        
        return {
          ...tab,
          formData: newFormData,
          label: newLabel,
          isDirty: true,
        };
      }),
    }));
  }, []);

  const getActiveTab = useCallback((): ReportTab | undefined => {
    return state.tabs.find(t => t.id === state.activeTabId);
  }, [state]);

  const markTabClean = useCallback((tabId: string) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab => 
        tab.id === tabId ? { ...tab, isDirty: false } : tab
      ),
    }));
  }, []);

  const clearStorage = useCallback(() => {
    const storageKey = getStorageKey(projectId, initialDate);
    localStorage.removeItem(storageKey);
  }, [projectId, initialDate]);

  const addTabFromExisting = useCallback((sourceTabId: string) => {
    if (state.tabs.length >= MAX_TABS) return;

    const sourceTab = state.tabs.find(t => t.id === sourceTabId);
    if (!sourceTab) return;

    const clonedFormData: ReportFormData = JSON.parse(JSON.stringify(sourceTab.formData));
    const shiftLabel = clonedFormData.shift === 'morning' ? 'Diurno' : 'Noturno';

    const newTab: ReportTab = {
      id: crypto.randomUUID(),
      label: `RDO ${state.tabs.length + 1} - ${shiftLabel}`,
      formData: clonedFormData,
      isDirty: true,
      createdAt: new Date().toISOString(),
    };

    setState(prev => ({
      tabs: [...prev.tabs, newTab],
      activeTabId: newTab.id,
    }));
  }, [state.tabs]);

  const hasDirtyTabs = state.tabs.some(t => t.isDirty);

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    activeTab: getActiveTab(),
    addTab,
    addTabFromExisting,
    removeTab,
    setActiveTab,
    updateTabData,
    markTabClean,
    clearStorage,
    hasDirtyTabs,
    canAddTab: state.tabs.length < MAX_TABS,
  };
}
