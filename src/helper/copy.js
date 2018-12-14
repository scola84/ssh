import { readFileSync } from 'fs';
import sprintf from 'sprintf-js';

export default function copy(local, remote, options = {}) {
  local = String(readFileSync(local));
  local = local.replace(/"/g, '\\"');
  local = local.replace(/\$/g, '\\$');
  local = sprintf.sprintf(local, options);

  return `printf "${local}" | tee ${remote}`;
}
