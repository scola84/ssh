import { readFileSync } from 'fs';
import ssh2 from 'ssh2';
import Commander from './commander';

export default class Connector extends Commander {
  constructor(options = {}) {
    super(options);

    this._connection = null;
    this.setConnection(options.connection);
  }

  setConnection(value = null) {
    this._connection = value;
    return this;
  }

  act(box, data, callback) {
    data = this.filter(box, data);

    if (data.ssh.client) {
      this._write(box, data, callback, 'exit');
    }

    if (this._connection === null) {
      this._next(box, data, callback);
    } else {
      this._connect(box, data, callback);
    }
  }

  _connect(box, data, callback) {
    const client = new ssh2.Client();

    client.once('error', (error) => {
      this._error(box, data, callback, error);
    });

    client.once('ready', () => {
      data.ssh.client = client;

      data.ssh.client.shell((error, stream) => {
        if (error) {
          this._error(box, data, callback, error);
          return;
        }

        data.ssh.stream = stream;

        data.ssh.stream.once('exit', () => {
          data.ssh.client.end();
          delete data.ssh.client;
        });

        this._bind(box, data, callback);
      });
    });

    let connection = this._connection;

    if (typeof connection === 'function') {
      connection = connection(box, data);
    }

    connection.privateKey = readFileSync(connection.key);

    client.connect(connection);
    client.config.key = connection.key;
  }
}
