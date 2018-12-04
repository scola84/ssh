export default function chmod(file, mod) {
  return `chmod ${mod} ${file}`;
}
