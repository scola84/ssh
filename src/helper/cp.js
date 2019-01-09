import { readFileSync } from 'fs';
import sprintf from 'sprintf-js';

export default function copy(source, target, options = {}) {
  if (options.remote === true) {
    return `cp ${source} ${target}`;
  }

  source = String(readFileSync(source));
  source = source.replace(/"/g, '\\"');
  source = source.replace(/\$/g, '\\$');
  source = sprintf.sprintf(source, options);

  return `echo "${source}" | tee ${target}`;
}
