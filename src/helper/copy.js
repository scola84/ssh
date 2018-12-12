import { readFileSync } from 'fs';
import sprintf from 'sprintf-js';

export default function copy(local, remote, object = {}) {
  local = String(readFileSync(local));
  local = local.replace(/"/g, '\\"');
  local = local.replace(/\$/g, '\\$');
  local = sprintf.sprintf(local, object);

  return `printf "${local}" | sudo tee ${remote}`;
}
