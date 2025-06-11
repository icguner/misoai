import type {
  ExecutionDump,
  ExecutionTask,
  ExecutionTaskApply,
  ExecutionTaskInsightLocateOutput,
  ExecutionTaskProgressOptions,
  ExecutionTaskReturn,
  ExecutorContext,
  MemoryItem,
  MemoryConfig,
  MemoryStats,
  MemoryContext,
} from '@/types';
import { getVersion } from '@/utils';
import {
  MIDSCENE_MODEL_NAME,
  getAIConfig,
  uiTarsModelVersion,
  vlLocateMode,
} from 'misoai-shared/env';
import { assert } from 'misoai-shared/utils';
import { MemoryStore, MemoryAnalytics } from './memory-store';

export class Executor {
  name: string;

  tasks: ExecutionTask[];

  // status of executor
  status: 'init' | 'pending' | 'running' | 'completed' | 'error';

  onTaskStart?: ExecutionTaskProgressOptions['onTaskStart'];

  // YENİ: Gelişmiş hafıza sistemi
  private memoryStore: MemoryStore;
  private memoryConfig: MemoryConfig;
  private memoryAnalytics: MemoryAnalytics;

  constructor(
    name: string,
    options?: ExecutionTaskProgressOptions & {
      tasks?: ExecutionTaskApply[];
      memoryConfig?: Partial<MemoryConfig>; // YENİ: Hafıza konfigürasyonu
      initialMemory?: MemoryItem[]; // YENİ: Başlangıç hafızası
    },
  ) {
    this.status =
      options?.tasks && options.tasks.length > 0 ? 'pending' : 'init';
    this.name = name;
    this.tasks = (options?.tasks || []).map((item) =>
      this.markTaskAsPending(item),
    );
    this.onTaskStart = options?.onTaskStart;

    // Hafıza sistemi başlatma
    this.memoryConfig = {
      maxItems: 50,
      maxAge: 24 * 60 * 60 * 1000, // 24 saat
      enablePersistence: true,
      enableAnalytics: true,
      filterStrategy: 'hybrid',
      ...options?.memoryConfig
    };

    this.memoryStore = new MemoryStore(this.memoryConfig);
    this.memoryAnalytics = new MemoryAnalytics();

    // Başlangıç hafızasını yükle
    if (options?.initialMemory) {
      this.memoryStore.addMultiple(options.initialMemory);
    }
  }

  private markTaskAsPending(task: ExecutionTaskApply): ExecutionTask {
    return {
      status: 'pending',
      ...task,
    };
  }

  /**
   * Hafızaya yeni bir öğe ekler
   */
  public addToMemory(memoryItem: MemoryItem): void {
    this.memoryStore.add(memoryItem);
    this.memoryAnalytics.recordMemoryOperation('add', memoryItem);
  }

  /**
   * Bağlamsal hafıza öğelerini getirir
   */
  private getContextualMemory(taskType: string, context?: any): MemoryItem[] {
    return this.memoryStore.getRelevant(taskType, context);
  }

  /**
   * Hafızayı log formatında döndürür (geriye dönük uyumluluk)
   */
  private getMemoryAsLog(): string {
    const items = this.memoryStore.getRecent(10);
    return items.map(item => item.summary).join('\n');
  }

  /**
   * Hafızayı temizler
   */
  public clearMemory(): void {
    this.memoryStore.clear();
    this.memoryAnalytics.reset();
  }

  /**
   * Mevcut hafızayı döndürür (readonly)
   */
  public getMemory(): readonly MemoryItem[] {
    return this.memoryStore.getAll();
  }

  /**
   * Hafıza istatistiklerini döndürür
   */
  public getMemoryStats(): MemoryStats {
    return {
      totalItems: this.memoryStore.size(),
      analytics: this.memoryAnalytics.getMetrics(),
      config: this.memoryConfig
    };
  }

  /**
   * Hafıza konfigürasyonunu günceller
   */
  public updateMemoryConfig(config: Partial<MemoryConfig>): void {
    this.memoryConfig = { ...this.memoryConfig, ...config };
    this.memoryStore.updateConfig(this.memoryConfig);
  }

  async append(task: ExecutionTaskApply[] | ExecutionTaskApply): Promise<void> {
    assert(
      this.status !== 'error',
      `executor is in error state, cannot append task\nerror=${this.latestErrorTask()?.error}\n${this.latestErrorTask()?.errorStack}`,
    );
    if (Array.isArray(task)) {
      this.tasks.push(...task.map((item) => this.markTaskAsPending(item)));
    } else {
      this.tasks.push(this.markTaskAsPending(task));
    }
    if (this.status !== 'running') {
      this.status = 'pending';
    }
  }

  async flush(): Promise<any> {
    if (this.status === 'init' && this.tasks.length > 0) {
      console.warn(
        'illegal state for executor, status is init but tasks are not empty',
      );
    }

    assert(this.status !== 'running', 'executor is already running');
    assert(this.status !== 'completed', 'executor is already completed');
    assert(this.status !== 'error', 'executor is in error state');

    const nextPendingIndex = this.tasks.findIndex(
      (task) => task.status === 'pending',
    );
    if (nextPendingIndex < 0) {
      // all tasks are completed
      return;
    }

    this.status = 'running';
    let taskIndex = nextPendingIndex;
    let successfullyCompleted = true;

    let previousFindOutput: ExecutionTaskInsightLocateOutput | undefined;

    while (taskIndex < this.tasks.length) {
      const task = this.tasks[taskIndex];
      const taskStartTime = Date.now();

      assert(
        task.status === 'pending',
        `task status should be pending, but got: ${task.status}`,
      );
      task.timing = {
        start: taskStartTime,
      };

      // YENİ: Görev için bağlamsal hafıza hazırla
      const contextualMemory = this.getContextualMemory(task.type, {
        url: (task as any).context?.url,
        pageTitle: (task as any).context?.pageTitle,
        taskType: task.type
      });

      // Planning görevleri için hafızayı log olarak geç
      if (task.type === 'Planning' && task.param) {
        const memoryLog = contextualMemory.map(item => item.summary).join('\n');
        if (memoryLog) {
          const existingLog = (task.param as any).log || '';
          (task.param as any).log = existingLog ? `${existingLog}\n\nPrevious Context:\n${memoryLog}` : memoryLog;
        }
      }

      try {
        task.status = 'running';

        // Hafıza analitiklerini kaydet
        this.memoryAnalytics.recordTaskStart(task.type, contextualMemory.length);

        try {
          if (this.onTaskStart) {
            await this.onTaskStart(task);
          }
        } catch (e) {
          console.error('error in onTaskStart', e);
        }
        assert(
          ['Insight', 'Action', 'Planning'].indexOf(task.type) >= 0,
          `unsupported task type: ${task.type}`,
        );

        const { executor, param } = task;
        assert(executor, `executor is required for task type: ${task.type}`);

        let returnValue;
        const executorContext: ExecutorContext = {
          task,
          element: previousFindOutput?.element,
        };

        if (task.type === 'Insight') {
          assert(
            task.subType === 'Locate' ||
              task.subType === 'Query' ||
              task.subType === 'Assert' ||
              task.subType === 'Boolean' ||
              task.subType === 'Number' ||
              task.subType === 'String',
            `unsupported insight subType: ${task.subType}`,
          );
          returnValue = await task.executor(param, executorContext);
          if (task.subType === 'Locate') {
            previousFindOutput = (
              returnValue as ExecutionTaskReturn<ExecutionTaskInsightLocateOutput>
            )?.output;
          }
        } else if (task.type === 'Action' || task.type === 'Planning') {
          returnValue = await task.executor(param, executorContext);
        } else {
          console.warn(
            `unsupported task type: ${task.type}, will try to execute it directly`,
          );
          returnValue = await task.executor(param, executorContext);
        }

        Object.assign(task, returnValue);
        task.status = 'finished';
        task.timing.end = Date.now();
        task.timing.cost = task.timing.end - task.timing.start;
        task.timing.aiCost = (returnValue as any)?.aiCost || 0;

        // YENİ: Gelişmiş hafıza öğesi oluştur
        const memoryItem = this.createMemoryItem(task, returnValue, taskStartTime);
        if (memoryItem) {
          this.addToMemory(memoryItem);
        }

        // Hafıza analitiklerini güncelle
        this.memoryAnalytics.recordTaskCompletion(task.type, true, memoryItem !== null);

        taskIndex++;
      } catch (e: any) {
        successfullyCompleted = false;
        task.error =
          e?.message || (typeof e === 'string' ? e : 'error-without-message');
        task.errorStack = e.stack;

        task.status = 'failed';
        task.timing.end = Date.now();
        task.timing.cost = task.timing.end - task.timing.start;

        // Hata durumunda hafıza analitiklerini güncelle
        this.memoryAnalytics.recordTaskCompletion(task.type, false, false);

        // Hata bilgisini hafızaya ekle
        const errorMemoryItem = this.createErrorMemoryItem(task, e, taskStartTime);
        if (errorMemoryItem) {
          this.addToMemory(errorMemoryItem);
        }

        break;
      }
    }

    // set all remaining tasks as cancelled
    for (let i = taskIndex + 1; i < this.tasks.length; i++) {
      this.tasks[i].status = 'cancelled';
    }

    if (successfullyCompleted) {
      this.status = 'completed';
    } else {
      this.status = 'error';
    }

    if (this.tasks.length) {
      // return the last output
      const outputIndex = Math.min(taskIndex, this.tasks.length - 1);
      return this.tasks[outputIndex].output;
    }
  }

  isInErrorState(): boolean {
    return this.status === 'error';
  }

  latestErrorTask(): ExecutionTask | null {
    if (this.status !== 'error') {
      return null;
    }
    const errorTaskIndex = this.tasks.findIndex(
      (task) => task.status === 'failed',
    );
    if (errorTaskIndex >= 0) {
      return this.tasks[errorTaskIndex];
    }
    return null;
  }

  dump(): ExecutionDump {
    let modelDescription = '';

    if (vlLocateMode()) {
      const uiTarsModelVer = uiTarsModelVersion();
      if (uiTarsModelVer) {
        modelDescription = `UI-TARS=${uiTarsModelVer}`;
      } else {
        modelDescription = `${vlLocateMode()} mode`;
      }
    }
    const dumpData: ExecutionDump = {
      sdkVersion: getVersion(),
      model_name: getAIConfig(MIDSCENE_MODEL_NAME) || '',
      model_description: modelDescription,
      logTime: Date.now(),
      name: this.name,
      tasks: this.tasks,
    };
    return dumpData;
  }

  /**
   * Görev sonucundan hafıza öğesi oluşturur
   */
  private createMemoryItem(task: ExecutionTask, returnValue: any, startTime: number): MemoryItem | null {
    const summary = this.extractSummary(task, returnValue);
    if (!summary) return null;

    const memoryItem: MemoryItem = {
      id: this.generateMemoryId(task),
      timestamp: Date.now(),
      taskType: task.type as any,
      summary,
      context: this.extractContext(task, returnValue),
      metadata: {
        executionTime: Date.now() - startTime,
        success: task.status === 'finished',
        confidence: this.calculateConfidence(task, returnValue),
        sessionId: this.getSessionId()
      },
      tags: this.generateTags(task, returnValue)
    };

    return memoryItem;
  }

  /**
   * Hata durumu için hafıza öğesi oluşturur
   */
  private createErrorMemoryItem(task: ExecutionTask, error: any, startTime: number): MemoryItem | null {
    const memoryItem: MemoryItem = {
      id: this.generateMemoryId(task, 'error'),
      timestamp: Date.now(),
      taskType: task.type as any,
      summary: `Failed to execute ${task.type}: ${error.message || 'Unknown error'}`,
      context: {
        ...this.extractContext(task, null),
        errorInfo: error.message || error.toString()
      },
      metadata: {
        executionTime: Date.now() - startTime,
        success: false,
        sessionId: this.getSessionId()
      },
      tags: ['error', task.type.toLowerCase()]
    };

    return memoryItem;
  }

  /**
   * Görev ve sonuçtan özet çıkarır
   */
  private extractSummary(task: ExecutionTask, returnValue: any): string | null {
    // Önce AI'dan gelen summary'yi kontrol et
    if (returnValue?.memory?.summary) return returnValue.memory.summary;
    if (returnValue?.summary) return returnValue.summary;
    if (returnValue?.output?.summary) return returnValue.output.summary;

    // Fallback: görev tipine göre otomatik özet oluştur
    return this.generateAutoSummary(task);
  }

  /**
   * Görev tipi ve sonucuna göre otomatik özet oluşturur (geliştirilmiş)
   */
  private generateAutoSummary(task: ExecutionTask): string | null {
    switch (task.type) {
      case 'Action':
        const actionDetail = (task.param as any)?.action || task.subType || 'action';
        const target = (task.param as any)?.target || 'element';
        return `Performed ${actionDetail} on ${target}`;

      case 'Insight':
        if (task.subType === 'Locate') {
          const element = (task.param as any)?.prompt || 'element';
          return `Located element: ${element}`;
        } else if (task.subType === 'Assert') {
          const assertion = (task.param as any)?.assertion || 'condition';
          const result = task.output?.pass ? 'passed' : 'failed';
          return `Assertion "${assertion}" ${result}`;
        } else if (task.subType === 'Query' || task.subType === 'Boolean' || task.subType === 'Number' || task.subType === 'String') {
          const demand = (task.param as any)?.dataDemand;
          const result = task.output;

          // Daha detaylı özet oluştur
          if (typeof demand === 'object' && result && typeof result === 'object') {
            const extractedData = Object.entries(result)
              .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
              .join(', ');
            return `Extracted data - ${extractedData}`;
          } else if (typeof demand === 'string' && result !== undefined) {
            return `Extracted "${demand}": ${JSON.stringify(result)}`;
          }

          return `Extracted data: ${JSON.stringify(result)}`;
        }
        return `Performed ${task.subType} insight`;

      case 'Planning':
        const actionCount = task.output?.actions?.length || 0;
        const actionTypes = task.output?.actions?.map((a: any) => a.type).join(', ') || '';
        return `Planned ${actionCount} action(s): ${actionTypes}`;

      default:
        return `Executed ${task.type} task`;
    }
  }

  /**
   * Bağlam bilgilerini çıkarır
   */
  private extractContext(task: ExecutionTask, returnValue: any): MemoryContext {
    const context: MemoryContext = {};

    // URL bilgisi
    if ((task as any).context?.url) context.url = (task as any).context.url;

    // Sayfa başlığı
    if ((task as any).context?.pageTitle) context.pageTitle = (task as any).context.pageTitle;

    // Element bilgisi
    if ((task.param as any)?.prompt) context.elementInfo = (task.param as any).prompt;
    if ((task.param as any)?.target) context.elementInfo = (task.param as any).target;

    // Kullanıcı aksiyonu
    if ((task.param as any)?.action) context.userAction = (task.param as any).action;

    // Çıkarılan veri - daha kapsamlı veri saklama
    if (returnValue?.output?.data) {
      context.dataExtracted = returnValue.output.data;
    } else if (returnValue?.data) {
      context.dataExtracted = returnValue.data;
    } else if (returnValue?.output && task.subType === 'Query') {
      // Query sonuçlarını direkt sakla
      context.dataExtracted = returnValue.output;
    } else if (task.subType === 'Boolean' || task.subType === 'Number' || task.subType === 'String') {
      // Diğer extraction tiplerini de sakla
      context.dataExtracted = { result: returnValue?.output };
    }

    return context;
  }

  /**
   * Güven skorunu hesaplar
   */
  private calculateConfidence(task: ExecutionTask, returnValue: any): number {
    // AI'dan gelen güven skoru varsa kullan
    if (returnValue?.confidence) return returnValue.confidence;

    // Görev tipine göre varsayılan güven skoru
    switch (task.type) {
      case 'Action': return 0.9; // Aksiyonlar genelde başarılı
      case 'Planning': return 0.8; // Planlama orta güven
      case 'Insight':
        if (task.subType === 'Assert') {
          return task.output?.pass ? 0.95 : 0.7; // Başarılı assertion yüksek güven
        }
        return 0.85;
      default: return 0.75;
    }
  }



  /**
   * Etiketler oluşturur
   */
  private generateTags(task: ExecutionTask, returnValue: any): string[] {
    const tags: string[] = [task.type.toLowerCase()];

    if (task.subType) tags.push(task.subType.toLowerCase());
    if ((task.param as any)?.action) tags.push((task.param as any).action.toLowerCase());
    if (returnValue?.success === false) tags.push('failed');
    if (returnValue?.data) tags.push('data-extraction');

    return tags;
  }

  /**
   * Hafıza ID'si oluşturur
   */
  private generateMemoryId(task: ExecutionTask, suffix?: string): string {
    const base = `${task.type}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    return suffix ? `${base}_${suffix}` : base;
  }

  /**
   * Oturum ID'sini getirir
   */
  private getSessionId(): string {
    return this.name || 'default_session';
  }
}
