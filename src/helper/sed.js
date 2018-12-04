export default function sed(file, pattern, replacer, section) {
  const items = Array.isArray(pattern) ? pattern : [
    [pattern, replacer, section]
  ];

  return items.map((item) => {
    if (Array.isArray(item) === false) {
      throw new Error('Item is not an array');
    }

    let [ptn, rpl, scn] = item;

    if (typeof rpl === 'undefined') {
      rpl = ptn;
      ptn = '#?' + ptn;
      scn = null;
    }

    let check = '';
    let replace = '';
    let append = '';

    if (scn) {
      const sb = `/^\\[${scn}\\]/,/^\\[/{/^\\[/b; `;
      const se = '}';

      check = `sed -n "/\\[${scn}\\]/,/\\[/p" ${file} | grep "^${ptn}$"`;
      replace = `sed -i "${sb}s/^${ptn}$/${rpl}/${se}" ${file}`;
      append = `sed -i "/\\[${scn}\\]/ a ${rpl}" ${file}`;
    } else {
      check = `grep "^${ptn}$" ${file}`;
      replace = `sed -i "s/^${ptn}$/${rpl}/" ${file}`;
      append = `sed -i "$ a ${rpl}" ${file}`;
    }

    return check + ' && sudo ' + replace + ' || sudo ' + append;
  });
}
