import type { StaticPageAgent } from 'rfi-ai-web/playground';
import type { WebUIContext } from 'rfi-ai-web/utils';
import { useMemo } from 'react';
import { staticAgentFromContext } from './playground-utils';

export { staticAgentFromContext };

export const useStaticPageAgent = (
  context: WebUIContext | undefined | null,
): StaticPageAgent | null => {
  const agent = useMemo(() => {
    if (!context) return null;
    return staticAgentFromContext(context);
  }, [context]);

  return agent;
};
