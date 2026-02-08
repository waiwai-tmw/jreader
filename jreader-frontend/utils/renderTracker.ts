// Re-render tracking utility for React components
export interface RenderTrackerConfig {
  componentName: string;
  enabled?: boolean;
  logProps?: boolean;
  logStack?: boolean;
  trackDependencies?: boolean;
}

export interface RenderInfo {
  count: number;
  timestamp: number;
  changedProps: string[];
  props: any;
  stack?: string;
}

class RenderTracker {
  private static instances = new Map<string, RenderTracker>();
  private renderCounts = new Map<string, number>();
  private lastProps = new Map<string, any>();
  private renderHistory = new Map<string, RenderInfo[]>();
  private config: RenderTrackerConfig;

  constructor(config: RenderTrackerConfig) {
    this.config = { enabled: true, logProps: false, logStack: false, trackDependencies: false, ...config };
  }

  static getInstance(componentName: string, config?: Partial<RenderTrackerConfig>): RenderTracker {
    if (!this.instances.has(componentName)) {
      this.instances.set(componentName, new RenderTracker({ componentName, ...config }));
    }
    return this.instances.get(componentName)!;
  }

  track(props: any, dependencies?: any[]): number {
    if (!this.config.enabled) return 0;

    const count = (this.renderCounts.get(this.config.componentName) || 0) + 1;
    this.renderCounts.set(this.config.componentName, count);
    
    const lastPropsForComponent = this.lastProps.get(this.config.componentName);
    const changedProps: string[] = [];
    
    if (lastPropsForComponent) {
      Object.keys(props).forEach(key => {
        try {
          if (JSON.stringify(props[key]) !== JSON.stringify(lastPropsForComponent[key])) {
            changedProps.push(key);
          }
        } catch (error) {
          // Handle circular references or non-serializable objects
          changedProps.push(`${key} (non-serializable)`);
        }
      });
    }
    
    this.lastProps.set(this.config.componentName, JSON.parse(JSON.stringify(props)));
    
    const renderInfo: RenderInfo = {
      count,
      timestamp: Date.now(),
      changedProps,
      props: this.config.logProps ? props : { hasProps: true },
      stack: this.config.logStack ? new Error().stack : undefined
    };

    // Keep last 10 renders for history
    const history = this.renderHistory.get(this.config.componentName) || [];
    history.push(renderInfo);
    if (history.length > 10) {
      history.shift();
    }
    this.renderHistory.set(this.config.componentName, history);

    console.log(`🔄 [${this.config.componentName}] Render #${count}`, {
      changedProps: changedProps.length > 0 ? changedProps : 'No changes',
      props: this.config.logProps ? props : { hasProps: true },
      dependencies: this.config.trackDependencies ? dependencies : undefined,
      timeSinceLastRender: history.length > 1 ? renderInfo.timestamp - history[history.length - 2].timestamp : 0
    });
    
    return count;
  }

  getStats(): { componentName: string; totalRenders: number; recentRenders: RenderInfo[] } {
    return {
      componentName: this.config.componentName,
      totalRenders: this.renderCounts.get(this.config.componentName) || 0,
      recentRenders: this.renderHistory.get(this.config.componentName) || []
    };
  }

  static getAllStats(): Array<{ componentName: string; totalRenders: number; recentRenders: RenderInfo[] }> {
    return Array.from(this.instances.values()).map(instance => instance.getStats());
  }

  static reset(): void {
    this.instances.clear();
  }

  static logSummary(): void {
    const stats = this.getAllStats();
    console.group('📊 Render Summary');
    stats.forEach(stat => {
      console.log(`${stat.componentName}: ${stat.totalRenders} renders`);
      if (stat.recentRenders.length > 1) {
        const avgTimeBetweenRenders = stat.recentRenders.slice(1).reduce((acc, render, i) => {
          return acc + (render.timestamp - stat.recentRenders[i].timestamp);
        }, 0) / (stat.recentRenders.length - 1);
        console.log(`  Average time between renders: ${avgTimeBetweenRenders.toFixed(2)}ms`);
      }
    });
    console.groupEnd();
  }
}

// React Hook for tracking re-renders
export function useRenderTracker(config: RenderTrackerConfig) {
  const tracker = RenderTracker.getInstance(config.componentName, config);
  
  return {
    track: (props: any, dependencies?: any[]) => tracker.track(props, dependencies),
    getStats: () => tracker.getStats()
  };
}

// Utility to analyze prop changes
export function analyzePropChanges(oldProps: any, newProps: any): {
  changed: string[];
  added: string[];
  removed: string[];
  unchanged: string[];
} {
  const oldKeys = new Set(Object.keys(oldProps || {}));
  const newKeys = new Set(Object.keys(newProps || {}));
  
  const added = Array.from(newKeys).filter(key => !oldKeys.has(key));
  const removed = Array.from(oldKeys).filter(key => !newKeys.has(key));
  const common = Array.from(oldKeys).filter(key => newKeys.has(key));
  
  const changed: string[] = [];
  const unchanged: string[] = [];
  
  common.forEach(key => {
    try {
      if (JSON.stringify(oldProps[key]) !== JSON.stringify(newProps[key])) {
        changed.push(key);
      } else {
        unchanged.push(key);
      }
    } catch (error) {
      changed.push(`${key} (non-serializable)`);
    }
  });
  
  return { changed, added, removed, unchanged };
}

// Performance monitoring utilities
export function measureRenderTime<T>(fn: () => T, componentName: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  console.log(`⏱️ [${componentName}] Render time: ${(end - start).toFixed(2)}ms`);
  return result;
}

// Memoization helper with tracking
export function memoizeWithTracking<T>(
  fn: () => T,
  dependencies: any[],
  componentName: string
): T {
  const tracker = RenderTracker.getInstance(componentName);
  tracker.track({ dependencies }, dependencies);
  return fn();
}

export { RenderTracker };
