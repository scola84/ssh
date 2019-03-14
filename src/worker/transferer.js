import { execFile } from 'child_process';
import Connector from './connector';

export default class Transferer extends Connector {
  constructor(options = {}) {
    super(options);

    this._client = null;
    this._local = null;
    this._remote = null;

    this.setClient(options.client);
    this.setLocal(options.local);
    this.setRemote(options.remote);
  }

  setClient(value = null) {
    this._client = value;
    return this;
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

    let client = this._client;

    if (typeof client === 'function') {
      client = client(box, data);
    }

    let local = this._local;

    if (typeof local === 'function') {
      local = local(box, data);
    }

    let remote = this._remote;

    if (typeof remote === 'function') {
      remote = remote(box, data);
    }

    remote = `${client.username}@${client.hostname}:${remote}`;

    const args = [
      '-q',
      '-o',
      'StrictHostKeyChecking=no',
      '-i',
      client.key,
      '-P',
      client.port || 22
    ];

    if (client.action === 'read') {
      args[args.length] = remote;
      args[args.length] = local;
    } else if (client.action === 'write') {
      args[args.length] = local;
      args[args.length] = remote;
    }

    execFile('scp', args, (error, result) => {
      if (error) {
        this._error(box, data, callback, error);
        return;
      }

      data = this.merge(box, data, result);

      this.log('info', box, data, callback);
      this.pass(box, data, callback);
    });
  }
}
