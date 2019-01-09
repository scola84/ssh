import escape from 'escape-string-regexp';

export default function sed(file, rules, options = {}) {
  rules = rules.map(([ptn, rpl, scn]) => {
    if (typeof rpl === 'undefined') {
      if (ptn[0] === '#') {
        rpl = '#\\1';
        ptn = options.escape ? escape(ptn.slice(1)) : ptn.slice(1);
        ptn = `\\s*#?(${ptn})`;
      } else {
        rpl = ptn;
        ptn = options.escape ? escape(ptn) : ptn;
        ptn = `\\s*#?${ptn}`;
      }

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
      append = rpl === '#\\1' ? '' : `sed -i -E "$ a ${rpl}" ${file}`;
    }

    return check + ' && ' + replace + (append ? ' || ' + append : '');
  });

  return rules.join(' && ');
}
