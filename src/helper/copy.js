import { readFileSync } from 'fs';

export default function copy(local, remote) {
  return `printf "${readFileSync(local)}" | sudo tee ${remote}`;
}
