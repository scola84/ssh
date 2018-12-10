export default function ufw({ port, act = 'allow', dir = 'in', on = 'eth0', proto = 'tcp', from = 'any', to = 'any' }) {
  return `ufw ${act} ${dir} on ${on} from ${from} to ${to} port ${port} proto ${proto}`;
}
