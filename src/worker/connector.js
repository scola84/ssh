import { readFileSync } from 'fs';
import ssh2 from 'ssh2';
import Commander from './commander';

export default class Connector extends Commander {
  constructor(options = {}) {
    super(options);

    this._connection = null;
    this._reconnect = null;

    this.setConnection(options.connection);
    this.setReconnect(options.reconnect);
  }

  setConnection(value = null) {
    this._connection = value;
    return this;
  }

  setReconnect(value = false) {
    this._reconnect = value;
    return this;
  }

  act(box, data, callback) {
    data = this.filter(box, data);

    if (box.client) {
      this._write(box, 'exit');
    }

    if (this._connection === null) {
      data = this.merge(box, data);
      this.pass(box, data, callback);
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
      box.client = client;

      box.client.shell((error, stream) => {
        if (error) {
          this._error(box, data, callback, error);
          return;
        }

        box.stream = stream;

        box.stream.once('exit', () => {
          box.client.end();
          delete box.client;
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
