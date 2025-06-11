import type {
  MemoryItem,
  MemoryConfig,
  MemoryMetrics,
} from '@/types';

/**
 * Enhanced Memory Store for managing AI task memory
 * Provides intelligent filtering, retention policies, and analytics
 */
export class MemoryStore {
  private items: Map<string, MemoryItem> = new Map();
  private config: MemoryConfig;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  /**
   * Hafızaya yeni öğe ekler
   */
  add(item: MemoryItem): void {
    // ID yoksa oluştur
    if (!item.id) {
      item.id = this.generateId();
    }

    this.items.set(item.id, item);
    this.enforceRetentionPolicy();
  }

  /**
   * Birden fazla öğe ekler
   */
  addMultiple(items: MemoryItem[]): void {
    items.forEach(item => this.add(item));
  }

  /**
   * Alakalı hafıza öğelerini getirir
   */
  getRelevant(taskType: string, context?: any): MemoryItem[] {
    const allItems = Array.from(this.items.values());
    
    switch (this.config.filterStrategy) {
      case 'relevance':
        return this.filterByRelevance(allItems, taskType, context);
      case 'recency':
        return this.filterByRecency(allItems);
      case 'hybrid':
      default:
        return this.filterHybrid(allItems, taskType, context);
    }
  }

  /**
   * Son N öğeyi getirir
   */
  getRecent(count: number): MemoryItem[] {
    return Array.from(this.items.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  /**
   * Tüm hafıza öğelerini getirir
   */
  getAll(): MemoryItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Hafıza boyutunu döndürür
   */
  size(): number {
    return this.items.size;
  }

  /**
   * Hafızayı temizler
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Konfigürasyonu günceller
   */
  updateConfig(config: MemoryConfig): void {
    this.config = config;
    this.enforceRetentionPolicy();
  }

  /**
   * Hafıza öğesini ID ile getirir
   */
  getById(id: string): MemoryItem | undefined {
    return this.items.get(id);
  }

  /**
   * Hafıza öğesini siler
   */
  remove(id: string): boolean {
    return this.items.delete(id);
  }

  /**
   * Hafıza öğelerini filtreler
   */
  filter(predicate: (item: MemoryItem) => boolean): MemoryItem[] {
    return Array.from(this.items.values()).filter(predicate);
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private enforceRetentionPolicy(): void {
    const now = Date.now();
    const itemsArray = Array.from(this.items.entries());

    // Yaş sınırını uygula
    const validItems = itemsArray.filter(([_, item]) => 
      now - item.timestamp < this.config.maxAge
    );

    // Boyut sınırını uygula
    const sortedItems = validItems.sort(([_, a], [__, b]) => b.timestamp - a.timestamp);
    const limitedItems = sortedItems.slice(0, this.config.maxItems);

    // Hafızayı güncelle
    this.items.clear();
    limitedItems.forEach(([id, item]) => this.items.set(id, item));
  }

  private filterByRelevance(items: MemoryItem[], taskType: string, context?: any): MemoryItem[] {
    return items
      .filter(item => item.taskType === taskType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  }

  private filterByRecency(items: MemoryItem[]): MemoryItem[] {
    return items
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }



  private filterHybrid(items: MemoryItem[], taskType: string, context?: any): MemoryItem[] {
    const now = Date.now();

    return items
      .map(item => ({
        item,
        score: this.calculateRelevanceScore(item, taskType, context, now)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ item }) => item);
  }

  private calculateRelevanceScore(
    item: MemoryItem,
    taskType: string,
    context: any,
    now: number
  ): number {
    let score = 0;

    // Görev tipi eşleşmesi
    if (item.taskType === taskType) score += 30;

    // Zaman skoru (yeni öğeler daha yüksek skor)
    const ageHours = (now - item.timestamp) / (1000 * 60 * 60);
    score += Math.max(0, 20 - ageHours);

    // Bağlam eşleşmesi
    if (context && item.context) {
      if (context.url && item.context.url === context.url) score += 15;
      if (context.pageTitle && item.context.pageTitle === context.pageTitle) score += 10;
    }

    // Tag eşleşmesi
    if (item.tags && context?.tags) {
      const matchingTags = item.tags.filter(tag => context.tags.includes(tag));
      score += matchingTags.length * 5;
    }

    return score;
  }
}

/**
 * Memory Analytics for tracking memory usage and effectiveness
 */
export class MemoryAnalytics {
  private metrics: MemoryMetrics = {
    totalTasks: 0,
    memoryHits: 0,
    memoryMisses: 0,
    averageMemorySize: 0,
    memoryEffectiveness: 0,
  };

  recordTaskStart(taskType: string, memorySize: number): void {
    this.metrics.totalTasks++;
    
    if (memorySize > 0) {
      this.metrics.memoryHits++;
    } else {
      this.metrics.memoryMisses++;
    }

    this.updateAverageMemorySize(memorySize);
    this.updateEffectiveness();
  }

  recordTaskCompletion(taskType: string, success: boolean, memoryCreated: boolean): void {
    // Bu method gelecekte daha detaylı analytics için kullanılabilir
  }

  recordMemoryOperation(operation: 'add' | 'remove' | 'clear', item?: MemoryItem): void {
    // Memory operation tracking için
  }

  getMetrics(): MemoryMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = {
      totalTasks: 0,
      memoryHits: 0,
      memoryMisses: 0,
      averageMemorySize: 0,
      memoryEffectiveness: 0,
    };
  }

  private updateAverageMemorySize(memorySize: number): void {
    this.metrics.averageMemorySize =
      (this.metrics.averageMemorySize * (this.metrics.totalTasks - 1) + memorySize) /
      this.metrics.totalTasks;
  }

  private updateEffectiveness(): void {
    this.metrics.memoryEffectiveness =
      this.metrics.totalTasks > 0 ? this.metrics.memoryHits / this.metrics.totalTasks : 0;
  }
}
