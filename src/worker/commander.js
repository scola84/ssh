import { Worker } from '@scola/worker';
import { Writable } from 'stream';
import readline from 'readline';

export default class Commander extends Worker {
  constructor(options = {}) {
    super(options);

    this._answers = null;
    this._command = null;
    this._quiet = null;
    this._sudo = null;

    this.setAnswers(options.answers);
    this.setCommand(options.command);
    this.setQuiet(options.quiet);
    this.setSudo(options.sudo);
  }

  setAnswers(value = null) {
    this._answers = value;
    return this;
  }

  setCommand(value = '') {
    this._command = value;
    return this;
  }

  setQuiet(value = false) {
    this._quiet = value;
    return this;
  }

  setSudo(value = true) {
    this._sudo = value;
    return this;
  }

  act(box, data, callback) {
    data = this.filter(box, data);

    if (typeof data.ssh.stream === 'undefined') {
      this.skip(box, data, callback);
      return;
    }

    const prefix = data.ssh.sudo === true && this._sudo === true ?
      'sudo ' : '';

    let command = this.resolve(this._command, box, data);
    command = Array.isArray(command) ? command : [command];

    command = command
      .map((cmd) => {
        return prefix +
          cmd.replace(/( [&|]+ )/g, '$1' + prefix);
      })
      .join(' && ')
      .trim();

    command = this._quiet ? `( ${command} ) &> /dev/null` : command;

    this._bind(box, data, callback, command);
    this._write(box, data, callback, command);
  }

  decide(box, data) {
    const description = this.resolve(this._description,
      box, data);

    const regexp = new RegExp(box.commanders, 'i');

    if (description.match(regexp) === null) {
      return false;
    }

    return super.decide(box, data);
  }

  _answer(box, data, callback, line, command) {
    const answers = this.resolve(this._answers,
      box, data, line, command);

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
      const password = data.ssh.user.password;

      if (password) {
        this._write(box, data, callback, password, false);
      } else {
        this._answerTty(box, data, callback, line, false);
      }

      return true;
    }

    return false;
  }

  _answerTty(box, data, callback, line, log) {
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
      this._write(box, data, callback, answer, log);
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

    const free = /:( [^\\.]+)?$/;
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
      this._answer(box, data, callback, line, command);
    }
  }

  _unbind(box, data) {
    data.ssh.stream.removeAllListeners('data');
  }

  _write(box, data, callback, line, log = true) {
    if (log === true) {
      this.log('info', box, data, callback, line);
    }

    line = data.ssh.test === true ? '' : line;
    data.ssh.stream.write(line + '\n');
  }
}
