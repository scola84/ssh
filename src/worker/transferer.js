import { execFile } from 'child_process';
import defaults from 'lodash-es/defaultsDeep';
import Connector from './connector';

export default class Transferer extends Connector {
  constructor(options = {}) {
    super(options);

    this._local = null;
    this._remote = null;

    this.setLocal(options.local);
    this.setRemote(options.remote);
  }

  setLocal(value = '') {
    this._local = value;
    return this;
  }

  setRemote(value = '') {
    this._remote = value;
    return this;
  }

  act(box, data, callback) {
    data = this.filter(box, data);
    let options = this._options;

    if (typeof options === 'function') {
      options = options(box, data);
    }

    options = defaults({
      hostname: data.ssh.client && data.ssh.client.config.host,
      key: data.ssh.client && data.ssh.client.config.key,
      port: data.ssh.client && data.ssh.client.config.port,
      username: data.ssh.client && data.ssh.client.config.username
    }, options);

    let local = this._local;

    if (typeof local === 'function') {
      local = local(box, data);
    }

    let remote = this._remote;

    if (typeof remote === 'function') {
      remote = remote(box, data);
    }

    const args = [
      '-i',
      options.key,
      '-P',
      options.port,
      local,
      `${options.username}@${options.hostname}:${remote}`
    ];

    execFile('scp', args, (error, result) => {
      if (error) {
        this._error(box, data, callback, error);
        return;
      }

      data = this.merge(box, data, result);

      this._logDescription(box, data, true);
      this.pass(box, data, callback);
    });
  }
}
