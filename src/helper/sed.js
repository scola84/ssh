import escape from 'escape-string-regexp';

export default function sed(file, pattern, replacer, section) {
  let items = Array.isArray(pattern) ? pattern : [
    [pattern, replacer, section]
  ];

  items = items.map((item) => {
    if (Array.isArray(item) === false) {
      throw new Error('Item is not an array');
    }

    let [ptn, rpl, scn] = item;

    if (typeof rpl === 'undefined') {
      rpl = ptn;
      ptn = '#\\{0,\\}' + escape(ptn);
      scn = null;
    }

    ptn = ptn.replace(/"/g, '\\\\\\"');
    ptn = ptn.replace(/\\\?/g, '[?]');
    rpl = rpl.replace(/"/g, '\\\\\\"');
    rpl = rpl.replace(/\//g, '\\\\/');

    let check = '';
    let replace = '';
    let append = '';

    if (scn) {
      const sb = `/^\\[${scn}\\]/,/^\\[/{/^\\[/b; `;
      const se = '}';

      check = `sed -n -E "/\\[${scn}\\]/,/\\[/p" ${file} | grep -E "^${ptn}$"`;
      replace = `sed -i -E "${sb}s/^${ptn}$/${rpl}/${se}" ${file}`;
      append = `sed -i -E "/\\[${scn}\\]/ a ${rpl}" ${file}`;
    } else {
      check = `grep -E "^${ptn}$" ${file}`;
      replace = `sed -i -E "s/^${ptn}$/${rpl}/" ${file}`;
      append = `sed -i -E "$ a ${rpl}" ${file}`;
    }

    return check + ' && ' + replace + ' || ' + append;
  });

  return items.join(' && ');
}
