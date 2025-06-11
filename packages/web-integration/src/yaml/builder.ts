import yaml from 'js-yaml';
import type {
  MidsceneYamlScript,
  MidsceneYamlScriptWebEnv,
  MidsceneYamlTask,
} from 'misoai-core';

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
