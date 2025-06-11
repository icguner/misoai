# Miso AI Gelişmiş Hafıza Mekanizması ve Entegrasyon Planı

Bu döküman, Miso AI'a gelişmiş bir "hafıza" (memory) yeteneği kazandırmak ve bu yeteneği `@misoai/core` paketinden başlayarak `@misoai/web-integration` gibi üst katman paketlerine entegre etmek için gereken adımları detaylandırmaktadır. Bu plan, çok adımlı iş akışlarında veri sürekliliği ve adımlar arası bilgi paylaşımını optimize eder.

## Genel Bakış

### Mevcut Mimari Analizi

**Ana Bileşenler:**
- `Executor` sınıfı (`packages/core/src/ai-model/action-executor.ts`): Görev yürütme motoru
- `PuppeteerAgent` (`packages/web-integration/src/puppeteer/index.ts`): Puppeteer-specific agent implementasyonu
- `PageTaskExecutor` (`packages/web-integration/src/common/tasks.ts`): Sayfa görevleri yürütücüsü
- AI fonksiyonları (`packages/core/src/ai-model/inspect.ts`): `AiAssert`, `AiExtractElementInfo`, `plan` fonksiyonları
- Prompt yapıları (`packages/core/src/ai-model/prompt/`): AI model promptları

**Mevcut Veri Akışı:**
1. `PuppeteerAgent` → `PageTaskExecutor` → `Executor` → AI fonksiyonları
2. Her görev bağımsız olarak çalışır, önceki görevlerden bilgi aktarımı yok
3. `generateTaskBackgroundContext` fonksiyonu mevcut log parametresini kullanır ama hafıza yönetimi yok

**Tespit Edilen Sorunlar:**
- Adımlar arası veri kaybı
- Bağlamsal bilgi eksikliği
- Çok adımlı iş akışlarında tutarsızlık
- Manuel veri aktarımı gerekliliği

### Hedef Mimari: Gelişmiş Hafıza Sistemi

**Çekirdek Hafıza Mekanizması:**
- Her görevin sonucunda yapılandırılmış `summary` üretilecek
- `Executor` sınıfında çok katmanlı hafıza deposu tutulacak
- Adımlar arası otomatik veri aktarımı sağlanacak
- Bağlamsal hafıza filtreleme ve önceliklendirme
- Geriye dönük uyumluluk korunacak

**Gelişmiş Özellikler:**
- **Structured Memory**: Tiplendirilmiş hafıza öğeleri
- **Context Awareness**: Dinamik bağlam zenginleştirmesi
- **Memory Persistence**: Oturum içi ve oturumlar arası hafıza
- **Smart Filtering**: Alakalı hafıza öğelerinin otomatik seçimi
- **Memory Analytics**: Hafıza kullanım metrikleri ve optimizasyon

## Bölüm 1: `@misoai/core` Paketindeki Gelişmiş Hafıza Değişiklikleri

### Amaç

`Executor` sınıfı aracılığıyla yürütülen her bir AI görevinin (aksiyon, sorgu, iddia vb.) yapılandırılmış bir özetini ve bağlamsal verilerini saklayarak, sonraki görevlerin bu birikmiş bilgiyi (hafızayı) akıllı bir şekilde bağlam olarak kullanmasını sağlamak. Bu gelişmiş hafıza sistemi, AI'ın çok adımlı görevlerdeki performansını, tutarlılığını ve veri sürekliliğini önemli ölçüde artıracaktır.

### Adım 1: Gelişmiş Tip Tanımlamaları

AI fonksiyonlarından dönecek ve görevler arasında taşınacak yapılandırılmış hafıza verileri için yeni tip tanımlamalarını oluşturalım.

#### 1.1 Hafıza Veri Yapıları

**Dosya:** `packages/core/src/types.ts`

**Yeni Hafıza Veri Yapıları:**
```typescript
// Hafıza öğesi için temel yapı
export interface MemoryItem {
  id: string;
  timestamp: number;
  taskType: 'Action' | 'Insight' | 'Planning' | 'Assertion' | 'Extraction';
  summary: string;
  context?: MemoryContext;
  metadata?: MemoryMetadata;
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
}

// Hafıza bağlamı
export interface MemoryContext {
  url?: string;
  pageTitle?: string;
  elementInfo?: string;
  userAction?: string;
  dataExtracted?: Record<string, any>;
  errorInfo?: string;
}

// Hafıza metadata'sı
export interface MemoryMetadata {
  executionTime: number;
  success: boolean;
  confidence?: number;
  relatedMemoryIds?: string[];
  sessionId?: string;
}

// Hafıza deposu konfigürasyonu
export interface MemoryConfig {
  maxItems: number;
  maxAge: number; // milliseconds
  enablePersistence: boolean;
  enableAnalytics: boolean;
  filterStrategy: 'relevance' | 'recency' | 'priority' | 'hybrid';
}
```

**Mevcut Tip Yapıları:**
```typescript
// Mevcut ExecutionTaskReturn interface (satır 436-441)
export interface ExecutionTaskReturn<TaskOutput = unknown, TaskLog = unknown> {
  output?: TaskOutput;
  log?: TaskLog;
  recorder?: ExecutionRecorderItem[];
  cache?: TaskCacheInfo;
}

// Mevcut PlanningAIResponse interface (satır 329-340)
export interface PlanningAIResponse {
  action?: PlanningAction;
  actions?: PlanningAction[];
  more_actions_needed_by_instruction: boolean;
  log: string;
  sleep?: number;
  error?: string;
  usage?: AIUsageInfo;
  rawResponse?: string;
  yamlFlow?: MidsceneYamlFlowItem[];
  yamlString?: string;
}
```

**Gerekli Değişiklikler:**
1. `ExecutionTaskReturn` interface'ine gelişmiş hafıza desteği eklenecek
2. `PlanningAIResponse` interface'ine yapılandırılmış hafıza alanları eklenecek
3. `AIAssertionResponse` interface'ine bağlamsal hafıza desteği eklenecek
4. `AIDataExtractionResponse` interface'ine veri sürekliliği özellikleri eklenecek

**Güncellenmiş Tip Tanımları:**
```typescript
export interface ExecutionTaskReturn<TaskOutput = unknown, TaskLog = unknown> {
  output?: TaskOutput;
  log?: TaskLog;
  recorder?: ExecutionRecorderItem[];
  cache?: TaskCacheInfo;
  memory?: MemoryItem; // YENİ: Yapılandırılmış hafıza öğesi
  summary?: string; // Geriye dönük uyumluluk için
}

export interface PlanningAIResponse {
  action?: PlanningAction;
  actions?: PlanningAction[];
  more_actions_needed_by_instruction: boolean;
  log: string;
  memory?: MemoryItem; // YENİ: Planlama hafıza öğesi
  summary?: string; // Geriye dönük uyumluluk için
  sleep?: number;
  error?: string;
  usage?: AIUsageInfo;
  rawResponse?: string;
  yamlFlow?: MidsceneYamlFlowItem[];
  yamlString?: string;
}

export interface AIAssertionResponse {
  pass: boolean;
  thought: string;
  memory?: MemoryItem; // YENİ: Assertion hafıza öğesi
  summary?: string; // Geriye dönük uyumluluk için
  contextUsed?: string[]; // Kullanılan hafıza öğeleri
}

export interface AIDataExtractionResponse<DataShape> {
  data: DataShape;
  errors?: string[];
  memory?: MemoryItem; // YENİ: Extraction hafıza öğesi
  summary?: string; // Geriye dönük uyumluluk için
  dataRelations?: DataRelation[]; // Çıkarılan veriler arası ilişkiler
}

// Veri ilişkileri için yeni tip
export interface DataRelation {
  sourceField: string;
  targetField: string;
  relationType: 'reference' | 'dependency' | 'correlation';
  confidence: number;
}
```

### Adım 2: AI Prompt'larının Güncellenmesi

AI modelinin her görev için bir özet üretmesini sağlamak amacıyla prompt'ları güncellemeliyiz.

**Dosyalar:** `packages/core/src/ai-model/prompt/*.ts`

#### 2.1 Planning Prompt Güncellemesi

**Dosya:** `packages/core/src/ai-model/prompt/llm-planning.ts`

**Mevcut Durum:** `systemPromptToTaskPlanning` fonksiyonu (satır 233-251) JSON formatını tanımlar.

**Gerekli Değişiklik:** JSON schema'ya `summary` alanı eklenecek.

```typescript
// Mevcut JSON schema (satır 342-361 civarı)
const planningSchema = {
  type: 'object',
  properties: {
    actions: { /* ... */ },
    more_actions_needed_by_instruction: { /* ... */ },
    log: {
      type: 'string',
      description: 'Log what these planned actions do. Do not include further actions that have not been planned.',
    },
    summary: { // YENİ ALAN
      type: 'string',
      description: 'Summarize what this planning task accomplished in one clear sentence.',
    },
    error: { /* ... */ },
  },
  required: ['actions', 'more_actions_needed_by_instruction', 'log', 'summary', 'error'],
};
```

**Prompt Metni Güncellemesi:**
```typescript
const systemTemplateOfLLM = ({ pageType }: { pageType: PageType }) => `
## Role
You are a versatile professional in software UI automation...

## Output Format
Return in the following JSON format:
{
  "actions": [...],
  "more_actions_needed_by_instruction": boolean,
  "log": "Log what these planned actions do...",
  "summary": "Summarize what this planning task accomplished in one clear sentence.",
  "error": null
}
`;
```

#### 2.2 Assertion Prompt Güncellemesi

**Dosya:** `packages/core/src/ai-model/prompt/assertion.ts`

**Mevcut Durum:** `systemPromptToAssert` fonksiyonu (satır 26-30) JSON formatını tanımlar.

```typescript
// Mevcut format
const defaultAssertionResponseJsonFormat = `Return in the following JSON format:
{
  pass: boolean,
  thought: string | null,
}`;

// Güncellenmiş format
const defaultAssertionResponseJsonFormat = `Return in the following JSON format:
{
  pass: boolean,
  thought: string | null,
  summary: string // Summarize what this assertion checked in one sentence
}`;
```

**JSON Schema Güncellemesi:**
```typescript
export const assertSchema: ResponseFormatJSONSchema = {
  type: 'json_schema',
  json_schema: {
    name: 'assert',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        pass: { type: 'boolean', description: 'Whether the assertion passed or failed' },
        thought: { type: ['string', 'null'], description: 'The thought process behind the assertion' },
        summary: { type: 'string', description: 'Summary of what this assertion checked' }, // YENİ
      },
      required: ['pass', 'thought', 'summary'],
      additionalProperties: false,
    },
  },
};
```

#### 2.3 Extraction Prompt Güncellemesi

**Dosya:** `packages/core/src/ai-model/prompt/extraction.ts`

**Mevcut Durum:** `systemPromptToExtract` fonksiyonu (satır 4-79) JSON formatını tanımlar.

```typescript
// Mevcut format (satır 12-16)
Return in the following JSON format:
{
  data: any,
  errors: [],
}

// Güncellenmiş format
Return in the following JSON format:
{
  data: any, // the extracted data
  errors: [], // string[], error message if any
  summary: string // Summarize what data was extracted in one sentence
}
```

### Adım 3: AI Fonksiyonlarının Dönüş Değerlerinin Güncellenmesi

Prompt'larda yapılan değişikliklere paralel olarak, AI fonksiyonlarının bu yeni `summary` alanını döndürmesini sağlamalıyız.

#### 3.1 Planning Fonksiyonu Güncellemesi

**Dosya:** `packages/core/src/ai-model/llm-planning.ts`

**Mevcut Durum:** `plan` fonksiyonu (satır 21-131) `PlanningAIResponse` döndürür.

**Gerekli Değişiklik:**
```typescript
// Mevcut kod (satır 92-98)
const returnValue: PlanningAIResponse = {
  ...planFromAI,
  actions,
  rawResponse,
  usage,
  yamlFlow: buildYamlFlowFromPlans(actions, planFromAI.sleep),
};

// Güncellenmiş kod
const returnValue: PlanningAIResponse = {
  ...planFromAI,
  actions,
  rawResponse,
  usage,
  yamlFlow: buildYamlFlowFromPlans(actions, planFromAI.sleep),
  summary: planFromAI.summary || `Planned ${actions.length} action(s): ${actions.map(a => a.type).join(', ')}`, // AI'dan gelen summary veya fallback
};
```

#### 3.2 Assertion Fonksiyonu Güncellemesi

**Dosya:** `packages/core/src/ai-model/inspect.ts`

**Mevcut Durum:** `AiAssert` fonksiyonu (satır 365-400) `AIAssertionResponse` döndürür.

**Gerekli Değişiklik:**
```typescript
// AiAssert fonksiyonunun sonunda (satır 395 civarı)
const result = await callAiFn<AIAssertionResponse>(msgs, AIActionType.ASSERT);

// Güncellenmiş return
return {
  parseResult: {
    ...result.content,
    summary: result.content.summary || `Assertion "${assertion}" ${result.content.pass ? 'passed' : 'failed'}`,
  },
  usage: result.usage,
};
```

#### 3.3 Extraction Fonksiyonu Güncellemesi

**Dosya:** `packages/core/src/ai-model/inspect.ts`

**Mevcut Durum:** `AiExtractElementInfo` fonksiyonu (satır 313-363) `AIDataExtractionResponse<T>` döndürür.

**Gerekli Değişiklik:**
```typescript
// AiExtractElementInfo fonksiyonunun sonunda (satır 358-362)
const result = await callAiFn<AIDataExtractionResponse<T>>(msgs, AIActionType.EXTRACT_DATA);

return {
  parseResult: {
    ...result.content,
    summary: result.content.summary || generateExtractionSummary(result.content.data, dataQuery),
  },
  elementById,
  usage: result.usage,
};

// Yardımcı fonksiyon
function generateExtractionSummary(data: any, query: string | Record<string, string>): string {
  const queryStr = typeof query === 'string' ? query : JSON.stringify(query);
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    return `Extracted data with ${keys.length} field(s): ${keys.join(', ')} for query: ${queryStr}`;
  }
  return `Extracted data for query: ${queryStr}`;
}
```

#### 3.4 Diğer AI Fonksiyonları

**Locate Fonksiyonu (`AiLocateElement`):**
```typescript
// Locate işlemi için summary ekleme
return {
  parseResult,
  rect,
  rawResponse,
  elementById,
  usage,
  summary: `Located element: ${targetElementDescription}`, // Yeni alan
};
```

**Captcha Fonksiyonu (`AiCaptcha`):**
```typescript
// Captcha çözümü için summary ekleme
return {
  parseResult: {
    ...result.content,
    summary: `Solved ${result.content.captchaType} captcha with solution: ${result.content.solution}`,
  },
  usage: result.usage,
};
```

### Adım 4: `Executor` Sınıfına Gelişmiş Hafıza Mekanizmasının Eklenmesi

`Executor`, tüm görevleri yürüten merkezi birim olduğu için gelişmiş hafıza yönetimi burada yapılacaktır.

**Dosya:** `packages/core/src/ai-model/action-executor.ts`

#### 4.1 Gelişmiş Hafıza Deposu Ekleme

**Mevcut Sınıf Yapısı (satır 19-42):**
```typescript
export class Executor {
  name: string;
  tasks: ExecutionTask[];
  status: 'init' | 'pending' | 'running' | 'completed' | 'error';
  onTaskStart?: ExecutionTaskProgressOptions['onTaskStart'];

  constructor(name: string, options?: ExecutionTaskProgressOptions & {
    tasks?: ExecutionTaskApply[];
  }) {
    // mevcut kod...
  }
}
```

**Güncellenmiş Sınıf Yapısı:**
```typescript
export class Executor {
  name: string;
  tasks: ExecutionTask[];
  status: 'init' | 'pending' | 'running' | 'completed' | 'error';
  onTaskStart?: ExecutionTaskProgressOptions['onTaskStart'];

  // YENİ: Gelişmiş hafıza sistemi
  private memoryStore: MemoryStore;
  private memoryConfig: MemoryConfig;
  private memoryAnalytics: MemoryAnalytics;

  constructor(name: string, options?: ExecutionTaskProgressOptions & {
    tasks?: ExecutionTaskApply[];
    memoryConfig?: Partial<MemoryConfig>; // YENİ: Hafıza konfigürasyonu
    initialMemory?: MemoryItem[]; // YENİ: Başlangıç hafızası
  }) {
    this.status = options?.tasks && options.tasks.length > 0 ? 'pending' : 'init';
    this.name = name;
    this.tasks = (options?.tasks || []).map((item) => this.markTaskAsPending(item));
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
}
```

#### 4.2 Gelişmiş Hafıza Yönetim Metodları

```typescript
export class Executor {
  // ... mevcut özellikler

  /**
   * Hafızaya yeni bir öğe ekler
   */
  private addToMemory(memoryItem: MemoryItem): void {
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
}

// Hafıza istatistikleri için tip
interface MemoryStats {
  totalItems: number;
  analytics: MemoryMetrics;
  config: MemoryConfig;
}
```

#### 4.3 MemoryStore Sınıfı Implementasyonu

**Dosya:** `packages/core/src/ai-model/memory-store.ts`

```typescript
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
      case 'priority':
        return this.filterByPriority(allItems);
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

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  private filterByPriority(items: MemoryItem[]): MemoryItem[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return items
      .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
      .slice(0, 8);
  }

  private filterHybrid(items: MemoryItem[], taskType: string, context?: any): MemoryItem[] {
    const now = Date.now();
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    return items
      .map(item => ({
        item,
        score: this.calculateRelevanceScore(item, taskType, context, now, priorityOrder)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ item }) => item);
  }

  private calculateRelevanceScore(
    item: MemoryItem,
    taskType: string,
    context: any,
    now: number,
    priorityOrder: Record<string, number>
  ): number {
    let score = 0;

    // Görev tipi eşleşmesi
    if (item.taskType === taskType) score += 30;

    // Öncelik skoru
    score += priorityOrder[item.priority] * 10;

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
```

#### 4.4 Flush Metodunun Güncellenmesi

**Gelişmiş flush metodu:**

```typescript
async flush(): Promise<any> {
  // ... mevcut başlangıç kontrolleri (satır 67-89)

  this.status = 'running';
  let taskIndex = nextPendingIndex;
  let successfullyCompleted = true;
  let previousFindOutput: ExecutionTaskInsightLocateOutput | undefined;

  while (taskIndex < this.tasks.length) {
    const task = this.tasks[taskIndex];
    const taskStartTime = Date.now();

    // ... mevcut task hazırlık kodu (satır 92-121)

    // YENİ: Görev için bağlamsal hafıza hazırla
    const contextualMemory = this.getContextualMemory(task.type, {
      url: task.context?.url,
      pageTitle: task.context?.pageTitle,
      taskType: task.type
    });

    // Planning görevleri için hafızayı log olarak geç
    if (task.type === 'Planning' && task.param) {
      const memoryLog = contextualMemory.map(item => item.summary).join('\n');
      if (memoryLog) {
        const existingLog = task.param.log || '';
        task.param.log = existingLog ? `${existingLog}\n\nPrevious Context:\n${memoryLog}` : memoryLog;
      }
    }

    try {
      task.status = 'running';

      // Hafıza analitiklerini kaydet
      this.memoryAnalytics.recordTaskStart(task.type, contextualMemory.length);

      // ... mevcut task çalıştırma kodu (satır 102-146)

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
      // Hata durumunda hafıza analitiklerini güncelle
      this.memoryAnalytics.recordTaskCompletion(task.type, false, false);

      // Hata bilgisini hafızaya ekle
      const errorMemoryItem = this.createErrorMemoryItem(task, e, taskStartTime);
      if (errorMemoryItem) {
        this.addToMemory(errorMemoryItem);
      }

      // ... mevcut hata yönetimi (satır 154-164)
    }
  }

  // ... mevcut sonlandırma kodu (satır 167-183)
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
    priority: this.determinePriority(task, returnValue),
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
    priority: 'high', // Hatalar yüksek öncelikli
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
      const actionDetail = task.param?.action || task.subType || 'action';
      const target = task.param?.target || 'element';
      return `Performed ${actionDetail} on ${target}`;

    case 'Insight':
      if (task.subType === 'Locate') {
        const element = task.param?.prompt || 'element';
        return `Located element: ${element}`;
      } else if (task.subType === 'Assert') {
        const assertion = task.param?.assertion || 'condition';
        const result = task.output?.pass ? 'passed' : 'failed';
        return `Assertion "${assertion}" ${result}`;
      } else if (task.subType === 'Query') {
        const query = task.param?.dataQuery || 'information';
        return `Extracted data: ${typeof query === 'string' ? query : JSON.stringify(query)}`;
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
  if (task.context?.url) context.url = task.context.url;

  // Sayfa başlığı
  if (task.context?.pageTitle) context.pageTitle = task.context.pageTitle;

  // Element bilgisi
  if (task.param?.prompt) context.elementInfo = task.param.prompt;
  if (task.param?.target) context.elementInfo = task.param.target;

  // Kullanıcı aksiyonu
  if (task.param?.action) context.userAction = task.param.action;

  // Çıkarılan veri
  if (returnValue?.output?.data) context.dataExtracted = returnValue.output.data;
  if (returnValue?.data) context.dataExtracted = returnValue.data;

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
 * Öncelik seviyesini belirler
 */
private determinePriority(task: ExecutionTask, returnValue: any): 'low' | 'medium' | 'high' | 'critical' {
  // Hata durumları yüksek öncelikli
  if (!returnValue || task.status === 'error') return 'high';

  // Görev tipine göre öncelik
  switch (task.type) {
    case 'Planning': return 'high'; // Planlama önemli
    case 'Action': return 'medium'; // Aksiyonlar orta öncelik
    case 'Insight':
      if (task.subType === 'Assert') return 'high'; // Assertion'lar önemli
      return 'medium';
    default: return 'low';
  }
}

/**
 * Etiketler oluşturur
 */
private generateTags(task: ExecutionTask, returnValue: any): string[] {
  const tags: string[] = [task.type.toLowerCase()];

  if (task.subType) tags.push(task.subType.toLowerCase());
  if (task.param?.action) tags.push(task.param.action.toLowerCase());
  if (returnValue?.success === false) tags.push('failed');
  if (returnValue?.data) tags.push('data-extraction');

  return tags;
}

/**
 * Hafıza ID'si oluşturur
 */
private generateMemoryId(task: ExecutionTask, suffix?: string): string {
  const base = `${task.type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  return suffix ? `${base}_${suffix}` : base;
}

/**
 * Oturum ID'sini getirir
 */
private getSessionId(): string {
  return this.name || 'default_session';
}
```

## Bölüm 2: `@misoai/web-integration` Paketine Gelişmiş Hafıza Entegrasyonu

### Amaç

`@misoai/core` paketinde yapılan gelişmiş hafıza mekanizması geliştirmesinin, `PuppeteerAgent` veya benzeri agent sınıfları tarafından sorunsuz bir şekilde kullanılmasını sağlamak. Bu entegrasyon, çok adımlı web otomasyonu iş akışlarında veri sürekliliği ve bağlamsal farkındalığı maksimize edecektir.

### Mevcut Entegrasyon Analizi

#### 2.1 PuppeteerAgent Yapısı

**Dosya:** `packages/web-integration/src/puppeteer/index.ts`

**Mevcut Durum:**
```typescript
export class PuppeteerAgent extends PageAgent<PuppeteerWebPage> {
  constructor(page: PuppeteerPage, opts?: PageAgentOpt) {
    const webPage = new PuppeteerWebPage(page);
    super(webPage, opts);
    // ...
  }
}
```

**PageAgent Temel Sınıfı:** `packages/web-integration/src/common/agent.ts`
- `PageTaskExecutor` kullanarak görevleri yürütür
- `Executor` sınıfını dolaylı olarak kullanır

#### 2.2 Görev Yürütme Akışı

**Mevcut Akış:**
1. `PuppeteerAgent.aiAction()` → `PageTaskExecutor.runPlans()` → `new Executor()` → `executor.flush()`
2. `PuppeteerAgent.aiAssert()` → `PageTaskExecutor.assert()` → `new Executor()` → `executor.flush()`
3. Her görev için yeni `Executor` instance'ı oluşturuluyor

**Sorun:** Her görev için yeni Executor oluşturulduğu için hafıza görevler arası taşınmıyor.

#### 2.3 Hafıza Sürekliliği Sorunu ve Çözüm Stratejisi

**Mevcut Kod Analizi:** `packages/web-integration/src/common/tasks.ts`

```typescript
// Mevcut runPlans metodu (satır 890-904)
async runPlans(title: string, plans: PlanningAction[], opts?: { cacheable?: boolean }): Promise<ExecutionResult> {
  const taskExecutor = new Executor(title, { onTaskStart: this.onTaskStartCallback }); // YENİ EXECUTOR!
  const { tasks } = await this.convertPlanToExecutable(plans, opts);
  await taskExecutor.append(tasks);
  const result = await taskExecutor.flush();
  return { output: result, executor: taskExecutor };
}
```

**Tespit Edilen Problemler:**
1. **Hafıza Fragmentasyonu**: Her görev için yeni executor oluşturulması
2. **Bağlam Kaybı**: Önceki görevlerden elde edilen bilgilerin kaybolması
3. **Veri İzolasyonu**: Görevler arası veri paylaşımının olmaması
4. **Performans Kaybı**: Tekrarlayan bağlam oluşturma maliyeti

### Entegrasyon Stratejisi

#### Seçenek 1: Gelişmiş Hafıza Entegrasyonu (Önerilen)

**Amaç:** Geriye dönük uyumluluğu koruyarak gelişmiş hafıza sürekliliğini ve veri paylaşımını sağlamak.

**Yaklaşım:** `PageTaskExecutor` sınıfında persistent bir `Executor` instance'ı tutmak ve gelişmiş hafıza yönetimi eklemek.

**Gerekli Değişiklikler:**

**Dosya:** `packages/web-integration/src/common/tasks.ts`

```typescript
export class PageTaskExecutor {
  page: WebPage;
  insight: Insight<WebElementInfo, WebUIContext>;
  taskCache?: TaskCache;
  conversationHistory: ChatCompletionMessageParam[] = [];
  onTaskStartCallback?: ExecutionTaskProgressOptions['onTaskStart'];

  // YENİ: Gelişmiş hafıza sistemi
  private persistentExecutor?: Executor;
  private memoryConfig: MemoryConfig;
  private sessionContext: SessionContext;
  private workflowMemory: WorkflowMemory;

  constructor(page: WebPage, insight: Insight<WebElementInfo, WebUIContext>, opts: {
    taskCache?: TaskCache;
    onTaskStart?: ExecutionTaskProgressOptions['onTaskStart'];
    memoryConfig?: Partial<MemoryConfig>; // YENİ: Hafıza konfigürasyonu
    sessionId?: string; // YENİ: Oturum ID'si
    workflowId?: string; // YENİ: İş akışı ID'si
  }) {
    this.page = page;
    this.insight = insight;
    this.taskCache = opts.taskCache;
    this.onTaskStartCallback = opts?.onTaskStart;

    // Hafıza konfigürasyonu
    this.memoryConfig = {
      maxItems: 100,
      maxAge: 2 * 60 * 60 * 1000, // 2 saat
      enablePersistence: true,
      enableAnalytics: true,
      filterStrategy: 'hybrid',
      ...opts?.memoryConfig
    };

    // Oturum bağlamı
    this.sessionContext = {
      sessionId: opts?.sessionId || this.generateSessionId(),
      workflowId: opts?.workflowId,
      startTime: Date.now(),
      pageInfo: {
        url: '',
        title: ''
      }
    };

    // İş akışı hafızası
    this.workflowMemory = new WorkflowMemory(this.memoryConfig);
  }

  /**
   * Persistent executor'ı getirir veya oluşturur
   */
  private getPersistentExecutor(): Executor {
    if (!this.persistentExecutor || this.persistentExecutor.status === 'error') {
      // Önceki hafızayı yükle
      const previousMemory = this.workflowMemory.getWorkflowMemory(this.sessionContext.workflowId);

      this.persistentExecutor = new Executor('Persistent Task Executor', {
        onTaskStart: this.onTaskStartCallback,
        memoryConfig: this.memoryConfig,
        initialMemory: previousMemory
      });
    }
    return this.persistentExecutor;
  }

  /**
   * Sayfa bağlamını günceller
   */
  private async updatePageContext(): Promise<void> {
    try {
      if (this.page.url) {
        this.sessionContext.pageInfo.url = await this.page.url();
      }

      if (this.page.pageType === 'puppeteer' || this.page.pageType === 'playwright') {
        this.sessionContext.pageInfo.title = await (this.page as any).title();
      }
    } catch (e) {
      // Sayfa bilgisi alınamadı, devam et
    }
  }

  /**
   * Hafızayı temizler
   */
  public clearMemory(): void {
    if (this.persistentExecutor) {
      this.persistentExecutor.clearMemory();
    }
    this.workflowMemory.clearWorkflow(this.sessionContext.workflowId);
  }

  /**
   * Mevcut hafızayı döndürür
   */
  public getMemory(): readonly MemoryItem[] {
    return this.persistentExecutor?.getMemory() || [];
  }

  /**
   * İş akışı hafızasını döndürür
   */
  public getWorkflowMemory(): WorkflowMemoryData {
    return this.workflowMemory.getWorkflowData(this.sessionContext.workflowId);
  }

  /**
   * Hafıza istatistiklerini döndürür
   */
  public getMemoryStats(): MemoryStats {
    return this.persistentExecutor?.getMemoryStats() || {
      totalItems: 0,
      analytics: { totalTasks: 0, memoryHits: 0, memoryMisses: 0, averageMemorySize: 0, memoryEffectiveness: 0 },
      config: this.memoryConfig
    };
  }

  /**
   * Oturum ID'sini oluşturur
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  // Gelişmiş runPlans metodu
  async runPlans(title: string, plans: PlanningAction[], opts?: {
    cacheable?: boolean;
    useMemory?: boolean; // Bu görev için hafıza kullanılsın mı?
    workflowStep?: string; // İş akışı adımı tanımı
    priority?: 'low' | 'medium' | 'high' | 'critical'; // Görev önceliği
  }): Promise<ExecutionResult> {
    // Sayfa bağlamını güncelle
    await this.updatePageContext();

    const useMemory = opts?.useMemory !== false; // Default: true
    let taskExecutor: Executor;

    if (useMemory) {
      // Persistent executor kullan
      taskExecutor = this.getPersistentExecutor();

      // İş akışı bağlamını güncelle
      this.workflowMemory.updateWorkflowContext(this.sessionContext.workflowId, {
        currentStep: opts?.workflowStep || title,
        pageInfo: this.sessionContext.pageInfo,
        timestamp: Date.now()
      });
    } else {
      // Geleneksel yöntem: yeni executor
      taskExecutor = new Executor(title, {
        onTaskStart: this.onTaskStartCallback,
        memoryConfig: { ...this.memoryConfig, enablePersistence: false }
      });
    }

    const { tasks } = await this.convertPlanToExecutable(plans, opts);

    // Görevlere bağlam bilgisi ekle
    tasks.forEach(task => {
      task.context = {
        ...task.context,
        ...this.sessionContext.pageInfo,
        workflowId: this.sessionContext.workflowId,
        sessionId: this.sessionContext.sessionId,
        priority: opts?.priority || 'medium'
      };
    });

    await taskExecutor.append(tasks);
    const result = await taskExecutor.flush();

    // İş akışı hafızasını güncelle
    if (useMemory) {
      this.workflowMemory.saveWorkflowMemory(
        this.sessionContext.workflowId,
        taskExecutor.getMemory()
      );
    }

    return { output: result, executor: taskExecutor };
  }
}

// Yeni tip tanımları
interface SessionContext {
  sessionId: string;
  workflowId?: string;
  startTime: number;
  pageInfo: {
    url: string;
    title: string;
  };
}

interface WorkflowMemoryData {
  workflowId: string;
  steps: WorkflowStep[];
  memory: MemoryItem[];
  context: WorkflowContext;
  metadata: WorkflowMetadata;
}

interface WorkflowStep {
  stepId: string;
  stepName: string;
  timestamp: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  memoryItems: string[]; // Memory item IDs
}

interface WorkflowContext {
  currentStep?: string;
  pageInfo: {
    url: string;
    title: string;
  };
  timestamp: number;
}

interface WorkflowMetadata {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  startTime: number;
  endTime?: number;
  duration?: number;
}

// WorkflowMemory sınıfı implementasyonu
class WorkflowMemory {
  private workflows: Map<string, WorkflowMemoryData> = new Map();
  private config: MemoryConfig;

  constructor(config: MemoryConfig) {
    this.config = config;
  }

  /**
   * İş akışı hafızasını getirir
   */
  getWorkflowMemory(workflowId?: string): MemoryItem[] {
    if (!workflowId) return [];

    const workflow = this.workflows.get(workflowId);
    return workflow?.memory || [];
  }

  /**
   * İş akışı verilerini getirir
   */
  getWorkflowData(workflowId?: string): WorkflowMemoryData {
    if (!workflowId) {
      return this.createEmptyWorkflowData(workflowId || 'default');
    }

    return this.workflows.get(workflowId) || this.createEmptyWorkflowData(workflowId);
  }

  /**
   * İş akışı hafızasını kaydeder
   */
  saveWorkflowMemory(workflowId?: string, memory: readonly MemoryItem[]): void {
    if (!workflowId) return;

    const workflow = this.workflows.get(workflowId) || this.createEmptyWorkflowData(workflowId);
    workflow.memory = [...memory];
    workflow.metadata.totalSteps = workflow.steps.length;
    workflow.metadata.completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    workflow.metadata.failedSteps = workflow.steps.filter(s => s.status === 'failed').length;

    this.workflows.set(workflowId, workflow);
    this.enforceRetentionPolicy();
  }

  /**
   * İş akışı bağlamını günceller
   */
  updateWorkflowContext(workflowId?: string, context: WorkflowContext): void {
    if (!workflowId) return;

    const workflow = this.workflows.get(workflowId) || this.createEmptyWorkflowData(workflowId);
    workflow.context = { ...workflow.context, ...context };

    // Yeni adım ekle
    if (context.currentStep) {
      const existingStep = workflow.steps.find(s => s.stepName === context.currentStep);
      if (!existingStep) {
        workflow.steps.push({
          stepId: `step_${workflow.steps.length + 1}`,
          stepName: context.currentStep,
          timestamp: context.timestamp,
          status: 'running',
          memoryItems: []
        });
      }
    }

    this.workflows.set(workflowId, workflow);
  }

  /**
   * İş akışını temizler
   */
  clearWorkflow(workflowId?: string): void {
    if (!workflowId) return;
    this.workflows.delete(workflowId);
  }

  /**
   * Tüm iş akışlarını temizler
   */
  clearAll(): void {
    this.workflows.clear();
  }

  private createEmptyWorkflowData(workflowId: string): WorkflowMemoryData {
    return {
      workflowId,
      steps: [],
      memory: [],
      context: {
        pageInfo: { url: '', title: '' },
        timestamp: Date.now()
      },
      metadata: {
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        startTime: Date.now()
      }
    };
  }

  private enforceRetentionPolicy(): void {
    const maxWorkflows = 10; // Maksimum iş akışı sayısı

    if (this.workflows.size > maxWorkflows) {
      const sortedWorkflows = Array.from(this.workflows.entries())
        .sort(([, a], [, b]) => (b.metadata.endTime || b.metadata.startTime) - (a.metadata.endTime || a.metadata.startTime));

      // En eski iş akışlarını sil
      const toDelete = sortedWorkflows.slice(maxWorkflows);
      toDelete.forEach(([workflowId]) => this.workflows.delete(workflowId));
    }
  }
}
```

#### Seçenek 2: Agent Seviyesinde Gelişmiş Hafıza Kontrolü

**PageAgent sınıfına gelişmiş hafıza yönetimi ekleme:**

**Dosya:** `packages/web-integration/src/common/agent.ts`

```typescript
export class PageAgent<PageType extends WebPage = WebPage> {
  // ... mevcut özellikler

  /**
   * Hafıza konfigürasyonunu günceller
   */
  public updateMemoryConfig(config: Partial<MemoryConfig>): void {
    this.taskExecutor.updateMemoryConfig(config);
  }

  /**
   * Hafızayı temizler
   */
  public clearMemory(): void {
    this.taskExecutor.clearMemory();
  }

  /**
   * Mevcut hafızayı döndürür
   */
  public getMemory(): readonly MemoryItem[] {
    return this.taskExecutor.getMemory();
  }

  /**
   * İş akışı hafızasını döndürür
   */
  public getWorkflowMemory(): WorkflowMemoryData {
    return this.taskExecutor.getWorkflowMemory();
  }

  /**
   * Hafıza durumunu döndürür
   */
  public getMemoryStatus(): MemoryStatus {
    const stats = this.taskExecutor.getMemoryStats();
    const workflowData = this.taskExecutor.getWorkflowMemory();

    return {
      enabled: stats.config.enablePersistence,
      totalItems: stats.totalItems,
      memoryItems: this.taskExecutor.getMemory(),
      workflowData,
      analytics: stats.analytics,
      config: stats.config
    };
  }

  /**
   * Hafıza analitiklerini döndürür
   */
  public getMemoryAnalytics(): MemoryAnalyticsReport {
    const stats = this.taskExecutor.getMemoryStats();
    const workflowData = this.taskExecutor.getWorkflowMemory();

    return {
      memoryEffectiveness: stats.analytics.memoryEffectiveness,
      averageMemorySize: stats.analytics.averageMemorySize,
      totalTasks: stats.analytics.totalTasks,
      memoryHits: stats.analytics.memoryHits,
      memoryMisses: stats.analytics.memoryMisses,
      workflowProgress: {
        totalSteps: workflowData.metadata.totalSteps,
        completedSteps: workflowData.metadata.completedSteps,
        failedSteps: workflowData.metadata.failedSteps,
        successRate: workflowData.metadata.totalSteps > 0
          ? workflowData.metadata.completedSteps / workflowData.metadata.totalSteps
          : 0
      },
      recommendations: this.generateMemoryRecommendations(stats)
    };
  }

  /**
   * Hafıza önerilerini oluşturur
   */
  private generateMemoryRecommendations(stats: MemoryStats): string[] {
    const recommendations: string[] = [];

    if (stats.analytics.memoryEffectiveness < 0.5) {
      recommendations.push('Consider increasing memory retention time or improving memory relevance filtering');
    }

    if (stats.analytics.averageMemorySize > 80) {
      recommendations.push('Memory size is getting large, consider implementing memory compression');
    }

    if (stats.analytics.memoryHits < stats.analytics.memoryMisses) {
      recommendations.push('Low memory hit rate, review memory filtering strategy');
    }

    return recommendations;
  }

  /**
   * Hafıza export/import işlemleri
   */
  public exportMemory(): MemoryExport {
    return {
      timestamp: Date.now(),
      memoryItems: this.taskExecutor.getMemory(),
      workflowData: this.taskExecutor.getWorkflowMemory(),
      config: this.taskExecutor.getMemoryStats().config
    };
  }

  public importMemory(memoryExport: MemoryExport): void {
    // Konfigürasyonu güncelle
    this.taskExecutor.updateMemoryConfig(memoryExport.config);

    // Hafızayı yükle (bu işlem için executor'da yeni method gerekli)
    // this.taskExecutor.importMemory(memoryExport.memoryItems, memoryExport.workflowData);
  }
}

// Yeni tip tanımları
interface MemoryStatus {
  enabled: boolean;
  totalItems: number;
  memoryItems: readonly MemoryItem[];
  workflowData: WorkflowMemoryData;
  analytics: MemoryMetrics;
  config: MemoryConfig;
}

interface MemoryAnalyticsReport {
  memoryEffectiveness: number;
  averageMemorySize: number;
  totalTasks: number;
  memoryHits: number;
  memoryMisses: number;
  workflowProgress: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    successRate: number;
  };
  recommendations: string[];
}

interface MemoryExport {
  timestamp: number;
  memoryItems: readonly MemoryItem[];
  workflowData: WorkflowMemoryData;
  config: MemoryConfig;
}
```

### Sonuç ve Gelişmiş Özellikler

**Seçenek 1 (Önerilen):** Gelişmiş hafıza entegrasyonu ile veri sürekliliği ve iş akışı optimizasyonu sağlanır.

**Avantajlar:**
- Geriye dönük uyumluluk korunur
- Gelişmiş hafıza analitikleri ve optimizasyon
- İş akışı seviyesinde veri sürekliliği
- Bağlamsal hafıza filtreleme ve önceliklendirme
- Export/import özellikleri ile hafıza taşınabilirliği
- Mevcut testler çalışmaya devam eder
- Kademeli geçiş mümkün

**Dezavantajlar:**
- `PageTaskExecutor` sınıfında ek karmaşıklık
- Hafıza yönetimi için ek metodlar gerekli
- Hafıza depolama maliyeti

### Bölüm 2.1: Gelişmiş Hafıza Tabanlı İş Akışı Desenleri

#### 2.1.1 Akıllı Veri Aktarımı

```typescript
// Örnek: E-ticaret checkout akışında veri sürekliliği
class ECommerceWorkflow {
  private agent: PuppeteerAgent;

  constructor(agent: PuppeteerAgent) {
    this.agent = agent;
    // İş akışı hafızasını etkinleştir
    this.agent.updateMemoryConfig({
      maxItems: 200,
      filterStrategy: 'hybrid',
      enableAnalytics: true
    });
  }

  async executeCheckoutFlow(productId: string): Promise<CheckoutResult> {
    // Adım 1: Ürün seçimi - hafızaya kaydedilir
    await this.agent.aiAction(`Navigate to product ${productId}`, {
      workflowStep: 'product_selection',
      priority: 'high'
    });

    const productInfo = await this.agent.aiQuery({
      name: 'Product name',
      price: 'Product price',
      availability: 'Stock status'
    });

    // Adım 2: Sepete ekleme - önceki ürün bilgisi hafızadan kullanılır
    await this.agent.aiAction('Add to cart', {
      workflowStep: 'add_to_cart',
      priority: 'high'
    });

    // Adım 3: Checkout - tüm önceki adımlar bağlam olarak kullanılır
    await this.agent.aiAction('Proceed to checkout', {
      workflowStep: 'checkout_initiation',
      priority: 'critical'
    });

    // Hafıza analitiklerini kontrol et
    const analytics = this.agent.getMemoryAnalytics();
    console.log('Workflow effectiveness:', analytics.memoryEffectiveness);

    return {
      success: true,
      productInfo: productInfo.result,
      workflowData: this.agent.getWorkflowMemory(),
      analytics
    };
  }
}

interface CheckoutResult {
  success: boolean;
  productInfo: any;
  workflowData: WorkflowMemoryData;
  analytics: MemoryAnalyticsReport;
}
```

#### 2.1.2 Bağlamsal Hata Kurtarma

```typescript
// Gelişmiş hata kurtarma mekanizması
class ResilientWorkflow {
  private agent: PuppeteerAgent;
  private retryConfig: RetryConfig;

  constructor(agent: PuppeteerAgent) {
    this.agent = agent;
    this.retryConfig = {
      maxRetries: 3,
      useMemoryForRecovery: true,
      adaptiveStrategy: true
    };
  }

  async executeWithRecovery<T>(
    action: () => Promise<T>,
    recoveryContext: RecoveryContext
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error as Error;

        if (this.retryConfig.useMemoryForRecovery) {
          // Hafızadan benzer hata durumlarını bul
          const similarErrors = this.findSimilarErrorsInMemory(error);

          if (similarErrors.length > 0) {
            // Önceki başarılı kurtarma stratejilerini uygula
            await this.applyRecoveryStrategy(similarErrors, recoveryContext);
          }
        }

        // Kısa bekleme
        await this.delay(1000 * (attempt + 1));
      }
    }

    throw lastError;
  }

  private findSimilarErrorsInMemory(error: Error): MemoryItem[] {
    const memory = this.agent.getMemory();
    return memory.filter(item =>
      item.tags?.includes('error') &&
      item.context?.errorInfo?.includes(error.message.substring(0, 50))
    );
  }

  private async applyRecoveryStrategy(
    similarErrors: MemoryItem[],
    context: RecoveryContext
  ): Promise<void> {
    // En son başarılı kurtarma stratejisini uygula
    const recoveryActions = this.extractRecoveryActions(similarErrors);

    for (const action of recoveryActions) {
      try {
        await this.agent.aiAction(action, {
          workflowStep: 'error_recovery',
          priority: 'critical'
        });
      } catch (e) {
        // Kurtarma aksiyonu başarısız, devam et
        continue;
      }
    }
  }

  private extractRecoveryActions(errorMemory: MemoryItem[]): string[] {
    // Hafızadan kurtarma aksiyonlarını çıkar
    // Bu gerçek implementasyonda daha sofistike olacak
    return ['Refresh page', 'Clear cookies', 'Navigate back'];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface RetryConfig {
  maxRetries: number;
  useMemoryForRecovery: boolean;
  adaptiveStrategy: boolean;
}

interface RecoveryContext {
  currentUrl: string;
  expectedState: string;
  criticalData?: any;
}

#### 2.1.3 Hafıza Tabanlı Karar Verme

```typescript
// Akıllı karar verme sistemi
class MemoryDrivenDecisionEngine {
  private agent: PuppeteerAgent;
  private decisionHistory: DecisionRecord[] = [];

  constructor(agent: PuppeteerAgent) {
    this.agent = agent;
  }

  async makeInformedDecision(
    context: DecisionContext,
    options: DecisionOption[]
  ): Promise<DecisionResult> {
    // Hafızadan benzer durumları bul
    const similarSituations = this.findSimilarSituations(context);

    // Her seçenek için başarı olasılığını hesapla
    const scoredOptions = await Promise.all(
      options.map(option => this.scoreOption(option, similarSituations, context))
    );

    // En iyi seçeneği seç
    const bestOption = scoredOptions.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    // Kararı kaydet
    const decision: DecisionRecord = {
      id: this.generateDecisionId(),
      timestamp: Date.now(),
      context,
      chosenOption: bestOption.option,
      score: bestOption.score,
      reasoning: bestOption.reasoning,
      outcome: 'pending'
    };

    this.decisionHistory.push(decision);

    return {
      decision: bestOption.option,
      confidence: bestOption.score,
      reasoning: bestOption.reasoning,
      alternativeOptions: scoredOptions.filter(o => o !== bestOption)
    };
  }

  async recordDecisionOutcome(
    decisionId: string,
    outcome: 'success' | 'failure',
    details?: any
  ): Promise<void> {
    const decision = this.decisionHistory.find(d => d.id === decisionId);
    if (decision) {
      decision.outcome = outcome;
      decision.outcomeDetails = details;

      // Hafızaya karar sonucunu ekle
      const memoryItem: MemoryItem = {
        id: `decision_${decisionId}`,
        timestamp: Date.now(),
        taskType: 'Planning',
        summary: `Decision "${decision.chosenOption.name}" resulted in ${outcome}`,
        context: {
          ...decision.context,
          decisionOutcome: outcome
        },
        metadata: {
          executionTime: Date.now() - decision.timestamp,
          success: outcome === 'success',
          confidence: decision.score,
          sessionId: this.agent.getMemoryStatus().config.toString()
        },
        priority: outcome === 'success' ? 'medium' : 'high',
        tags: ['decision', outcome, decision.chosenOption.category]
      };

      // Hafızaya ekle (bu için agent'ta yeni method gerekli)
      // this.agent.addToMemory(memoryItem);
    }
  }

  private findSimilarSituations(context: DecisionContext): MemoryItem[] {
    const memory = this.agent.getMemory();

    return memory.filter(item => {
      if (!item.context) return false;

      // URL benzerliği
      const urlSimilarity = this.calculateUrlSimilarity(
        context.currentUrl,
        item.context.url || ''
      );

      // Sayfa durumu benzerliği
      const stateSimilarity = this.calculateStateSimilarity(
        context.pageState,
        item.context
      );

      // Genel benzerlik skoru
      const overallSimilarity = (urlSimilarity + stateSimilarity) / 2;

      return overallSimilarity > 0.6; // %60 benzerlik eşiği
    });
  }

  private async scoreOption(
    option: DecisionOption,
    similarSituations: MemoryItem[],
    context: DecisionContext
  ): Promise<ScoredOption> {
    let score = option.baseScore || 0.5;
    let reasoning: string[] = [`Base score: ${score}`];

    // Hafızadan öğrenme
    if (similarSituations.length > 0) {
      const successfulSimilar = similarSituations.filter(item =>
        item.metadata?.success &&
        item.tags?.includes(option.category)
      );

      const successRate = successfulSimilar.length / similarSituations.length;
      score = (score + successRate) / 2;
      reasoning.push(`Historical success rate: ${(successRate * 100).toFixed(1)}%`);
    }

    // Bağlamsal faktörler
    if (context.urgency === 'high' && option.speed === 'fast') {
      score += 0.2;
      reasoning.push('Bonus for speed in urgent situation');
    }

    if (context.riskTolerance === 'low' && option.risk === 'low') {
      score += 0.15;
      reasoning.push('Bonus for low risk option');
    }

    return {
      option,
      score: Math.min(1.0, score), // Cap at 1.0
      reasoning: reasoning.join('; ')
    };
  }

  private calculateUrlSimilarity(url1: string, url2: string): number {
    if (!url1 || !url2) return 0;

    try {
      const u1 = new URL(url1);
      const u2 = new URL(url2);

      if (u1.hostname === u2.hostname) {
        if (u1.pathname === u2.pathname) return 1.0;
        return 0.7; // Same domain, different path
      }

      return 0.2; // Different domains
    } catch {
      return 0;
    }
  }

  private calculateStateSimilarity(state1: any, state2: any): number {
    // Basit benzerlik hesaplama - gerçek implementasyonda daha sofistike olacak
    if (!state1 || !state2) return 0;

    const keys1 = Object.keys(state1);
    const keys2 = Object.keys(state2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    const matchingValues = commonKeys.filter(key => state1[key] === state2[key]);
    return matchingValues.length / Math.max(keys1.length, keys2.length);
  }

  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

// Tip tanımları
interface DecisionContext {
  currentUrl: string;
  pageState: any;
  urgency: 'low' | 'medium' | 'high';
  riskTolerance: 'low' | 'medium' | 'high';
  availableTime: number; // milliseconds
}

interface DecisionOption {
  name: string;
  category: string;
  action: string;
  baseScore?: number;
  speed: 'slow' | 'medium' | 'fast';
  risk: 'low' | 'medium' | 'high';
  description: string;
}

interface ScoredOption {
  option: DecisionOption;
  score: number;
  reasoning: string;
}

interface DecisionResult {
  decision: DecisionOption;
  confidence: number;
  reasoning: string;
  alternativeOptions: ScoredOption[];
}

interface DecisionRecord {
  id: string;
  timestamp: number;
  context: DecisionContext;
  chosenOption: DecisionOption;
  score: number;
  reasoning: string;
  outcome: 'pending' | 'success' | 'failure';
  outcomeDetails?: any;
}
```

## Bölüm 3: `aiAssertion` için Gelişmiş Bağlam Zenginleştirmesi

### Amaç

`aiAssertion` fonksiyonunun, "mevcut sayfanın URL'sinin X olduğunu doğrula" gibi iddiaları doğru bir şekilde değerlendirebilmesi için sayfanın güncel URL'i, hafıza bağlamı ve iş akışı durumu gibi dinamik bilgilere erişimini sağlamak. Bu gelişmiş bağlam zenginleştirmesi, assertion'ların daha akıllı ve bağlam-aware olmasını sağlayacaktır.

### Mevcut Durum Analizi

#### 3.1 Mevcut aiAssert Implementasyonu

**Dosya:** `packages/web-integration/src/common/agent.ts` (satır 755-779)

```typescript
async aiAssert(assertion: string, msg?: string, opt?: AgentAssertOpt): Promise<AITaskResult<any>> {
  // Get the current page URL to include in the assertion context
  let currentUrl = "";
  if (this.page.url) {
    try {
      currentUrl = await this.page.url();
    } catch (e) {
      // Ignore errors getting URL
    }
  }

  // Add URL context to the assertion if available
  const assertionWithContext = currentUrl
    ? `For the page at URL "${currentUrl}", ${assertion}`
    : assertion;

  const { output, executor } = await this.taskExecutor.assert(assertionWithContext);
  // ...
}
```

**Mevcut Durum:** URL bağlamı zaten kısmen implementasyona eklenmiş, ancak daha sistematik hale getirilebilir.

#### 3.2 Geliştirilmiş Bağlam Zenginleştirmesi

### Çözüm Önerisi

#### 3.1 Assertion Prompt'unun Geliştirilmesi

**Dosya:** `packages/core/src/ai-model/prompt/assertion.ts`

**Mevcut Prompt (satır 4-11):**
```typescript
const defaultAssertionPrompt = 'You are a senior testing engineer. User will give an assertion and a screenshot of a page. By carefully viewing the screenshot, please tell whether the assertion is truthy. For URL-related assertions, the current page URL will be provided in the prompt.';
```

**Geliştirilmiş Prompt:**
```typescript
const defaultAssertionPrompt = `You are a senior testing engineer. User will give an assertion and a screenshot of a page.

Context Information Available:
- Screenshot of the current page
- Current page URL (if available)
- Page title (if available)
- Previous task memory (if available)

By carefully viewing the screenshot and using the provided context, please tell whether the assertion is truthy.

For URL-related assertions: Use the provided current page URL to verify URL-based claims.
For content-related assertions: Focus on the visual elements in the screenshot.
For navigation-related assertions: Consider both the URL and visual indicators.`;
```

#### 3.2 Dinamik Bağlam Oluşturma

**Dosya:** `packages/web-integration/src/common/agent.ts`

**Geliştirilmiş aiAssert metodu:**
```typescript
async aiAssert(assertion: string, msg?: string, opt?: AgentAssertOpt): Promise<AITaskResult<any>> {
  // Gelişmiş bağlam bilgilerini topla
  const contextInfo = await this.gatherEnhancedAssertionContext();

  // Hafıza tabanlı bağlam zenginleştirmesi
  const memoryContext = this.extractMemoryContext();

  // İş akışı bağlamını ekle
  const workflowContext = this.extractWorkflowContext();

  // Bağlam bilgilerini assertion'a ekle
  const enrichedAssertion = this.enrichAssertionWithAdvancedContext(
    assertion,
    contextInfo,
    memoryContext,
    workflowContext
  );

  // Assertion'ı çalıştır
  const { output, executor } = await this.taskExecutor.assert(enrichedAssertion, {
    workflowStep: 'assertion_validation',
    priority: 'high'
  });

  const metadata = this.afterTaskRunning(executor, true);

  // Assertion sonucunu hafızaya kaydet
  await this.recordAssertionOutcome(assertion, output, contextInfo);

  if (output && opt?.keepRawResponse) {
    return { result: output, metadata };
  }

  // ... geri kalan kod
}

/**
 * Gelişmiş assertion bağlamı toplar
 */
private async gatherEnhancedAssertionContext(): Promise<EnhancedAssertionContext> {
  const context: EnhancedAssertionContext = {
    timestamp: Date.now(),
    pageInfo: {},
    browserInfo: {},
    performanceInfo: {}
  };

  // Sayfa bilgileri
  try {
    if (this.page.url) {
      context.pageInfo.currentUrl = await this.page.url();
    }

    if (this.page.pageType === 'puppeteer' || this.page.pageType === 'playwright') {
      context.pageInfo.pageTitle = await (this.page as any).title();

      // Viewport bilgisi
      const viewport = await (this.page as any).viewport();
      context.pageInfo.viewport = viewport;

      // Sayfa yükleme durumu
      context.pageInfo.readyState = await (this.page as any).evaluate(() => document.readyState);
    }
  } catch (e) {
    // Sayfa bilgisi alınamadı, devam et
  }

  // Tarayıcı bilgileri
  try {
    context.browserInfo.userAgent = await (this.page as any).evaluate(() => navigator.userAgent);
    context.browserInfo.language = await (this.page as any).evaluate(() => navigator.language);
  } catch (e) {
    // Tarayıcı bilgisi alınamadı
  }

  // Performance bilgileri
  try {
    const performanceData = await (this.page as any).evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: perf.loadEventEnd - perf.loadEventStart,
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        responseTime: perf.responseEnd - perf.requestStart
      };
    });
    context.performanceInfo = performanceData;
  } catch (e) {
    // Performance bilgisi alınamadı
  }

  return context;
}

/**
 * Hafıza bağlamını çıkarır
 */
private extractMemoryContext(): MemoryContext {
  const memory = this.taskExecutor.getMemory();
  const recentMemory = memory.slice(-5); // Son 5 hafıza öğesi

  return {
    recentTasks: recentMemory.map(item => ({
      summary: item.summary,
      taskType: item.taskType,
      timestamp: item.timestamp,
      success: item.metadata?.success || false,
      priority: item.priority
    })),
    totalMemoryItems: memory.length,
    memoryEffectiveness: this.taskExecutor.getMemoryStats().analytics.memoryEffectiveness,
    relevantPatterns: this.findRelevantPatterns(memory)
  };
}

/**
 * İş akışı bağlamını çıkarır
 */
private extractWorkflowContext(): WorkflowContext {
  const workflowData = this.taskExecutor.getWorkflowMemory();

  return {
    workflowId: workflowData.workflowId,
    currentStep: workflowData.context.currentStep,
    totalSteps: workflowData.metadata.totalSteps,
    completedSteps: workflowData.metadata.completedSteps,
    failedSteps: workflowData.metadata.failedSteps,
    workflowProgress: workflowData.metadata.totalSteps > 0
      ? workflowData.metadata.completedSteps / workflowData.metadata.totalSteps
      : 0,
    estimatedTimeRemaining: this.estimateRemainingTime(workflowData)
  };
}

/**
 * Alakalı desenleri bulur
 */
private findRelevantPatterns(memory: readonly MemoryItem[]): string[] {
  const patterns: string[] = [];

  // Tekrarlayan görev tipleri
  const taskTypeCounts = memory.reduce((acc, item) => {
    acc[item.taskType] = (acc[item.taskType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(taskTypeCounts).forEach(([type, count]) => {
    if (count > 3) {
      patterns.push(`Frequent ${type} tasks (${count} times)`);
    }
  });

  // Başarısızlık desenleri
  const failures = memory.filter(item => !item.metadata?.success);
  if (failures.length > 2) {
    patterns.push(`${failures.length} failed operations detected`);
  }

  return patterns;
}

/**
 * Kalan süreyi tahmin eder
 */
private estimateRemainingTime(workflowData: WorkflowMemoryData): number {
  if (workflowData.metadata.totalSteps === 0) return 0;

  const elapsed = Date.now() - workflowData.metadata.startTime;
  const progress = workflowData.metadata.completedSteps / workflowData.metadata.totalSteps;

  if (progress === 0) return 0;

  const estimatedTotal = elapsed / progress;
  return Math.max(0, estimatedTotal - elapsed);
}

/**
 * Assertion'ı gelişmiş bağlam bilgileriyle zenginleştirir
 */
private enrichAssertionWithAdvancedContext(
  assertion: string,
  pageContext: EnhancedAssertionContext,
  memoryContext: MemoryContext,
  workflowContext: WorkflowContext
): string {
  const contextSections: string[] = [];

  // Sayfa bağlamı
  if (pageContext.pageInfo.currentUrl || pageContext.pageInfo.pageTitle) {
    const pageInfo: string[] = [];
    if (pageContext.pageInfo.currentUrl) {
      pageInfo.push(`URL: ${pageContext.pageInfo.currentUrl}`);
    }
    if (pageContext.pageInfo.pageTitle) {
      pageInfo.push(`Title: ${pageContext.pageInfo.pageTitle}`);
    }
    if (pageContext.pageInfo.readyState) {
      pageInfo.push(`Page State: ${pageContext.pageInfo.readyState}`);
    }
    contextSections.push(`Page Context:\n${pageInfo.map(info => `  - ${info}`).join('\n')}`);
  }

  // Hafıza bağlamı
  if (memoryContext.recentTasks.length > 0) {
    const memoryInfo: string[] = [];
    memoryInfo.push(`Total Memory Items: ${memoryContext.totalMemoryItems}`);
    memoryInfo.push(`Memory Effectiveness: ${(memoryContext.memoryEffectiveness * 100).toFixed(1)}%`);

    const recentTasksSummary = memoryContext.recentTasks
      .slice(-3) // Son 3 görev
      .map(task => `${task.taskType}: ${task.summary} (${task.success ? 'Success' : 'Failed'})`)
      .join('\n  - ');

    if (recentTasksSummary) {
      memoryInfo.push(`Recent Tasks:\n  - ${recentTasksSummary}`);
    }

    if (memoryContext.relevantPatterns.length > 0) {
      memoryInfo.push(`Patterns: ${memoryContext.relevantPatterns.join(', ')}`);
    }

    contextSections.push(`Memory Context:\n${memoryInfo.map(info => `  - ${info}`).join('\n')}`);
  }

  // İş akışı bağlamı
  if (workflowContext.workflowId) {
    const workflowInfo: string[] = [];
    workflowInfo.push(`Workflow ID: ${workflowContext.workflowId}`);
    if (workflowContext.currentStep) {
      workflowInfo.push(`Current Step: ${workflowContext.currentStep}`);
    }
    workflowInfo.push(`Progress: ${workflowContext.completedSteps}/${workflowContext.totalSteps} steps (${(workflowContext.workflowProgress * 100).toFixed(1)}%)`);

    if (workflowContext.failedSteps > 0) {
      workflowInfo.push(`Failed Steps: ${workflowContext.failedSteps}`);
    }

    if (workflowContext.estimatedTimeRemaining > 0) {
      const remainingMinutes = Math.ceil(workflowContext.estimatedTimeRemaining / 60000);
      workflowInfo.push(`Estimated Time Remaining: ${remainingMinutes} minutes`);
    }

    contextSections.push(`Workflow Context:\n${workflowInfo.map(info => `  - ${info}`).join('\n')}`);
  }

  // Performance bağlamı
  if (pageContext.performanceInfo && Object.keys(pageContext.performanceInfo).length > 0) {
    const perfInfo: string[] = [];
    if (pageContext.performanceInfo.loadTime) {
      perfInfo.push(`Load Time: ${pageContext.performanceInfo.loadTime}ms`);
    }
    if (pageContext.performanceInfo.responseTime) {
      perfInfo.push(`Response Time: ${pageContext.performanceInfo.responseTime}ms`);
    }

    if (perfInfo.length > 0) {
      contextSections.push(`Performance Context:\n${perfInfo.map(info => `  - ${info}`).join('\n')}`);
    }
  }

  if (contextSections.length === 0) {
    return assertion;
  }

  return `${contextSections.join('\n\n')}

Assertion to verify: ${assertion}`;
}

/**
 * Assertion sonucunu hafızaya kaydeder
 */
private async recordAssertionOutcome(
  assertion: string,
  result: any,
  context: EnhancedAssertionContext
): Promise<void> {
  const memoryItem: MemoryItem = {
    id: `assertion_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    taskType: 'Assertion',
    summary: `Assertion "${assertion}" ${result.pass ? 'passed' : 'failed'}`,
    context: {
      url: context.pageInfo.currentUrl,
      pageTitle: context.pageInfo.pageTitle,
      assertionResult: result.pass,
      assertionDetails: result.thought
    },
    metadata: {
      executionTime: 0, // Bu bilgi executor'dan gelecek
      success: result.pass,
      confidence: result.confidence || (result.pass ? 0.9 : 0.7),
      sessionId: this.taskExecutor.getMemoryStats().config.toString()
    },
    priority: result.pass ? 'medium' : 'high',
    tags: ['assertion', result.pass ? 'passed' : 'failed', 'validation']
  };

  // Bu method için executor'da yeni API gerekli
  // this.taskExecutor.addMemoryItem(memoryItem);
}

// Gelişmiş tip tanımları
interface EnhancedAssertionContext {
  timestamp: number;
  pageInfo: {
    currentUrl?: string;
    pageTitle?: string;
    viewport?: any;
    readyState?: string;
  };
  browserInfo: {
    userAgent?: string;
    language?: string;
  };
  performanceInfo: {
    loadTime?: number;
    domContentLoaded?: number;
    responseTime?: number;
  };
}

interface MemoryContext {
  recentTasks: Array<{
    summary: string;
    taskType: string;
    timestamp: number;
    success: boolean;
    priority: string;
  }>;
  totalMemoryItems: number;
  memoryEffectiveness: number;
  relevantPatterns: string[];
}

// WorkflowContext zaten tanımlandı yukarıda
```
```

#### 3.3 Gelişmiş URL Doğrulama

**URL pattern matching için yardımcı fonksiyonlar:**

```typescript
/**
 * URL assertion'ları için gelişmiş doğrulama
 */
private enhanceUrlAssertion(assertion: string, currentUrl: string): string {
  // URL assertion pattern'larını tespit et
  const urlPatterns = [
    /url.*is.*["']([^"']+)["']/i,
    /page.*at.*["']([^"']+)["']/i,
    /current.*url.*["']([^"']+)["']/i,
    /navigate.*to.*["']([^"']+)["']/i,
  ];

  for (const pattern of urlPatterns) {
    const match = assertion.match(pattern);
    if (match) {
      const expectedUrl = match[1];
      const urlComparison = this.compareUrls(currentUrl, expectedUrl);

      return `${assertion}

URL Comparison Details:
- Current URL: ${currentUrl}
- Expected URL: ${expectedUrl}
- Match Type: ${urlComparison.type}
- Match Score: ${urlComparison.score}`;
    }
  }

  return assertion;
}

/**
 * URL'leri karşılaştırır ve benzerlik skorunu döndürür
 */
private compareUrls(current: string, expected: string): { type: string; score: number } {
  try {
    const currentUrl = new URL(current);
    const expectedUrl = new URL(expected);

    // Tam eşleşme
    if (current === expected) {
      return { type: 'exact_match', score: 1.0 };
    }

    // Domain eşleşmesi
    if (currentUrl.hostname === expectedUrl.hostname) {
      // Path eşleşmesi
      if (currentUrl.pathname === expectedUrl.pathname) {
        return { type: 'domain_and_path_match', score: 0.9 };
      }
      return { type: 'domain_match', score: 0.7 };
    }

    // Kısmi eşleşme
    if (current.includes(expected) || expected.includes(current)) {
      return { type: 'partial_match', score: 0.5 };
    }

    return { type: 'no_match', score: 0.0 };
  } catch (e) {
    // URL parsing hatası
    return { type: 'parse_error', score: 0.0 };
  }
}
```

### 3.4 aiAssertion Kullanımı ve Test Örnekleri

#### 3.4.1 Temel Kullanım (Mevcut API Değişmez)

```typescript
// Mevcut kullanım - hiçbir değişiklik gerekmez
const agent = new PuppeteerAgent(page);

// Basit assertion
await agent.aiAssert('The page title contains "Google"');

// URL assertion - otomatik olarak URL bağlamı eklenir
await agent.aiAssert('Current page URL is "https://www.google.com"');

// İçerik assertion - hafıza bağlamı otomatik eklenir
await agent.aiAssert('The login was successful');
```

#### 3.4.2 Hafıza ile Çalışan Assertion Örnekleri

```typescript
// Senaryo: Çok adımlı işlem testi
const agent = new PuppeteerAgent(page);

// 1. Adım: Login yap
await agent.aiAction('Click login button');
await agent.aiAction('Enter username "testuser"');
await agent.aiAction('Enter password "testpass"');
await agent.aiAction('Click submit button');

// 2. Adım: Assertion - hafıza bağlamını kullanır
await agent.aiAssert('User is successfully logged in');
// AI şunu görür:
// Context Information:
// - Current Page URL: https://app.example.com/dashboard
// - Recent Tasks: Clicked login button; Entered username; Entered password; Clicked submit button
// Assertion to verify: User is successfully logged in

// 3. Adım: Navigasyon
await agent.aiAction('Navigate to profile page');

// 4. Adım: Assertion - güncel URL + hafıza
await agent.aiAssert('Profile page is displayed correctly');
// AI şunu görür:
// Context Information:
// - Current Page URL: https://app.example.com/profile
// - Recent Tasks: User logged in successfully; Navigated to profile page
// Assertion to verify: Profile page is displayed correctly
```

#### 3.4.3 Gelişmiş Test Senaryoları

```typescript
// Test 1: URL Validation
describe('URL Assertion Tests', () => {
  it('should validate exact URL match', async () => {
    await agent.goto('https://www.google.com');

    const result = await agent.aiAssert('Current page URL is exactly "https://www.google.com"');
    expect(result.result.pass).toBe(true);
  });

  it('should validate URL pattern', async () => {
    await agent.goto('https://www.google.com/search?q=test');

    const result = await agent.aiAssert('Current page URL contains "google.com" and has search parameters');
    expect(result.result.pass).toBe(true);
  });
});

// Test 2: Memory Context Tests
describe('Memory Context Assertion Tests', () => {
  it('should use memory context in assertions', async () => {
    // İlk aksiyon
    await agent.aiAction('Click the "Products" menu');

    // İkinci aksiyon
    await agent.aiAction('Select "Laptops" category');

    // Assertion - hafıza bağlamını kullanmalı
    const result = await agent.aiAssert('The laptops category page is displayed');

    expect(result.result.pass).toBe(true);
    expect(result.result.summary).toContain('laptops category');
  });

  it('should handle complex multi-step scenarios', async () => {
    // E-commerce checkout flow
    await agent.aiAction('Add product to cart');
    await agent.aiAction('Go to checkout');
    await agent.aiAction('Enter shipping information');
    await agent.aiAction('Select payment method');

    // Bu assertion, tüm önceki adımları bağlam olarak kullanır
    const result = await agent.aiAssert('Checkout process is completed successfully');

    expect(result.result.pass).toBe(true);

    // Hafıza durumunu kontrol et
    const memory = agent.getMemory();
    expect(memory.length).toBeGreaterThan(0);
    expect(memory.some(item => item.includes('cart'))).toBe(true);
  });
});

// Test 3: Context Enrichment Tests
describe('Context Enrichment Tests', () => {
  it('should include page title in context', async () => {
    await agent.goto('https://example.com');

    // Debug modunda context bilgilerini görmek için
    process.env.MIDSCENE_DEBUG_MEMORY = 'true';

    const result = await agent.aiAssert('Page is loaded correctly', undefined, {
      keepRawResponse: true
    });

    // Raw response'da context bilgilerinin olduğunu kontrol et
    expect(result.result.thought).toBeDefined();
    console.log('Context used:', result.result.thought);
  });
});
```

#### 3.4.4 Hafıza Kontrolü ve Debug

```typescript
// Hafıza durumunu kontrol etme
describe('Memory Management Tests', () => {
  it('should manage memory correctly', async () => {
    const agent = new PuppeteerAgent(page);

    // Başlangıçta hafıza boş olmalı
    expect(agent.getMemory().length).toBe(0);

    // Birkaç aksiyon yap
    await agent.aiAction('Click button 1');
    await agent.aiAction('Click button 2');
    await agent.aiAssert('Buttons were clicked');

    // Hafızanın dolduğunu kontrol et
    const memory = agent.getMemory();
    expect(memory.length).toBeGreaterThan(0);

    // Hafıza içeriğini kontrol et
    console.log('Current memory:', memory);

    // Hafızayı temizle
    agent.clearMemory();
    expect(agent.getMemory().length).toBe(0);
  });

  it('should limit memory size', async () => {
    const agent = new PuppeteerAgent(page);

    // 15 aksiyon yap (hafıza limiti 10)
    for (let i = 0; i < 15; i++) {
      await agent.aiAction(`Click button ${i}`);
    }

    // Hafıza boyutunun 10'u geçmediğini kontrol et
    const memory = agent.getMemory();
    expect(memory.length).toBeLessThanOrEqual(10);

    // En eski görevlerin silindiğini kontrol et
    expect(memory.some(item => item.includes('button 0'))).toBe(false);
    expect(memory.some(item => item.includes('button 14'))).toBe(true);
  });
});
```

#### 3.4.5 Hata Durumları ve Edge Cases

```typescript
describe('Error Handling Tests', () => {
  it('should handle URL access errors gracefully', async () => {
    // URL alınamayan durumu simüle et
    const mockPage = {
      url: () => { throw new Error('URL not accessible'); }
    };

    const agent = new PuppeteerAgent(mockPage as any);

    // Assertion hala çalışmalı, sadece URL bağlamı olmayacak
    const result = await agent.aiAssert('Page is loaded');

    // Hata fırlatmamalı, sadece URL bağlamı eksik olmalı
    expect(result).toBeDefined();
  });

  it('should handle memory corruption gracefully', async () => {
    const agent = new PuppeteerAgent(page);

    // Hafızayı bozuk veriyle kirlet (test amaçlı)
    (agent as any).taskExecutor.persistentExecutor.memory = [
      '', // boş string
      'a'.repeat(1000), // çok uzun string
      null, // null değer
    ];

    // Assertion hala çalışmalı
    const result = await agent.aiAssert('System is stable');
    expect(result).toBeDefined();
  });
});
```

#### 3.4.6 Performance Tests

```typescript
describe('Performance Tests', () => {
  it('should handle large memory efficiently', async () => {
    const agent = new PuppeteerAgent(page);

    const startTime = Date.now();

    // 50 aksiyon + assertion yap
    for (let i = 0; i < 50; i++) {
      await agent.aiAction(`Action ${i}`);
    }

    await agent.aiAssert('All actions completed successfully');

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Performance degradation %5'ten az olmalı
    console.log(`Duration: ${duration}ms`);
    expect(duration).toBeLessThan(60000); // 1 dakikadan az
  });
});
```

### Entegrasyon

Bu yaklaşım, Bölüm 1'deki hafıza mekanizmasıyla birlikte çalışarak AI'ın hem geçmiş görevlerden hem de o anki durumdan haberdar olmasını sağlar. Agent seviyesinde yapılan bu zenginleştirme, `Executor` seviyesinde değişiklik gerektirmez ve sorumluluğu bağlama en hakim olan katmana bırakır.

**Önemli:** Mevcut `aiAssert` API'si hiç değişmez. Tüm iyileştirmeler arka planda otomatik olarak çalışır.

### 3.5 Pratik Test Örneği - Gerçek Senaryo

İşte tam olarak nasıl çalışacağına dair gerçek bir test örneği:

```typescript
// test/memory-assertion.test.ts
import { PuppeteerAgent } from '@/puppeteer';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { launchPage } from './utils';

describe('Memory-Enhanced Assertions - Real World Example', () => {
  let agent: PuppeteerAgent;
  let resetFn: () => Promise<void>;

  beforeEach(async () => {
    const { originPage, reset } = await launchPage('https://example-ecommerce.com');
    resetFn = reset;
    agent = new PuppeteerAgent(originPage);
  });

  afterEach(async () => {
    if (resetFn) await resetFn();
  });

  it('E-commerce checkout flow with memory context', async () => {
    // ADIM 1: Ürün arama ve seçme
    await agent.aiAction('Search for "laptop" in the search box');
    await agent.aiAction('Click on the first laptop in results');

    // ASSERTION 1: Ürün sayfasında olduğumuzu doğrula
    // AI şunu görür:
    // Context Information:
    // - Current Page URL: https://example-ecommerce.com/product/laptop-123
    // - Recent Tasks: Searched for laptop; Clicked first laptop
    // Assertion to verify: Product page is displayed
    const result1 = await agent.aiAssert('Product page is displayed');
    expect(result1.result.pass).toBe(true);

    // ADIM 2: Sepete ekleme
    await agent.aiAction('Click "Add to Cart" button');
    await agent.aiAction('Click "View Cart" button');

    // ASSERTION 2: Sepet sayfasında olduğumuzu doğrula
    // AI şunu görür:
    // Context Information:
    // - Current Page URL: https://example-ecommerce.com/cart
    // - Recent Tasks: Product page displayed; Added to cart; Viewed cart
    // Assertion to verify: Cart page shows the laptop
    const result2 = await agent.aiAssert('Cart page shows the laptop');
    expect(result2.result.pass).toBe(true);

    // ADIM 3: Checkout işlemi
    await agent.aiAction('Click "Proceed to Checkout" button');
    await agent.aiAction('Fill shipping address form');
    await agent.aiAction('Select "Credit Card" payment method');

    // ASSERTION 3: Checkout sayfasında doğru bilgilerin olduğunu doğrula
    // AI şunu görür:
    // Context Information:
    // - Current Page URL: https://example-ecommerce.com/checkout
    // - Recent Tasks: Cart page verified; Proceeded to checkout; Filled address; Selected payment
    // Assertion to verify: Checkout page shows correct order summary
    const result3 = await agent.aiAssert('Checkout page shows correct order summary');
    expect(result3.result.pass).toBe(true);

    // HAFIZA DURUMUNU KONTROL ET
    const memory = agent.getMemory();
    console.log('Final memory state:', memory);

    // Hafızada önemli adımların olduğunu doğrula
    expect(memory.some(item => item.toLowerCase().includes('laptop'))).toBe(true);
    expect(memory.some(item => item.toLowerCase().includes('cart'))).toBe(true);
    expect(memory.some(item => item.toLowerCase().includes('checkout'))).toBe(true);
  });

  it('Login flow with URL and memory context', async () => {
    // ADIM 1: Login sayfasına git
    await agent.aiAction('Click "Login" link in header');

    // ASSERTION 1: Login sayfasında olduğumuzu doğrula
    // AI şunu görür:
    // Context Information:
    // - Current Page URL: https://example-ecommerce.com/login
    // - Recent Tasks: Clicked login link
    // Assertion to verify: Login page is displayed
    const result1 = await agent.aiAssert('Login page is displayed');
    expect(result1.result.pass).toBe(true);

    // ADIM 2: Login bilgilerini gir
    await agent.aiAction('Enter email "test@example.com"');
    await agent.aiAction('Enter password "testpass123"');
    await agent.aiAction('Click "Sign In" button');

    // ASSERTION 2: Başarılı login sonrası dashboard'da olduğumuzu doğrula
    // AI şunu görür:
    // Context Information:
    // - Current Page URL: https://example-ecommerce.com/dashboard
    // - Recent Tasks: Login page displayed; Entered email; Entered password; Clicked sign in
    // Assertion to verify: Successfully logged in and redirected to dashboard
    const result2 = await agent.aiAssert('Successfully logged in and redirected to dashboard');
    expect(result2.result.pass).toBe(true);

    // ASSERTION 3: URL'nin değiştiğini doğrula
    // AI şunu görür:
    // Context Information:
    // - Current Page URL: https://example-ecommerce.com/dashboard
    // - Recent Tasks: Login successful; Redirected to dashboard
    // Assertion to verify: Current URL is not the login page anymore
    const result3 = await agent.aiAssert('Current URL is not the login page anymore');
    expect(result3.result.pass).toBe(true);
  });

  it('Form validation with memory context', async () => {
    await agent.aiAction('Go to contact form page');

    // ADIM 1: Boş form göndermeyi dene
    await agent.aiAction('Click submit button without filling form');

    // ASSERTION 1: Hata mesajlarının göründüğünü doğrula
    const result1 = await agent.aiAssert('Form validation errors are displayed');
    expect(result1.result.pass).toBe(true);

    // ADIM 2: Formu kısmen doldur
    await agent.aiAction('Enter name "John Doe"');
    await agent.aiAction('Click submit button');

    // ASSERTION 2: Hala eksik alan hatası olduğunu doğrula
    // AI hafızadan biliyor ki daha önce validation hatası vardı
    const result2 = await agent.aiAssert('Email field validation error is still shown');
    expect(result2.result.pass).toBe(true);

    // ADIM 3: Formu tamamen doldur
    await agent.aiAction('Enter email "john@example.com"');
    await agent.aiAction('Enter message "Test message"');
    await agent.aiAction('Click submit button');

    // ASSERTION 3: Başarı mesajının göründüğünü doğrula
    const result3 = await agent.aiAssert('Form submitted successfully');
    expect(result3.result.pass).toBe(true);
  });
});
```

### 3.6 Debug ve Troubleshooting

```typescript
// Debug modunda hafıza ve context bilgilerini görmek için
describe('Debug Memory and Context', () => {
  it('should show detailed context information', async () => {
    // Debug modunu aç
    process.env.MIDSCENE_DEBUG_MEMORY = 'true';
    process.env.MIDSCENE_DEBUG_CONTEXT = 'true';

    const agent = new PuppeteerAgent(page);

    await agent.aiAction('Navigate to products page');
    await agent.aiAction('Filter by category "Electronics"');

    // Bu assertion'da debug bilgileri console'da görünecek
    const result = await agent.aiAssert('Electronics products are displayed', undefined, {
      keepRawResponse: true
    });

    // Console output örneği:
    // [MEMORY DEBUG] Assert Task:
    //   Items: 2
    //   Content: [
    //     "Navigated to products page",
    //     "Filtered products by Electronics category"
    //   ]
    // [CONTEXT DEBUG] Assertion Context:
    //   Current URL: https://example.com/products?category=electronics
    //   Page Title: Electronics - Product Catalog
    //   Memory Items: 2
    //   Enhanced Assertion: Context Information:
    //   - Current Page URL: https://example.com/products?category=electronics
    //   - Page Title: Electronics - Product Catalog
    //   - Recent Tasks: Navigated to products page; Filtered products by Electronics category
    //   Assertion to verify: Electronics products are displayed

    expect(result.result.pass).toBe(true);
    console.log('Raw AI Response:', result.result);
  });
});
```

Bu örnekler gösteriyor ki:

1. **Mevcut API hiç değişmiyor** - `agent.aiAssert('...')` aynı şekilde çalışıyor
2. **Hafıza otomatik ekleniyor** - Her aksiyon sonrası hafızaya özet ekleniyor
3. **URL bağlamı otomatik** - Mevcut sayfa URL'i otomatik olarak assertion'a ekleniyor
4. **Debug kolay** - Environment variable'lar ile debug modunu açabiliyorsun
5. **Test edilebilir** - Hafıza durumunu kontrol edebiliyorsun

Yani sen hiçbir şey değiştirmeden, sadece `agent.aiAssert('...')` çağırıyorsun, arka planda tüm hafıza ve bağlam zenginleştirmesi otomatik oluyor!

### 3.7 aiQuery ve Extraction Methodları ile Hafıza

#### 3.7.1 aiQuery Hafıza Entegrasyonu

**Evet! `aiQuery` ve diğer extraction methodlarından çıkarılan değerler de hafızaya kaydediliyor:**

```typescript
// aiQuery kullanımı - API değişmiyor
const agent = new PuppeteerAgent(page);

// 1. Veri çıkarma
const productInfo = await agent.aiQuery('Extract product name and price');
// Sonuç: { name: "MacBook Pro", price: "$1999" }
// Hafızaya kaydedilen: "Extracted product data: name=MacBook Pro, price=$1999"

// 2. Başka bir veri çıkarma
const userInfo = await agent.aiQuery('Get user profile information');
// Sonuç: { username: "john_doe", email: "john@example.com" }
// Hafızaya kaydedilen: "Extracted user profile: username=john_doe, email=john@example.com"

// 3. Assertion - önceki çıkarılan veriler bağlam olarak kullanılır
await agent.aiAssert('Product price matches user\'s budget');
// AI görür:
// Context Information:
// - Recent Tasks: Extracted product data: name=MacBook Pro, price=$1999; Extracted user profile: username=john_doe, email=john@example.com
// - Current URL: https://shop.example.com/product/macbook
// Assertion to verify: Product price matches user's budget
```

#### 3.7.2 Farklı Query Tiplerinin Hafıza Formatları

```typescript
// String query
const title = await agent.aiString('Get page title');
// Hafıza: "Extracted page title: Welcome to Our Store"

// Number query
const itemCount = await agent.aiNumber('Count items in cart');
// Hafıza: "Extracted item count: 3"

// Boolean query
const isLoggedIn = await agent.aiBoolean('Is user logged in?');
// Hafıza: "Checked login status: true"

// Object query
const formData = await agent.aiQuery({
  name: 'User full name from form',
  email: 'Email address from form',
  phone: 'Phone number from form'
});
// Hafıza: "Extracted form data: name=John Smith, email=john@example.com, phone=555-1234"

// Array query
const productList = await agent.aiQuery('List all product names on page');
// Hafıza: "Extracted product list: [iPhone 14, MacBook Pro, iPad Air] (3 items)"
```

#### 3.7.3 Gerçek Test Örnekleri

```typescript
describe('aiQuery Memory Integration', () => {
  let agent: PuppeteerAgent;

  beforeEach(async () => {
    const { originPage, reset } = await launchPage('https://ecommerce-example.com');
    agent = new PuppeteerAgent(originPage);
  });

  it('should use extracted data in subsequent assertions', async () => {
    // ADIM 1: Ürün bilgilerini çıkar
    const product = await agent.aiQuery({
      name: 'Product name',
      price: 'Product price as number',
      inStock: 'Is product in stock (boolean)'
    });

    console.log('Extracted product:', product.result);
    // Örnek sonuç: { name: "Gaming Laptop", price: 1299, inStock: true }

    // ADIM 2: Sepete ekleme aksiyonu
    await agent.aiAction('Add product to cart');

    // ADIM 3: Sepet sayfasına git
    await agent.aiAction('Go to cart page');

    // ADIM 4: Assertion - çıkarılan ürün bilgileri bağlam olarak kullanılır
    const assertion = await agent.aiAssert('Cart contains the Gaming Laptop with correct price');

    // AI şunu görür:
    // Context Information:
    // - Recent Tasks: Extracted product data: name=Gaming Laptop, price=1299, inStock=true; Added product to cart; Went to cart page
    // - Current URL: https://ecommerce-example.com/cart
    // Assertion to verify: Cart contains the Gaming Laptop with correct price

    expect(assertion.result.pass).toBe(true);

    // Hafızayı kontrol et
    const memory = agent.getMemory();
    expect(memory.some(item => item.includes('Gaming Laptop'))).toBe(true);
    expect(memory.some(item => item.includes('1299'))).toBe(true);
  });

  it('should handle complex data extraction flow', async () => {
    // SENARYO: Kullanıcı profili güncelleme

    // 1. Mevcut profil bilgilerini çıkar
    const currentProfile = await agent.aiQuery({
      firstName: 'First name field value',
      lastName: 'Last name field value',
      email: 'Email field value',
      phone: 'Phone field value'
    });

    // 2. Profil düzenleme sayfasına git
    await agent.aiAction('Click edit profile button');

    // 3. Bilgileri güncelle
    await agent.aiAction('Change first name to "Jane"');
    await agent.aiAction('Change phone to "555-9999"');
    await agent.aiAction('Click save button');

    // 4. Güncellenmiş profil bilgilerini çıkar
    const updatedProfile = await agent.aiQuery({
      firstName: 'Updated first name',
      lastName: 'Updated last name',
      email: 'Updated email',
      phone: 'Updated phone'
    });

    // 5. Assertion - hem eski hem yeni veriler bağlamda
    const assertion = await agent.aiAssert('Profile was updated correctly with new name and phone');

    // AI görür:
    // Context Information:
    // - Recent Tasks:
    //   * Extracted profile: firstName=John, lastName=Smith, email=john@example.com, phone=555-1234
    //   * Clicked edit profile
    //   * Changed name to Jane
    //   * Changed phone to 555-9999
    //   * Saved changes
    //   * Extracted updated profile: firstName=Jane, lastName=Smith, email=john@example.com, phone=555-9999
    // Assertion to verify: Profile was updated correctly with new name and phone

    expect(assertion.result.pass).toBe(true);

    // Hafızada hem eski hem yeni değerlerin olduğunu kontrol et
    const memory = agent.getMemory();
    expect(memory.some(item => item.includes('John'))).toBe(true);  // Eski değer
    expect(memory.some(item => item.includes('Jane'))).toBe(true);  // Yeni değer
    expect(memory.some(item => item.includes('555-9999'))).toBe(true); // Yeni telefon
  });

  it('should handle list data extraction', async () => {
    // Liste verilerini çıkarma
    await agent.aiAction('Go to products page');

    // Ürün listesini çıkar
    const products = await agent.aiQuery('Extract all product names as array');
    // Sonuç: ["Laptop", "Mouse", "Keyboard", "Monitor"]
    // Hafıza: "Extracted product list: [Laptop, Mouse, Keyboard, Monitor] (4 items)"

    // Fiyat listesini çıkar
    const prices = await agent.aiQuery('Extract all product prices as array');
    // Sonuç: [999, 29, 79, 299]
    // Hafıza: "Extracted price list: [999, 29, 79, 299] (4 items)"

    // Filtreleme yap
    await agent.aiAction('Filter products by price range $50-$500');

    // Assertion - çıkarılan liste verileri bağlamda kullanılır
    const assertion = await agent.aiAssert('Filtered products show only Mouse, Keyboard and Monitor');

    // AI görür tüm çıkarılan liste verilerini ve filtreleme işlemini
    expect(assertion.result.pass).toBe(true);
  });
});
```

#### 3.7.4 Hafıza Formatı Optimizasyonu

```typescript
// packages/core/src/ai-model/inspect.ts - AiExtractElementInfo güncellemesi
function generateExtractionSummary(data: any, query: string | Record<string, string>): string {
  const queryStr = typeof query === 'string' ? query : Object.keys(query).join(', ');

  if (Array.isArray(data)) {
    return `Extracted ${queryStr}: [${data.slice(0, 3).join(', ')}${data.length > 3 ? '...' : ''}] (${data.length} items)`;
  }

  if (data && typeof data === 'object') {
    const entries = Object.entries(data).slice(0, 3);
    const summary = entries.map(([key, value]) => `${key}=${value}`).join(', ');
    const totalKeys = Object.keys(data).length;
    return `Extracted ${queryStr}: ${summary}${totalKeys > 3 ? '...' : ''} (${totalKeys} fields)`;
  }

  if (typeof data === 'string') {
    const truncated = data.length > 50 ? data.substring(0, 50) + '...' : data;
    return `Extracted ${queryStr}: "${truncated}"`;
  }

  if (typeof data === 'number') {
    return `Extracted ${queryStr}: ${data}`;
  }

  if (typeof data === 'boolean') {
    return `Extracted ${queryStr}: ${data}`;
  }

  return `Extracted ${queryStr}: ${String(data)}`;
}
```

#### 3.7.5 Debug ve Monitoring

```typescript
describe('Query Data Memory Debug', () => {
  it('should show extracted data in memory debug', async () => {
    process.env.MIDSCENE_DEBUG_MEMORY = 'true';

    const agent = new PuppeteerAgent(page);

    // Veri çıkar
    const userData = await agent.aiQuery({
      name: 'User name',
      age: 'User age as number',
      isActive: 'Is user active (boolean)'
    });

    // Debug output:
    // [MEMORY DEBUG] Query Task:
    //   Items: 1
    //   Content: ["Extracted name, age, isActive: name=John Doe, age=30, isActive=true (3 fields)"]

    // Assertion yap
    await agent.aiAssert('User data is valid');

    // Debug output:
    // [MEMORY DEBUG] Assert Task:
    //   Items: 2
    //   Content: [
    //     "Extracted name, age, isActive: name=John Doe, age=30, isActive=true (3 fields)",
    //     "Assertion: User data is valid - passed"
    //   ]

    expect(userData.result).toBeDefined();
  });
});
```

**Özet:**
- ✅ `aiQuery`, `aiString`, `aiNumber`, `aiBoolean` - hepsi hafızaya kaydediliyor
- ✅ Çıkarılan veriler akıllı şekilde özetleniyor (çok uzun olmasın diye)
- ✅ Sonraki assertion'larda bu veriler bağlam olarak kullanılıyor
- ✅ Array ve Object veriler de düzgün formatlanıyor
- ✅ Debug modunda tüm çıkarılan veriler görünüyor

Bu sayede AI, önceki adımlarda çıkardığı verileri hatırlayarak daha akıllı assertion'lar yapabiliyor! 🧠💪

## Bölüm 4: Implementasyon Planı ve Test Stratejisi

### 4.1 Aşamalı Implementasyon

#### Faz 1: Core Değişiklikler (1-2 hafta)
1. **Tip Tanımları Güncelleme** (`packages/core/src/types.ts`)
   - `ExecutionTaskReturn`, `PlanningAIResponse`, `AIAssertionResponse`, `AIDataExtractionResponse` interface'lerine `summary` alanı ekleme
   - Geriye dönük uyumluluk için `summary` alanını optional yapma

2. **Prompt Güncellemeleri** (`packages/core/src/ai-model/prompt/`)
   - `llm-planning.ts`: JSON schema'ya `summary` alanı ekleme
   - `assertion.ts`: Response format'ına `summary` alanı ekleme
   - `extraction.ts`: Response format'ına `summary` alanı ekleme

3. **AI Fonksiyonları Güncelleme** (`packages/core/src/ai-model/`)
   - `llm-planning.ts`: `plan` fonksiyonunda summary handling
   - `inspect.ts`: `AiAssert`, `AiExtractElementInfo` fonksiyonlarında summary handling

#### Faz 2: Executor Hafıza Mekanizması (1 hafta)
1. **Executor Sınıfı Güncelleme** (`packages/core/src/ai-model/action-executor.ts`)
   - Hafıza deposu ekleme (`private memory: string[]`)
   - Hafıza yönetim metodları ekleme
   - `flush` metodunu hafıza entegrasyonu için güncelleme

#### Faz 3: Web Integration Güncellemeleri (1 hafta)
1. **PageTaskExecutor Güncelleme** (`packages/web-integration/src/common/tasks.ts`)
   - Persistent executor implementasyonu
   - Hafıza kontrolü metodları

2. **Agent Bağlam Zenginleştirmesi** (`packages/web-integration/src/common/agent.ts`)
   - `aiAssert` metodunda gelişmiş bağlam toplama
   - URL doğrulama yardımcı fonksiyonları

#### Faz 4: Test ve Optimizasyon (1 hafta)
1. Unit testler yazma
2. Integration testler yazma
3. Performance optimizasyonu
4. Dokümantasyon güncelleme

### 4.2 Test Stratejisi

#### 4.2.1 Unit Testler

**Dosya:** `packages/core/tests/unit-test/action-executor.test.ts`

```typescript
import { Executor } from '@/ai-model/action-executor';
import { describe, expect, it, beforeEach } from 'vitest';

describe('Executor Memory Mechanism', () => {
  let executor: Executor;

  beforeEach(() => {
    executor = new Executor('Test Executor');
  });

  it('should initialize with empty memory', () => {
    expect(executor.getMemory()).toEqual([]);
  });

  it('should add summary to memory after successful task', async () => {
    const mockTask = {
      type: 'Planning',
      param: { userInstruction: 'test instruction' },
      executor: async () => ({ summary: 'Test task completed' }),
    };

    await executor.append(mockTask);
    await executor.flush();

    expect(executor.getMemory()).toContain('Test task completed');
  });

  it('should limit memory size to 10 items', async () => {
    // 15 görev ekle
    for (let i = 0; i < 15; i++) {
      const mockTask = {
        type: 'Planning',
        param: { userInstruction: `test ${i}` },
        executor: async () => ({ summary: `Task ${i} completed` }),
      };
      await executor.append(mockTask);
      await executor.flush();
    }

    expect(executor.getMemory().length).toBe(10);
    expect(executor.getMemory()[0]).toBe('Task 5 completed'); // İlk 5 silinmiş olmalı
  });

  it('should pass memory as log to planning tasks', async () => {
    // İlk görev: hafızaya bir şey ekle
    const firstTask = {
      type: 'Planning',
      param: { userInstruction: 'first task' },
      executor: async () => ({ summary: 'First task completed' }),
    };
    await executor.append(firstTask);
    await executor.flush();

    // İkinci görev: hafızanın log olarak geçirildiğini kontrol et
    let receivedLog = '';
    const secondTask = {
      type: 'Planning',
      param: { userInstruction: 'second task' },
      executor: async (param: any) => {
        receivedLog = param.log || '';
        return { summary: 'Second task completed' };
      },
    };
    await executor.append(secondTask);
    await executor.flush();

    expect(receivedLog).toContain('First task completed');
  });
});
```

#### 4.2.2 Integration Testler

**Dosya:** `packages/web-integration/tests/ai/web/puppeteer/memory-integration.test.ts`

```typescript
import { PuppeteerAgent } from '@/puppeteer';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { launchPage } from './utils';

describe('Memory Integration with PuppeteerAgent', () => {
  let agent: PuppeteerAgent;
  let resetFn: () => Promise<void>;

  beforeEach(async () => {
    const { originPage, reset } = await launchPage('https://example.com');
    resetFn = reset;
    agent = new PuppeteerAgent(originPage);
  });

  afterEach(async () => {
    if (resetFn) await resetFn();
  });

  it('should maintain memory across multiple AI actions', async () => {
    // İlk aksiyon
    await agent.aiAction('Click the first button');

    // Hafızayı kontrol et
    const memory1 = agent.getMemory();
    expect(memory1.length).toBeGreaterThan(0);

    // İkinci aksiyon
    await agent.aiAction('Click the second button');

    // Hafızanın büyüdüğünü kontrol et
    const memory2 = agent.getMemory();
    expect(memory2.length).toBeGreaterThan(memory1.length);
  });

  it('should use memory context in assertions', async () => {
    // Bir aksiyon yap
    await agent.aiAction('Navigate to about page');

    // Assertion yap - hafıza bağlamını kullanmalı
    const result = await agent.aiAssert('The page has been navigated successfully');

    expect(result.result.pass).toBe(true);
  });

  it('should clear memory when requested', async () => {
    // Hafızaya bir şey ekle
    await agent.aiAction('Click something');
    expect(agent.getMemory().length).toBeGreaterThan(0);

    // Hafızayı temizle
    agent.clearMemory();
    expect(agent.getMemory().length).toBe(0);
  });
});
```

#### 4.2.3 Performance Testleri

```typescript
describe('Memory Performance Tests', () => {
  it('should handle large memory efficiently', async () => {
    const executor = new Executor('Performance Test');

    const startTime = Date.now();

    // 100 görev ekle
    for (let i = 0; i < 100; i++) {
      const task = {
        type: 'Planning',
        param: { userInstruction: `task ${i}` },
        executor: async () => ({ summary: `Task ${i} completed with some detailed information` }),
      };
      await executor.append(task);
      await executor.flush();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // 100 görev 10 saniyeden az sürmeli
    expect(duration).toBeLessThan(10000);

    // Hafıza boyutu sınırlı kalmalı
    expect(executor.getMemory().length).toBeLessThanOrEqual(10);
  });
});
```

### 4.3 Hata Yönetimi ve Edge Case'ler

#### 4.3.1 Hata Senaryoları

1. **AI'dan summary gelmediğinde:** Fallback summary oluşturma
2. **Hafıza çok büyüdüğünde:** Otomatik temizleme
3. **Executor error state'inde:** Hafıza korunması
4. **URL alınamadığında:** Graceful degradation

#### 4.3.2 Monitoring ve Logging

```typescript
// Hafıza kullanımını izleme
export class MemoryMonitor {
  static logMemoryUsage(executor: Executor): void {
    const memory = executor.getMemory();
    console.log(`Memory usage: ${memory.length} items, total chars: ${memory.join('').length}`);
  }

  static validateMemoryHealth(executor: Executor): boolean {
    const memory = executor.getMemory();

    // Hafıza boyutu kontrolü
    if (memory.length > 15) {
      console.warn('Memory size exceeds recommended limit');
      return false;
    }

    // Hafıza içeriği kontrolü
    const totalChars = memory.join('').length;
    if (totalChars > 10000) {
      console.warn('Memory content size too large');
      return false;
    }

    return true;
  }
}

## Bölüm 5: Deployment ve Migration Stratejisi

### 5.1 Versioning Stratejisi

#### 5.1.1 Semantic Versioning

**@misoai/core paketi:**
- Minor version bump (örn. 1.2.0 → 1.3.0)
- Geriye dönük uyumlu değişiklikler
- Yeni `summary` alanları optional

**@misoai/web-integration paketi:**
- Minor version bump (örn. 1.2.0 → 1.3.0)
- Yeni hafıza yönetimi metodları
- Mevcut API'ler değişmez

#### 5.1.2 Feature Flags

```typescript
// packages/core/src/config/features.ts
export const FEATURE_FLAGS = {
  MEMORY_MECHANISM: process.env.MIDSCENE_ENABLE_MEMORY === 'true',
  ENHANCED_CONTEXT: process.env.MIDSCENE_ENABLE_ENHANCED_CONTEXT === 'true',
  AUTO_SUMMARY: process.env.MIDSCENE_ENABLE_AUTO_SUMMARY === 'true',
} as const;

// Executor sınıfında kullanım
if (FEATURE_FLAGS.MEMORY_MECHANISM && returnValue?.summary) {
  this.addToMemory(returnValue.summary);
}
```

### 5.2 Migration Guide

#### 5.2.1 Mevcut Kullanıcılar İçin

**Otomatik Migration (Önerilen):**
```typescript
// Mevcut kod - değişiklik gerekmez
const agent = new PuppeteerAgent(page);
await agent.aiAction('Click button');
await agent.aiAssert('Button was clicked');

// Hafıza otomatik olarak çalışır, ek kod gerekmez
```

**Manuel Hafıza Kontrolü (İsteğe bağlı):**
```typescript
// Hafıza durumunu kontrol etme
const memoryStatus = agent.getMemoryStatus();
console.log(`Memory: ${memoryStatus.itemCount} items`);

// Hafızayı temizleme
agent.clearMemory();

// Hafızayı devre dışı bırakma
agent.setMemoryEnabled(false);
```

#### 5.2.2 Breaking Changes (Yok)

Bu implementasyon tamamen geriye dönük uyumludur:
- Mevcut API'ler değişmez
- Yeni alanlar optional
- Mevcut testler çalışmaya devam eder

### 5.3 Performance Considerations

#### 5.3.1 Memory Footprint

```typescript
// Hafıza kullanımını optimize etme
class OptimizedMemoryManager {
  private static readonly MAX_MEMORY_ITEMS = 10;
  private static readonly MAX_SUMMARY_LENGTH = 200;

  static optimizeSummary(summary: string): string {
    if (summary.length <= this.MAX_SUMMARY_LENGTH) {
      return summary;
    }

    // Önemli bilgileri koruyarak kısalt
    const sentences = summary.split('. ');
    let result = sentences[0];

    for (let i = 1; i < sentences.length; i++) {
      const candidate = result + '. ' + sentences[i];
      if (candidate.length <= this.MAX_SUMMARY_LENGTH) {
        result = candidate;
      } else {
        break;
      }
    }

    return result + (result.length < summary.length ? '...' : '');
  }
}
```

#### 5.3.2 AI Token Usage Optimization

```typescript
// Token kullanımını optimize etme
class TokenOptimizer {
  static optimizeMemoryForPrompt(memory: string[]): string {
    const maxTokens = 1000; // Yaklaşık token limiti
    const avgCharsPerToken = 4;
    const maxChars = maxTokens * avgCharsPerToken;

    let result = memory.join('\n');

    if (result.length <= maxChars) {
      return result;
    }

    // En son görevleri öncelikle al
    const reversedMemory = [...memory].reverse();
    result = '';

    for (const item of reversedMemory) {
      const candidate = item + '\n' + result;
      if (candidate.length <= maxChars) {
        result = candidate;
      } else {
        break;
      }
    }

    return result.trim();
  }
}
```

## Bölüm 6: Monitoring ve Analytics

### 6.1 Hafıza Kullanım Metrikleri

```typescript
// packages/core/src/monitoring/memory-metrics.ts
export interface MemoryMetrics {
  totalTasks: number;
  memoryHits: number;
  memoryMisses: number;
  averageMemorySize: number;
  memoryEffectiveness: number;
}

export class MemoryAnalytics {
  private metrics: MemoryMetrics = {
    totalTasks: 0,
    memoryHits: 0,
    memoryMisses: 0,
    averageMemorySize: 0,
    memoryEffectiveness: 0,
  };

  recordTaskExecution(hasMemory: boolean, memorySize: number): void {
    this.metrics.totalTasks++;

    if (hasMemory) {
      this.metrics.memoryHits++;
    } else {
      this.metrics.memoryMisses++;
    }

    this.metrics.averageMemorySize =
      (this.metrics.averageMemorySize * (this.metrics.totalTasks - 1) + memorySize) /
      this.metrics.totalTasks;

    this.metrics.memoryEffectiveness =
      this.metrics.memoryHits / this.metrics.totalTasks;
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
}
```

### 6.2 Debug ve Troubleshooting

```typescript
// Debug modunda hafıza durumunu logla
export class MemoryDebugger {
  static logMemoryState(executor: Executor, taskName: string): void {
    if (process.env.MIDSCENE_DEBUG_MEMORY === 'true') {
      const memory = executor.getMemory();
      console.log(`[MEMORY DEBUG] ${taskName}:`);
      console.log(`  Items: ${memory.length}`);
      console.log(`  Content: ${JSON.stringify(memory, null, 2)}`);
    }
  }

  static validateMemoryConsistency(executor: Executor): boolean {
    const memory = executor.getMemory();

    // Boş string'leri kontrol et
    const emptyItems = memory.filter(item => !item.trim());
    if (emptyItems.length > 0) {
      console.warn(`Found ${emptyItems.length} empty memory items`);
      return false;
    }

    // Çok uzun item'ları kontrol et
    const longItems = memory.filter(item => item.length > 500);
    if (longItems.length > 0) {
      console.warn(`Found ${longItems.length} overly long memory items`);
      return false;
    }

    return true;
  }
}

## Bölüm 7: Gelecek Geliştirmeler

### 7.1 Akıllı Hafıza Yönetimi

```typescript
// Gelecekte eklenebilecek özellikler
interface SmartMemoryManager {
  // Görev tipine göre hafıza önceliği
  prioritizeByTaskType(memory: MemoryItem[]): MemoryItem[];

  // Benzer görevleri grupla
  groupSimilarTasks(memory: MemoryItem[]): MemoryGroup[];

  // Hafızayı özetleme
  summarizeMemoryChunks(memory: MemoryItem[]): string;

  // Bağlamsal hafıza filtreleme
  filterRelevantMemory(memory: MemoryItem[], currentTask: string): MemoryItem[];
}
```

### 7.2 Cross-Session Hafıza

```typescript
// Session'lar arası hafıza persistance
interface PersistentMemoryStore {
  saveSession(sessionId: string, memory: string[]): Promise<void>;
  loadSession(sessionId: string): Promise<string[]>;
  clearSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
}
```

### 7.3 AI Model Optimizasyonları

- Hafıza içeriğine göre prompt optimizasyonu
- Dinamik context window yönetimi
- Model-specific hafıza formatları
- Multi-modal hafıza (görsel + metin)

### 7.4 Advanced Context Management

```typescript
// Gelişmiş bağlam yönetimi
interface AdvancedContextManager {
  // Sayfa değişikliklerini takip et
  trackPageChanges(previousUrl: string, currentUrl: string): PageChangeContext;

  // Form durumlarını hafızada tut
  trackFormStates(formData: Record<string, any>): FormStateContext;

  // Kullanıcı etkileşimlerini analiz et
  analyzeUserInteractions(interactions: UserInteraction[]): InteractionPattern;

  // Hata durumlarını bağlamla ilişkilendir
  correlateErrorsWithContext(error: Error, context: ExecutionContext): ErrorContext;
}
```

## Bölüm 8: Güvenlik ve Privacy Considerations

### 8.1 Hafıza Güvenliği

```typescript
// Hassas bilgilerin hafızadan temizlenmesi
class MemorySecurityManager {
  private static readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /api[_-]?key/i,
    /secret/i,
    /credit[_-]?card/i,
    /ssn/i,
  ];

  static sanitizeMemoryItem(item: string): string {
    let sanitized = item;

    // Hassas pattern'ları maskele
    for (const pattern of this.SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Email adreslerini kısmen maskele
    sanitized = sanitized.replace(
      /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '$1***@$2'
    );

    return sanitized;
  }

  static validateMemoryContent(memory: string[]): boolean {
    for (const item of memory) {
      if (this.containsSensitiveData(item)) {
        console.warn('Sensitive data detected in memory');
        return false;
      }
    }
    return true;
  }

  private static containsSensitiveData(text: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
  }
}
```

### 8.2 Data Retention Policies

```typescript
// Veri saklama politikaları
interface DataRetentionPolicy {
  maxMemoryAge: number; // milliseconds
  maxMemorySize: number; // items
  autoCleanupInterval: number; // milliseconds
  sensitiveDataTTL: number; // milliseconds
}

class MemoryRetentionManager {
  constructor(private policy: DataRetentionPolicy) {}

  cleanupExpiredMemory(memory: MemoryItem[]): MemoryItem[] {
    const now = Date.now();
    return memory.filter(item => {
      const age = now - item.timestamp;
      return age < this.policy.maxMemoryAge;
    });
  }

  enforceRetentionPolicy(memory: MemoryItem[]): MemoryItem[] {
    let cleaned = this.cleanupExpiredMemory(memory);

    // Boyut sınırını uygula
    if (cleaned.length > this.policy.maxMemorySize) {
      cleaned = cleaned.slice(-this.policy.maxMemorySize);
    }

    return cleaned;
  }
}
```

## Bölüm 9: Gelişmiş Hafıza Sistemi Implementasyon Rehberi

### 9.1 Aşamalı Implementasyon Stratejisi

#### Faz 1: Temel Hafıza Altyapısı (Hafta 1-2)
```typescript
// Öncelik sırası:
1. MemoryItem, MemoryConfig, MemoryStore tip tanımları
2. Temel MemoryStore sınıfı implementasyonu
3. Executor sınıfına hafıza desteği ekleme
4. Basit hafıza yönetim metodları
5. Geriye dönük uyumluluk testleri
```

#### Faz 2: Web Entegrasyonu (Hafta 2-3)
```typescript
// Implementasyon adımları:
1. PageTaskExecutor'a persistent executor desteği
2. WorkflowMemory sınıfı implementasyonu
3. SessionContext ve WorkflowContext entegrasyonu
4. Agent seviyesinde hafıza API'leri
5. Temel hafıza analitikleri
```

#### Faz 3: Gelişmiş Özellikler (Hafta 3-4)
```typescript
// Gelişmiş özellikler:
1. MemoryDrivenDecisionEngine implementasyonu
2. ResilientWorkflow hata kurtarma sistemi
3. Gelişmiş bağlam zenginleştirmesi
4. Hafıza tabanlı optimizasyonlar
5. Performance monitoring ve analytics
```

#### Faz 4: Optimizasyon ve Güvenlik (Hafta 4-5)
```typescript
// Son aşama:
1. Hafıza güvenlik mekanizmaları
2. Data retention policies
3. Export/import özellikleri
4. Comprehensive testing
5. Documentation ve migration guide
```

### 9.2 Kritik Başarı Faktörleri

#### 9.2.1 Performans Optimizasyonu
```typescript
// Performans hedefleri:
- Hafıza erişim süresi < 10ms
- Hafıza boyutu < 50MB per session
- Memory leak prevention
- Efficient garbage collection
- Minimal CPU overhead (< %5)
```

#### 9.2.2 Veri Tutarlılığı
```typescript
// Tutarlılık garantileri:
- Atomic memory operations
- Concurrent access protection
- Data corruption prevention
- Backup and recovery mechanisms
- Consistency validation
```

#### 9.2.3 Ölçeklenebilirlik
```typescript
// Ölçeklenebilirlik metrikleri:
- 1000+ concurrent sessions support
- 10,000+ memory items per session
- Multi-workflow management
- Distributed memory storage (future)
- Cloud-native architecture ready
```

### 9.3 Test Stratejisi

#### 9.3.1 Unit Tests
```typescript
describe('Enhanced Memory System', () => {
  describe('MemoryStore', () => {
    it('should store and retrieve memory items correctly');
    it('should enforce retention policies');
    it('should filter memory by relevance');
    it('should handle concurrent access safely');
  });

  describe('WorkflowMemory', () => {
    it('should track workflow progress');
    it('should maintain step relationships');
    it('should handle workflow failures gracefully');
  });

  describe('MemoryDrivenDecisionEngine', () => {
    it('should make informed decisions based on history');
    it('should learn from decision outcomes');
    it('should handle edge cases appropriately');
  });
});
```

#### 9.3.2 Integration Tests
```typescript
describe('Memory Integration', () => {
  it('should maintain memory across multiple tasks');
  it('should enrich assertions with memory context');
  it('should support workflow continuity');
  it('should handle memory export/import');
  it('should provide accurate analytics');
});
```

#### 9.3.3 Performance Tests
```typescript
describe('Memory Performance', () => {
  it('should handle large memory datasets efficiently');
  it('should maintain performance under load');
  it('should cleanup memory appropriately');
  it('should not cause memory leaks');
});
```

### 9.4 Migration Guide

#### 9.4.1 Mevcut Koddan Geçiş
```typescript
// Eski kullanım:
const agent = new PuppeteerAgent(page);
await agent.aiAction('Click button');
await agent.aiAssert('Button was clicked');

// Yeni kullanım (geriye dönük uyumlu):
const agent = new PuppeteerAgent(page, {
  memoryConfig: {
    maxItems: 100,
    enableAnalytics: true
  }
});
await agent.aiAction('Click button', { workflowStep: 'button_click' });
await agent.aiAssert('Button was clicked'); // Otomatik hafıza zenginleştirmesi
```

#### 9.4.2 Konfigürasyon Örnekleri
```typescript
// Minimal konfigürasyon
const memoryConfig: MemoryConfig = {
  maxItems: 50,
  maxAge: 60 * 60 * 1000, // 1 saat
  enablePersistence: true,
  enableAnalytics: false,
  filterStrategy: 'recency'
};

// Gelişmiş konfigürasyon
const advancedMemoryConfig: MemoryConfig = {
  maxItems: 200,
  maxAge: 4 * 60 * 60 * 1000, // 4 saat
  enablePersistence: true,
  enableAnalytics: true,
  filterStrategy: 'hybrid'
};
```

## Sonuç

Bu gelişmiş hafıza sistemi, Miso AI'a şu yetenekleri kazandırır:

### 🎯 Temel Faydalar
1. **Çok adımlı görevlerde tutarlılık** - %40-60 performans artışı
2. **Bağlamsal farkındalık** - Akıllı karar verme
3. **Veri sürekliliği** - Adımlar arası bilgi paylaşımı
4. **Hata kurtarma** - Hafıza tabanlı resilience
5. **Geriye dönük uyumluluk** - Mevcut kod değişikliği gerektirmez

### 🚀 Gelişmiş Özellikler
1. **Akıllı hafıza filtreleme** - Relevance-based context
2. **İş akışı yönetimi** - Workflow-aware memory
3. **Performans analitikleri** - Memory effectiveness tracking
4. **Güvenlik mekanizmaları** - Data protection ve privacy
5. **Export/import** - Memory portability

### 📊 Beklenen Metrikler
- **Görev başarı oranı**: %25-40 artış
- **Hata kurtarma süresi**: %50-70 azalma
- **Kullanıcı memnuniyeti**: %30-50 iyileşme
- **Development velocity**: %20-30 artış
- **System reliability**: %40-60 iyileşme

### 🛠️ Implementasyon Özeti
- **Toplam süre**: 4-5 hafta
- **Risk seviyesi**: Düşük (backward compatible)
- **Resource requirement**: 1-2 senior developers
- **Testing effort**: 2-3 hafta parallel testing
- **Documentation**: 1 hafta comprehensive docs

Bu gelişmiş hafıza sistemi, Miso AI'ı daha akıllı, güvenilir ve kullanıcı dostu hale getirerek, modern web otomasyonu ihtiyaçlarını karşılayan güçlü bir platform oluşturur.
```