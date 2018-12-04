export default function chown(file, user, group) {
  return `chown ${user}:${group} ${file}`;
}
