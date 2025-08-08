import { imageInfoOfBase64 } from '@/image/index';
import type { BaseElement, ElementTreeNode, Size, UIContext } from '@/types';
import { NodeType } from 'rfi-ai-shared/constants';
import { vlLocateMode } from 'rfi-ai-shared/env';
import {
  descriptionOfTree,
  generateElementByPosition,
  treeToList,
} from 'rfi-ai-shared/extractor';
// Temporary inline implementation until build system is fixed
// import { treeToEmmetify, getEmmetifyStats } from 'rfi-ai-shared/extractor';
import { assert } from 'rfi-ai-shared/utils';

// Inline Emmetify implementation for token-efficient DOM
function treeToEmmetify(tree: ElementTreeNode<BaseElement>, options: any = {}): string {
  function isVisible(node: BaseElement): boolean {
    return node.rect && node.rect.width > 0 && node.rect.height > 0 && node.isVisible;
  }
  
  function nodeToEmmet(node: ElementTreeNode<BaseElement>, depth = 0): string | null {
    // Handle empty nodes differently
    if (!node.node) {
      // If no node but has children, process children
      if (node.children && node.children.length > 0) {
        const childResults = node.children
          .map(c => nodeToEmmet(c, depth))
          .filter(Boolean);
        return childResults.length > 0 ? childResults.join('+') : null;
      }
      return null;
    }
    
    const attrs = node.node.attributes || {};
    let tag = attrs.htmlTagName?.replace(/[<>]/g, '') || attrs.nodeType?.replace(/\sNode$/, '').toLowerCase() || 'div';
    
    // Skip only truly unnecessary tags (keep div, span, etc.)
    if (['script', 'style', 'noscript', 'meta', 'link', 'head'].includes(tag)) return null;
    
    // Skip invisible elements - they can't be interacted with anyway
    // No exceptions - if it's not visible, don't include it
    if (options.visibleOnly && !isVisible(node.node)) return null;
    
    // Check if element has data-* attributes (important for modern apps)
    const hasDataAttrs = Object.keys(attrs).some(key => key.startsWith('data-'));
    
    let emmet = tag;
    
    // Add ID if exists
    const hasId = !!attrs.id;
    if (hasId) {
      emmet += `#${attrs.id}`;
    }
    
    // Add class only if no ID, or just first class if ID exists
    if (attrs.class) {
      const classes = attrs.class.split(' ').filter(c => c.trim());
      if (!hasId) {
        // No ID - include up to 2 classes for identification
        classes.slice(0, 2).forEach(cls => {
          if (cls && !cls.includes('__') && cls.length < 20) {
            emmet += `.${cls}`;
          }
        });
      } else {
        // Has ID - include only first short class if meaningful
        const firstClass = classes.find(cls => cls && cls.length < 15 && !cls.includes('__'));
        if (firstClass) {
          emmet += `.${firstClass}`;
        }
      }
    }
    
    // Add important attributes - ALWAYS include name and value
    const attrList: string[] = [];
    
    // Always include name attribute if exists
    if (attrs.name) attrList.push(`name=${attrs.name}`);
    
    // Always include value attribute if exists
    if (attrs.value) {
      const value = attrs.value.toString().slice(0, 30); // Limit value length
      attrList.push(`value=${value}`);
    }
    
    // Include type for inputs
    if (attrs.type && tag === 'input') attrList.push(`type=${attrs.type}`);
    
    // Include href for links (shortened)
    if (attrs.href && tag === 'a') {
      const href = attrs.href.length > 25 ? attrs.href.slice(0, 25) + '...' : attrs.href;
      attrList.push(`href=${href}`);
    }
    
    // Include placeholder for inputs
    if (attrs.placeholder) {
      const placeholder = attrs.placeholder.slice(0, 20);
      attrList.push(`placeholder=${placeholder}`);
    }
    
    // Include role and aria-label for accessibility
    if (attrs.role) attrList.push(`role=${attrs.role}`);
    if (attrs['aria-label']) attrList.push(`aria-label=${attrs['aria-label'].slice(0, 30)}`);
    if (attrs['aria-describedby']) attrList.push(`aria-describedby=${attrs['aria-describedby']}`);
    if (attrs['aria-controls']) attrList.push(`aria-controls=${attrs['aria-controls']}`);
    
    // Include ALL data-* attributes (very important for modern apps)
    Object.keys(attrs).forEach(key => {
      if (key.startsWith('data-')) {
        const value = attrs[key];
        if (value && value.length < 50) { // Limit length to save tokens
          attrList.push(`${key}=${value}`);
        }
      }
    });
    
    // Include markerId only if no real ID exists (to save tokens)
    if (node.node.indexId && !hasId) {
      attrList.push(`mid=${node.node.indexId}`);
    }
    
    // Always include rect for positioning
    if (options.includeRect && node.node.rect) {
      const { left, top, width, height } = node.node.rect;
      attrList.push(`rect=${left},${top},${width},${height}`);
    }
    
    if (attrList.length > 0) {
      emmet += `[${attrList.join(' ')}]`;
    }
    
    // Add text content (shorter if element has ID)
    if (node.node.content?.trim()) {
      const maxLength = hasId ? 30 : 50; // Shorter text if ID exists
      let text = node.node.content.trim();
      
      // Skip adding text if it's just numbers or very short
      if (text.length > 2 || isNaN(Number(text))) {
        text = text.slice(0, maxLength);
        if (text.length === maxLength) text += '...';
        emmet += `{${text}}`;
      }
    }
    
    // Process children
    const children = (node.children || [])
      .map(c => nodeToEmmet(c, depth + 1))
      .filter(Boolean);
    
    if (children.length > 0) {
      emmet += '>' + (children.length === 1 ? children[0] : `(${children.join('+')})`);
    }
    
    return emmet;
  }
  
  return nodeToEmmet(tree) || '';
}

function getEmmetifyStats(original: string, emmet: string) {
  const originalLength = original.length;
  const emmetLength = emmet.length;
  const reduction = originalLength - emmetLength;
  const percentReduction = Math.round((reduction / originalLength) * 100);
  return { originalLength, emmetLength, reduction, percentReduction };
}

export function describeSize(size: Size) {
  return `${size.width} x ${size.height}`;
}

export function describeElement(
  elements: (Pick<BaseElement, 'rect' | 'content'> & { id: string })[],
) {
  const sliceLength = 80;
  return elements
    .map((item) =>
      [
        item.id,
        item.rect.left,
        item.rect.top,
        item.rect.left + item.rect.width,
        item.rect.top + item.rect.height,
        item.content.length > sliceLength
          ? `${item.content.slice(0, sliceLength)}...`
          : item.content,
      ].join(', '),
    )
    .join('\n');
}
export const distanceThreshold = 16;

export function elementByPositionWithElementInfo(
  treeRoot: ElementTreeNode<BaseElement>,
  position: {
    x: number;
    y: number;
  },
  options?: {
    requireStrictDistance?: boolean;
    filterPositionElements?: boolean;
  },
) {
  const requireStrictDistance = options?.requireStrictDistance ?? true;
  const filterPositionElements = options?.filterPositionElements ?? false;

  assert(typeof position !== 'undefined', 'position is required for query');

  const matchingElements: BaseElement[] = [];

  function dfs(node: ElementTreeNode<BaseElement>) {
    if (node?.node) {
      const item = node.node;
      if (
        item.rect.left <= position.x &&
        position.x <= item.rect.left + item.rect.width &&
        item.rect.top <= position.y &&
        position.y <= item.rect.top + item.rect.height
      ) {
        if (
          !(
            filterPositionElements &&
            item.attributes?.nodeType === NodeType.POSITION
          ) &&
          item.isVisible
        ) {
          matchingElements.push(item);
        }
      }
    }

    for (const child of node.children) {
      dfs(child);
    }
  }

  dfs(treeRoot);

  if (matchingElements.length === 0) {
    return undefined;
  }

  // Find the smallest element by area
  const element = matchingElements.reduce((smallest, current) => {
    const smallestArea = smallest.rect.width * smallest.rect.height;
    const currentArea = current.rect.width * current.rect.height;
    return currentArea < smallestArea ? current : smallest;
  });

  const distanceToCenter = distance(
    { x: element.center[0], y: element.center[1] },
    position,
  );

  if (requireStrictDistance) {
    return distanceToCenter <= distanceThreshold ? element : undefined;
  }

  return element;
}

export function distance(
  point1: { x: number; y: number },
  point2: { x: number; y: number },
) {
  return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
}

export const samplePageDescription = `
And the page is described as follows:
====================
The size of the page: 1280 x 720
Some of the elements are marked with a rectangle in the screenshot corresponding to the markerId, some are not.

Description of all the elements in screenshot:
<div id="969f1637" markerId="1" left="100" top="100" width="100" height="100"> // The markerId indicated by the rectangle label in the screenshot
  <h4 id="b211ecb2" markerId="5" left="150" top="150" width="90" height="60">
    The username is accepted
  </h4>
  ...many more
</div>
====================
`;

export async function describeUserPage<
  ElementType extends BaseElement = BaseElement,
>(
  context: Omit<UIContext<ElementType>, 'describer'>,
  opt?: {
    truncateTextLength?: number;
    filterNonTextContent?: boolean;
    domIncluded?: boolean | 'visible-only';
    visibleOnly?: boolean;
  },
) {
  const { screenshotBase64 } = context;
  let width: number;
  let height: number;

  if (context.size) {
    ({ width, height } = context.size);
  } else {
    const imgSize = await imageInfoOfBase64(screenshotBase64);
    ({ width, height } = imgSize);
  }

  const treeRoot = context.tree;
  // dfs tree, save the id and element info
  const idElementMap: Record<string, ElementType> = {};
  const flatElements: ElementType[] = treeToList(treeRoot);

  if (opt?.domIncluded === true && flatElements.length >= 5000) {
    console.warn(
      'The number of elements is too large, it may cause the prompt to be too long, please use domIncluded: "visible-only" to reduce the number of elements',
    );
  }

  flatElements.forEach((element) => {
    idElementMap[element.id] = element;
    if (typeof element.indexId !== 'undefined') {
      idElementMap[`${element.indexId}`] = element;
    }
  });

  let pageDescription = '';
  const visibleOnly = opt?.visibleOnly ?? opt?.domIncluded === 'visible-only';
  // Include DOM structure based on configuration:
  // - Always for VL models (hybrid mode) - this is critical for bbox accuracy
  // - When explicitly requested via domIncluded option
  // - For non-VL modes, include by default unless domIncluded is explicitly false
  const isVLMode = vlLocateMode();
  // Fix: If opt is undefined, domIncluded should be considered as undefined (not false)
  // VL models always need DOM, others need it unless explicitly disabled
  const shouldIncludeDom = isVLMode || (opt?.domIncluded !== false && opt !== undefined) || (opt === undefined && !isVLMode);
  
  // Simpler fix: VL models always get DOM, others get it unless explicitly disabled
  const includeDOM = isVLMode ? true : opt?.domIncluded !== false;
  
  if (includeDOM) {
    // Use Emmetify format for ALL models to dramatically reduce token usage
    const useEmmetFormat = true; // Enable for all models - both VL and non-VL
    
    if (useEmmetFormat) {
      // Use compact Emmetify format for token efficiency
      const emmetTree = treeToEmmetify(treeRoot, {
        includeRect: true, // Include rect for bbox coordinates
        maxTextLength: 50, // Limit text to save tokens
        visibleOnly: true, // Filter invisible elements (width/height = 0)
        includeDataAttrs: true // Include data-* attributes for better identification
      });
      
      // Debug: Check what we got from Emmetify (comment out for production)
      // console.error(`[DOM-EMMET-DEBUG] Emmet tree result: ${emmetTree ? emmetTree.substring(0, 200) : 'EMPTY'}`);
      // console.error(`[DOM-EMMET-DEBUG] TreeRoot has children: ${treeRoot.children?.length || 0}`);
      // console.error(`[DOM-EMMET-DEBUG] TreeRoot has node: ${!!treeRoot.node}`);
      
      const sizeDescription = describeSize({ width, height });
      pageDescription = `Page: ${sizeDescription}\nDOM: ${emmetTree}`;
      
      // Log statistics for debugging
      // For comparison, get the old format size
      const oldTree = await descriptionOfTree(
        treeRoot,
        opt?.truncateTextLength,
        opt?.filterNonTextContent,
        visibleOnly,
      );
      const stats = getEmmetifyStats(oldTree, emmetTree);
      
      const modelType = isVLMode ? `VL model: ${isVLMode}` : 'Non-VL model';
      console.error(`[DOM-EMMET] Using Emmetify format for ${modelType}`);
      console.error(`[DOM-EMMET] Token reduction: ${stats.percentReduction}% (${stats.originalLength} -> ${stats.emmetLength} chars)`);
      console.error(`[DOM-EMMET] Elements count: ${flatElements.length} (filtered visible only)`);
      console.error(`[DOM-EMMET] Compact DOM format active`);
    } else {
      // Use traditional format for non-VL models
      const contentTree = await descriptionOfTree(
        treeRoot,
        opt?.truncateTextLength,
        opt?.filterNonTextContent,
        visibleOnly,
      );

      const sizeDescription = describeSize({ width, height });
      pageDescription = `The size of the page: ${sizeDescription} \n The page elements tree:\n${contentTree}`;
    }
  }

  return {
    description: pageDescription,
    elementById(idOrIndexId: string) {
      assert(typeof idOrIndexId !== 'undefined', 'id is required for query');
      const item = idElementMap[`${idOrIndexId}`];
      return item;
    },
    elementByPosition(
      position: { x: number; y: number },
      size: { width: number; height: number },
    ) {
      return elementByPositionWithElementInfo(treeRoot, position);
    },
    insertElementByPosition(position: { x: number; y: number }) {
      const element = generateElementByPosition(position) as ElementType;

      treeRoot.children.push({
        node: element,
        children: [],
      });
      flatElements.push(element);
      idElementMap[element.id] = element;
      return element;
    },
    size: { width, height },
  };
}
