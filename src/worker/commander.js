import { Worker } from '@scola/worker';
import { Writable } from 'stream';
import readline from 'readline';

export default class Commander extends Worker {
  constructor(options = {}) {
    super(options);

    this._answers = null;
    this._command = null;
    this._quiet = null;

    this.setAnswers(options.answers);
    this.setCommand(options.command);
    this.setQuiet(options.quiet);
  }

  setAnswers(value = null) {
    this._answers = value;
    return this;
  }

  setCommand(value = '') {
    this._command = value;
    return this;
  }

  setDescription(value = null) {
    this._description = value;
    return this;
  }

  setQuiet(value = false) {
    this._quiet = value;
    return this;
  }

  act(box, data, callback) {
    data = this.filter(box, data);

    let command = this._resolve(this._command, box, data);

    if (Array.isArray(command)) {
      command = command.map((cmd) => {
        cmd = data.ssh.sudo === true ? 'sudo ' + cmd : cmd;
        cmd = this._quiet === true ? cmd + ' > /dev/null' : cmd;
        return cmd;
      }).join(' && ');
    } else {
      command = data.ssh.sudo === true ? 'sudo ' + command : command;
      command = this._quiet === true ? command + ' > /dev/null' : command;
    }

    this._bind(box, data, callback, command);
    this._write(box, data, callback, command);
  }

  _answer(box, data, callback, line) {
    const answers = this._resolve(this._answers, box, data, line);

    if (answers === 'tty') {
      this._answerTty(box, data, callback, line);
      return;
    }

    if (answers !== null) {
      this._write(box, data, callback, answers);
    }
  }

  _answerSudo(box, data, callback, line) {
    if (line === 'Sorry, try again.') {
      if (data.ssh.user.password) {
        this._error(box, data, callback,
          new Error('Password on box is invalid'));
      } else {
        this._answerTty(box, data, callback, line);
      }

      return true;
    }

    if (line.match(/^\[sudo\] password for .+:$/) !== null) {
      if (data.ssh.user.password) {
        this._write(box, data, callback, data.ssh.user.password);
      } else {
        this._answerTty(box, data, callback, line);
      }

      return true;
    }

    return false;
  }

  _answerTty(box, data, callback, line) {
    let write = true;

    const output = new Writable({
      write(chunk, encoding, outputCallback) {
        if (write) {
          process.stdout.write(chunk, encoding);
        }

        outputCallback();
      }
    });

    const tty = readline.createInterface({
      input: process.stdin,
      output,
      terminal: true
    });

    tty.question(line + ' ', (answer) => {
      this._write(box, data, callback, answer);
      tty.close();
      console.log();
    });

    write = line.match(/password/) === null;
  }

  _bind(box, data, callback, command) {
    data.ssh.lines = [];

    data.ssh.stream.on('data', (line) => {
      this._read(box, data, callback, command, line);
    });
  }

  _error(box, data, callback, error) {
    error.data = data;
    this.fail(box, error, callback);
  }

  _next(box, data, callback) {
    data = this.merge(box, data, data.ssh.lines);

    this._unbind(box, data);
    this.pass(box, data, callback);
  }

  _read(box, data, callback, command, line) {
    line = String(line).trim();

    if (this._answerSudo(box, data, callback, line) === true) {
      return;
    }

    const free = /:$/;
    const mc = /\? \[.+\]$/;
    const q = /\?$/;
    const prompt = /[$#]$/;

    if (line.match(prompt)) {
      this._next(box, data, callback);
      return;
    }

    if (line && line !== command) {
      this.log('info', box, data, callback, line);
      data.ssh.lines[data.ssh.lines.length] = line;
    }

    if (line.match(free) || line.match(mc) || line.match(q)) {
      this._answer(box, data, callback, line);
    }
  }

  _resolve(fn, ...args) {
    if (typeof fn === 'function') {
      return this._resolve(fn(...args), ...args);
    }

    return fn;
  }

  _unbind(box, data) {
    data.ssh.stream.removeAllListeners('data');
  }

  _write(box, data, callback, line) {
    this.log('info', box, data, callback, line);
    line = data.ssh.test === true ? '' : line;
    data.ssh.stream.write(line + '\n');
  }
}
