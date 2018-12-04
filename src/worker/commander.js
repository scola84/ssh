import { Worker } from '@scola/worker';
import { Writable } from 'stream';
import readline from 'readline';

const logOptions = {
  level: 0
};

export default class Commander extends Worker {
  static setOptions(options) {
    Object.assign(logOptions, options);
  }

  constructor(options = {}) {
    super(options);

    this._answers = null;
    this._command = null;
    this._description = null;

    this.setAnswers(options.answers);
    this.setCommand(options.command);
    this.setDescription(options.description);
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

  act(box, data, callback) {
    data = this.filter(box, data);

    let command = this._command;

    if (typeof command === 'function') {
      command = command(box, data);
    }

    if (Array.isArray(command)) {
      command = command.map((cmd) => {
        return box.sudo === true ? 'sudo ' + cmd : cmd;
      }).join(' && ');
    } else {
      command = box.sudo === true ? 'sudo ' + command : command;
    }

    command = box.test === true ? '' : command;

    this._bind(box, data, callback, command);
    this._write(box, command, callback);
  }

  _answer(box, data, callback) {
    if (this._answers === 'tty') {
      this._answerTty(box, data);
      return;
    }

    let answer = null;

    if (typeof this._answers === 'function') {
      answer = this._answers(box, data);
    }

    if (Array.isArray(this._answers)) {
      box.answers = box.answers || this._answers.slice();
      answer = box.answers.shift();
    }

    if (typeof answer === 'undefined') {
      this._error(box, data, callback,
        new Error('Could not answer question'));
    } else if (answer !== null) {
      this._write(box, answer, callback);
    }
  }

  _answerSudo(box, line, callback) {
    if (line.slice(0, 6) === '[sudo]') {
      this._write(box, box.user.password, callback);
      return true;
    }

    return false;
  }

  _answerTty(box, data, callback) {
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

    tty.question(data + ' ', (answer) => {
      this._write(box, answer, callback);
      tty.close();
    });

    write = data.match(/password/) === null;
  }

  _bind(box, data, callback, command) {
    box.lines = [];

    box.stream.on('data', (line) => {
      this._read(box, data, callback, command, line);
    });
  }

  _error(box, data, callback, error) {
    error.data = data;
    this._logDescription(false);
    this.fail(box, error, callback);
  }

  _logDescription(result) {
    if (this._description === null) {
      return;
    }

    if (logOptions.level === 0) {
      return;
    }

    const format = result === true ?
      '\x1b[32m✔ \x1b[0m%s' :
      '\x1b[31m✖ \x1b[0m%s';

    console.log(format, this._description);
  }

  _next(box, data, callback) {
    data = this.merge(box, data, box.lines);

    this._unbind(box);
    this._logDescription(true);

    this.pass(box, data, callback);
  }

  _read(box, data, callback, command, line) {
    line = String(line).trim();

    if (this._answerSudo(box, line, callback) === true) {
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
      if (box.log === 'line') {
        console.log(line);
      }

      this.log('info', box, line, callback);
      box.lines[box.lines.length] = line;
    }

    if (line.match(free) || line.match(mc) || line.match(q)) {
      this._answer(box, line);
    }
  }

  _unbind(box) {
    box.stream.removeAllListeners('data');
  }

  _write(box, data, callback) {
    if (box.log === 'line') {
      console.log(data);
    }

    this.log('info', box, data, callback);
    box.stream.write(data + '\n');
  }
}
