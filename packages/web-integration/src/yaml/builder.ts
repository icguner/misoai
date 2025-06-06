import type {
  MidsceneYamlScript,
  MidsceneYamlScriptWebEnv,
  MidsceneYamlTask,
} from 'misoai-core';
import yaml from 'js-yaml';

export function buildYaml(
  env: MidsceneYamlScriptWebEnv,
  tasks: MidsceneYamlTask[],
) {
  const result: MidsceneYamlScript = {
    target: env,
    tasks,
  };

  return yaml.dump(result, {
    indent: 2,
  });
}
