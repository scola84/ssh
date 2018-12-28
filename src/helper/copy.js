import { readFileSync } from 'fs';
import sprintf from 'sprintf-js';

export default function copy(source, target, options = {}) {
  if (source[0] === '/') {
    return `cp ${source} ${target}`;
  }

  source = String(readFileSync(source));
  source = source.replace(/"/g, '\\"');
  source = source.replace(/\$/g, '\\$');
  source = sprintf.sprintf(source, options);

  return `printf "${source}" | tee ${target}`;
}
