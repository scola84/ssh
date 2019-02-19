export default function key(id, server = 'keyserver.ubuntu.com') {
  return `DEBIAN_FRONTEND=noninteractive apt-key adv --keyserver ${server} --recv-keys ${id}`;
}
