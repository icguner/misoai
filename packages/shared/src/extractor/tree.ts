import type { BaseElement, ElementTreeNode } from '../types';

export function truncateText(
  text: string | number | object | undefined,
  maxLength = 150,
) {
  if (typeof text === 'undefined') {
    return '';
  }

  if (typeof text === 'object') {
    text = JSON.stringify(text);
  }

  if (typeof text === 'number') {
    return text.toString();
  }

  if (typeof text === 'string' && text.length > maxLength) {
    return `${text.slice(0, maxLength)}...`;
  }

  if (typeof text === 'string') {
    return text.trim();
  }

  return '';
}

export function trimAttributes(
  attributes: Record<string, any>,
  truncateTextLength?: number,
) {
  const tailorAttributes = Object.keys(attributes).reduce(
    (res, currentKey: string) => {
      const attributeVal = (attributes as any)[currentKey];
      if (
        currentKey === 'style' ||
        currentKey === 'htmlTagName' ||
        currentKey === 'nodeType'
      ) {
        return res;
      }

      res[currentKey] = truncateText(attributeVal, truncateTextLength);
      return res;
    },
    {} as BaseElement['attributes'],
  );
  return tailorAttributes;
}

const nodeSizeThreshold = 4;
export function descriptionOfTree<
  ElementType extends BaseElement = BaseElement,
>(
  tree: ElementTreeNode<ElementType>,
  truncateTextLength?: number,
  filterNonTextContent = false,
  visibleOnly = true,
) {
  const attributesString = (kv: Record<string, any>) => {
    return Object.entries(kv)
      .map(
        ([key, value]) => `${key}="${truncateText(value, truncateTextLength)}"`,
      )
      .join(' ');
  };

  function buildContentTree(
    node: ElementTreeNode<ElementType>,
    indent = 0,
    visibleOnly = true,
  ): string {
    let before = '';
    let contentWithIndent = '';
    let after = '';
    let emptyNode = true;
    const indentStr = '  '.repeat(indent);

    let children = '';
    for (let i = 0; i < (node.children || []).length; i++) {
      const childContent = buildContentTree(
        node.children[i],
        indent + 1,
        visibleOnly,
      );
      if (childContent) {
        children += `\n${childContent}`;
      }
    }

    if (
      node.node &&
      node.node.rect.width > nodeSizeThreshold &&
      node.node.rect.height > nodeSizeThreshold &&
      (!filterNonTextContent || (filterNonTextContent && node.node.content)) &&
      (!visibleOnly || (visibleOnly && node.node.isVisible))
    ) {
      emptyNode = false;
      let nodeTypeString: string;
      if (node.node.attributes?.htmlTagName) {
        nodeTypeString = node.node.attributes.htmlTagName.replace(/[<>]/g, '');
      } else {
        nodeTypeString = node.node.attributes.nodeType
          .replace(/\sNode$/, '')
          .toLowerCase();
      }
      const markerId = node.node.indexId;
      const markerIdString = markerId ? `markerId="${markerId}"` : '';
      const rectAttribute = node.node.rect
        ? {
            left: node.node.rect.left,
            top: node.node.rect.top,
            width: node.node.rect.width,
            height: node.node.rect.height,
          }
        : {};
      // Extract real ID and data-* attributes for better element identification
      const attributes = node.node.attributes || {};
      const realId = attributes.id;
      const idString = realId ? `id="${realId}"` : `id="${node.node.id}"`;
      
      // Separate data-* attributes for prominence in DOM output
      const dataAttributes: Record<string, any> = {};
      const regularAttributes: Record<string, any> = {};
      
      Object.entries(attributes).forEach(([key, value]) => {
        if (key.startsWith('data-')) {
          dataAttributes[key] = value;
        } else if (key !== 'id') { // Skip id as we handle it separately
          regularAttributes[key] = value;
        }
      });
      
      const dataAttrsString = Object.keys(dataAttributes).length > 0 
        ? attributesString(trimAttributes(dataAttributes, truncateTextLength)) 
        : '';
      
      before = `<${nodeTypeString} ${idString} ${markerIdString} ${dataAttrsString} ${attributesString(trimAttributes(regularAttributes, truncateTextLength))} ${attributesString(rectAttribute)}>`;
      const content = truncateText(node.node.content, truncateTextLength);
      contentWithIndent = content ? `\n${indentStr}  ${content}` : '';
      after = `</${nodeTypeString}>`;
    } else if (!filterNonTextContent) {
      if (!children.trim().startsWith('<>')) {
        before = '<>';
        contentWithIndent = '';
        after = '</>';
      }
    }

    if (emptyNode && !children.trim()) {
      return '';
    }

    const result = `${indentStr}${before}${contentWithIndent}${children}\n${indentStr}${after}`;
    if (result.trim()) {
      return result;
    }
    return '';
  }

  const result = buildContentTree(tree, 0, visibleOnly);
  return result.replace(/^\s*\n/gm, '');
}

export function treeToList<T extends BaseElement>(
  tree: ElementTreeNode<T>,
): T[] {
  const result: T[] = [];
  function dfs(node: ElementTreeNode<T>) {
    if (node.node) {
      result.push(node.node);
    }
    for (const child of node.children) {
      dfs(child);
    }
  }
  dfs(tree);
  return result;
}

export function traverseTree<
  T extends BaseElement,
  ReturnNodeType extends BaseElement,
>(
  tree: ElementTreeNode<T>,
  onNode: (node: T) => ReturnNodeType,
): ElementTreeNode<ReturnNodeType> {
  function dfs(node: ElementTreeNode<T>) {
    if (node.node) {
      node.node = onNode(node.node) as any;
    }
    for (const child of node.children) {
      dfs(child);
    }
  }
  dfs(tree);
  return tree as any;
}

/**
 * Emmetify format functions for token-efficient LLM processing
 */

interface EmmetifyOptions {
  includeRect?: boolean;
  maxTextLength?: number;
  visibleOnly?: boolean;
  includeDataAttrs?: boolean;
}

function isElementVisible(node: BaseElement): boolean {
  if (!node.rect) return false;
  
  // Check if element has 'hidden' in class name
  const classList = node.attributes?.class || '';
  if (classList.toLowerCase().includes('hidden')) {
    // Exception for dropdown indicators that show visible state
    if (!classList.includes('--show') && 
        !classList.includes('--open') && 
        !classList.includes('--visible') &&
        !classList.includes('--active')) {
      return false;
    }
  }
  
  // Also check for common hide patterns (but allow dropdown states)
  if ((classList.includes('--hide') || 
       classList.includes('display-none') || 
       classList.includes('d-none') ||
       classList.includes('invisible') ||
       classList.includes('collapsed')) &&
      !classList.includes('--show') &&
      !classList.includes('--open') &&
      !classList.includes('--visible')) {
    return false;
  }
  
  // Check style attribute for display:none or visibility:hidden
  const style = node.attributes?.style || '';
  if (style.includes('display:none') || 
      style.includes('display: none') ||
      style.includes('visibility:hidden') ||
      style.includes('visibility: hidden')) {
    return false;
  }
  
  return node.rect.width > 0 && node.rect.height > 0 && node.isVisible;
}

function attributesToEmmet(
  node: BaseElement,
  options: EmmetifyOptions
): string {
  const parts: string[] = [];
  const attrs = node.attributes || {};
  const hasId = !!attrs.id;
  
  // Add ID if exists
  if (hasId) {
    parts.push(`#${attrs.id}`);
  }
  
  // Add class conditionally based on ID presence
  if (attrs.class) {
    const classes = attrs.class.split(' ').filter(c => c.trim());
    
    // Always include dropdown/autocomplete indicator classes
    const dropdownClasses = classes.filter(cls => 
      cls.includes('dropdown') || 
      cls.includes('suggestion') || 
      cls.includes('autocomplete') ||
      cls.includes('list-item') ||
      cls.includes('--show') ||
      cls.includes('--open') ||
      cls.includes('--visible') ||
      cls.includes('--active') ||
      cls.includes('--selected')
    );
    
    if (dropdownClasses.length > 0) {
      dropdownClasses.slice(0, 2).forEach(cls => {
        parts.push(`.${cls}`);
      });
    } else if (!hasId) {
      // No ID - include up to 2 classes for identification
      classes.slice(0, 2).forEach(cls => {
        if (cls && !cls.includes('__') && cls.length < 20) {
          parts.push(`.${cls}`);
        }
      });
    } else {
      // Has ID - include only first short class if meaningful
      const firstClass = classes.find(cls => cls && cls.length < 15 && !cls.includes('__'));
      if (firstClass) {
        parts.push(`.${firstClass}`);
      }
    }
  }
  
  const importantAttrs: string[] = [];
  
  // Always include name if exists
  if (attrs.name) {
    importantAttrs.push(`name=${attrs.name}`);
  }
  
  // Always include value if exists
  if (attrs.value) {
    const value = attrs.value.toString().slice(0, 30);
    importantAttrs.push(`value=${value}`);
  }
  
  if (attrs.type && attrs.htmlTagName === 'input') {
    importantAttrs.push(`type=${attrs.type}`);
  }
  
  if (attrs.href && attrs.htmlTagName === 'a') {
    const href = attrs.href.length > 25 
      ? attrs.href.slice(0, 25) + '...' 
      : attrs.href;
    importantAttrs.push(`href=${href}`);
  }
  
  if (attrs.placeholder) {
    const placeholder = attrs.placeholder.slice(0, 20);
    importantAttrs.push(`placeholder=${placeholder}`);
  }
  
  if (attrs.role) {
    importantAttrs.push(`role=${attrs.role}`);
  }
  
  if (attrs['data-testid']) {
    importantAttrs.push(`data-testid=${attrs['data-testid']}`);
  }
  
  // Critical dropdown/autocomplete attributes
  if (attrs['data-value']) {
    importantAttrs.push(`data-value=${attrs['data-value']}`);
  }
  
  if (attrs['data-port-code']) {
    importantAttrs.push(`data-port-code=${attrs['data-port-code']}`);
  }
  
  if (attrs['data-city-code']) {
    importantAttrs.push(`data-city-code=${attrs['data-city-code']}`);
  }
  
  if (attrs['data-id']) {
    importantAttrs.push(`data-id=${attrs['data-id']}`);
  }
  
  if (attrs['onclick']) {
    // Just indicate it has onclick, don't include full handler
    importantAttrs.push(`onclick=true`);
  }
  
  if (attrs['aria-selected']) {
    importantAttrs.push(`aria-selected=${attrs['aria-selected']}`);
  }
  
  if (attrs['aria-expanded']) {
    importantAttrs.push(`aria-expanded=${attrs['aria-expanded']}`);
  }
  
  if (node.indexId) {
    importantAttrs.push(`mid=${node.indexId}`);
  }
  
  if (options.includeRect && node.rect) {
    const { left, top, width, height } = node.rect;
    importantAttrs.push(`rect=${left},${top},${width},${height}`);
  }
  
  if (importantAttrs.length > 0) {
    parts.push(`[${importantAttrs.join(' ')}]`);
  }
  
  return parts.join('');
}

function nodeToEmmet(
  node: ElementTreeNode<BaseElement>,
  options: EmmetifyOptions = {},
  depth = 0
): string | null {
  if (!node.node) {
    if (node.children && node.children.length > 0) {
      const childrenEmmet = node.children
        .map(child => nodeToEmmet(child, options, depth))
        .filter(Boolean);
      
      if (childrenEmmet.length > 0) {
        return childrenEmmet.join('+');
      }
    }
    return null;
  }
  
  if (options.visibleOnly && !isElementVisible(node.node)) {
    return null;
  }
  
  let tagName = '';
  if (node.node.attributes?.htmlTagName) {
    tagName = node.node.attributes.htmlTagName.replace(/[<>]/g, '');
  } else if (node.node.attributes?.nodeType) {
    tagName = node.node.attributes.nodeType
      .replace(/\sNode$/, '')
      .toLowerCase();
  }
  
  const skipTags = ['script', 'style', 'noscript', 'meta', 'link'];
  if (skipTags.includes(tagName)) {
    return null;
  }
  
  let emmetStr = tagName || 'div';
  const attrStr = attributesToEmmet(node.node, options);
  if (attrStr) {
    emmetStr += attrStr;
  }
  
  // Add text content (shorter if element has ID)
  if (node.node.content && node.node.content.trim()) {
    const hasId = !!node.node.attributes?.id;
    const maxLength = hasId ? 30 : (options.maxTextLength || 50);
    let text = node.node.content.trim();
    
    // Skip adding text if it's just numbers or very short
    if (text.length > 2 || isNaN(Number(text))) {
      text = truncateText(text, maxLength);
      if (text) {
        emmetStr += `{${text}}`;
      }
    }
  }
  
  if (node.children && node.children.length > 0) {
    const childrenEmmet = node.children
      .map(child => nodeToEmmet(child, options, depth + 1))
      .filter(Boolean);
    
    if (childrenEmmet.length > 0) {
      if (childrenEmmet.length === 1) {
        emmetStr += '>' + childrenEmmet[0];
      } else {
        emmetStr += '>(' + childrenEmmet.join('+') + ')';
      }
    }
  }
  
  return emmetStr;
}

export function treeToEmmetify<T extends BaseElement>(
  tree: ElementTreeNode<T>,
  options: EmmetifyOptions = {}
): string {
  const defaultOptions: EmmetifyOptions = {
    includeRect: true,
    maxTextLength: 50,
    visibleOnly: true,
    includeDataAttrs: true,
    ...options
  };
  
  const emmetStr = nodeToEmmet(tree, defaultOptions);
  return emmetStr || '';
}

export function getEmmetifyStats(
  originalTree: string,
  emmetified: string
): {
  originalLength: number;
  emmetLength: number;
  reduction: number;
  percentReduction: number;
} {
  const originalLength = originalTree.length;
  const emmetLength = emmetified.length;
  const reduction = originalLength - emmetLength;
  const percentReduction = Math.round((reduction / originalLength) * 100);
  
  return {
    originalLength,
    emmetLength,
    reduction,
    percentReduction
  };
}
