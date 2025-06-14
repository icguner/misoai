import type {
  DetailedLocateParam,
  MidsceneYamlFlowItem,
  PlanningAction,
  PlanningActionParamInputOrKeyPress,
  PlanningActionParamScroll,
  PlanningActionParamSleep,
  PlanningActionParamTap,
  PlanningLocateParam,
} from 'misoai-core';
import { getDebug } from 'misoai-shared/logger';
import { assert } from 'misoai-shared/utils';

const debug = getDebug('plan-builder');

export function buildPlans(
  type: PlanningAction['type'],
  locateParam?: DetailedLocateParam,
  param?:
    | PlanningActionParamInputOrKeyPress
    | PlanningActionParamScroll
    | PlanningActionParamSleep,
): PlanningAction[] {
  let returnPlans: PlanningAction[] = [];
  const locatePlan: PlanningAction<PlanningLocateParam> | null = locateParam
    ? {
        type: 'Locate',
        locate: locateParam,
        param: locateParam,
        thought: '',
      }
    : null;
  if (type === 'Tap' || type === 'Hover' || type === 'RightClick') {
    assert(locateParam, `missing locate info for action "${type}"`);
    assert(locatePlan, `missing locate info for action "${type}"`);
    const tapPlan: PlanningAction<PlanningActionParamTap> = {
      type,
      param: null,
      thought: '',
      locate: locateParam,
    };

    returnPlans = [locatePlan, tapPlan];
  }
  if (type === 'Input' || type === 'KeyboardPress') {
    if (type === 'Input') {
      assert(locateParam, `missing locate info for action "${type}"`);
    }
    assert(param, `missing param for action "${type}"`);

    const inputPlan: PlanningAction<PlanningActionParamInputOrKeyPress> = {
      type,
      param: param as PlanningActionParamInputOrKeyPress,
      thought: '',
      locate: locateParam!,
    };

    if (locatePlan) {
      returnPlans = [locatePlan, inputPlan];
    } else {
      returnPlans = [inputPlan];
    }
  }

  if (type === 'Scroll') {
    assert(param, `missing param for action "${type}"`);

    const scrollPlan: PlanningAction<PlanningActionParamScroll> = {
      type,
      param: param as PlanningActionParamScroll,
      thought: '',
      locate: locateParam,
    };

    if (locatePlan) {
      returnPlans = [locatePlan, scrollPlan];
    } else {
      returnPlans = [scrollPlan];
    }
  }

  if (type === 'Sleep') {
    assert(param, `missing param for action "${type}"`);

    const sleepPlan: PlanningAction<PlanningActionParamSleep> = {
      type,
      param: param as PlanningActionParamSleep,
      thought: '',
      locate: null,
    };

    returnPlans = [sleepPlan];
  }

  if (type === 'Locate') {
    assert(locateParam, `missing locate info for action "${type}"`);
    const locatePlan: PlanningAction<PlanningLocateParam> = {
      type,
      param: locateParam as PlanningLocateParam,
      locate: locateParam,
      thought: '',
    };
    returnPlans = [locatePlan];
  }

  if (returnPlans) {
    debug('buildPlans', returnPlans);
    return returnPlans;
  }

  throw new Error(`Not supported type: ${type}`);
}
