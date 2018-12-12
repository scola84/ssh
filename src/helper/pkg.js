export default function pkg(action, name = '', version = '') {
  version = version ? '=' + version : '';
  return `DEBIAN_FRONTEND=noninteractive apt-get -qq ${action} ${name}${version}`;
}
