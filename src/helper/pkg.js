export default function pkg(action, name) {
  return `DEBIAN_FRONTEND=noninteractive apt-get -yq ${action} ${name}`;
}
