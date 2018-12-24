export default function chown(file, own) {
  return `chown ${own} ${file}`;
}
