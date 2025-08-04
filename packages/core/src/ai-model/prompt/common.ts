import type { vlLocateMode } from 'rfi-ai-shared/env';
export function bboxDescription(vlMode: ReturnType<typeof vlLocateMode>) {
  if (vlMode === 'gemini') {
    return '2d bounding box as [ymin, xmin, ymax, xmax]';
  }
  if (vlMode === 'kimi-vl') {
    return '2d bounding box as [xmin, ymin, xmax, ymax] with coordinates normalized to 0-1000';
  }
  return '2d bounding box as [xmin, ymin, xmax, ymax]';
}
