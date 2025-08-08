# Unified Locator System Design

## 🎯 Core Principles

1. **No Model Distinction**: All models (VL/Non-VL) use the same hybrid approach
2. **DOM + Screenshot Combined**: Always analyze both sources together
3. **Puppeteer-First**: Primary output is reliable Puppeteer selectors
4. **Chain of Thought**: Detailed reasoning for transparency and accuracy
5. **Anti-Hallucination**: Clear error reporting when elements don't exist

## 📋 Unified Response Schema

```typescript
interface UnifiedLocatorResponse {
  chain_of_thought: {
    screenshot_analysis: string;      // Visual element identification
    dom_analysis: string;            // DOM structure analysis
    cross_reference: string;         // How visual + DOM were matched
    element_validation: string;      // Verification of element existence
    selector_strategy: string;       // Puppeteer selector selection logic
  };
  result: {
    found: boolean;
    element?: {
      puppeteer_selector: string;   // Primary Puppeteer selector
      fallback_selector?: string;   // Alternative selector if needed
      element_info: {
        tag: string;
        id?: string;
        classes?: string[];
        attributes: Record<string, string>;
        text_content?: string;
        coordinates: { x: number; y: number; width: number; height: number };
      };
      confidence: number;            // 0.0-1.0 confidence score
    };
    error_reason?: string;           // Why element wasn't found
  };
  debug_info?: {
    dom_elements_analyzed: number;
    visual_candidates_found: number;
    selector_alternatives: string[];
  };
}
```

## 🔄 Processing Flow

1. **Input Processing**: Receive user description + screenshot + DOM
2. **Parallel Analysis**: 
   - Screenshot visual analysis
   - DOM structure parsing
3. **Hybrid Matching**: Cross-reference findings
4. **Element Validation**: Verify element actually exists
5. **Selector Generation**: Create robust Puppeteer selectors
6. **Response Formation**: Structured output with reasoning

## 🎨 System Prompt Strategy

- Unified prompt for all models
- Emmetify DOM format explanation
- Puppeteer selector priority guide
- Anti-hallucination instructions
- Error handling guidelines

## 🔧 Implementation Areas

1. **llm-locator.ts**: New unified prompt
2. **inspect.ts**: Updated response handling
3. **types.ts**: New response interfaces
4. **agent.ts**: Simplified method handling

Should we proceed with implementing this design?