export default function ctl(command, name = '') {
  return `systemctl ${command} ${name}`;
}
