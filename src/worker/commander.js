import { Worker } from '@scola/worker';
import { Writable } from 'stream';
import readline from 'readline';

export default class Commander extends Worker {
  constructor(options = {}) {
    super(options);

    this._answers = null;
    this._command = null;
    this._confirm = null;
    this._force = null;
    this._poll = null;
    this._quiet = null;
    this._sudo = null;

    this.setAnswers(options.answers);
    this.setCommand(options.command);
    this.setConfirm(options.confirm);
    this.setForce(options.force);
    this.setPoll(options.poll);
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

  setConfirm(value = false) {
    this._confirm = value;
    return this;
  }

  setForce(value = false) {
    this._force = value;
    return this;
  }

  setPoll(value = null) {
    this._poll = value;
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

    let command = this._command(box, data);
    command = Array.isArray(command) ? command : [command];

    command = command
      .map((cmd) => {
        return cmd && prefix +
          cmd.replace(/( [&|]+ )/g, '$1' + prefix);
      })
      .join(' && ')
      .trim();

    command = this._quiet ? `( ${command} ) &> /dev/null` : command;

    if (command === '') {
      this.skip(box, data, callback);
      return;
    }

    if (this._confirm) {
      if (box.yes !== true) {
        this._createConfirm(box, data, callback, command);
        return;
      }
    }

    this._bind(box, data, callback, command);
    this._write(box, data, callback, command);
  }

  decide(box, data) {
    const description = this.resolve(this._description,
      box, data);

    const regexp = this._force ?
      '.*' :
      new RegExp(box.commanders, 'i');

    if (description.match(regexp) === null) {
      return false;
    }

    return super.decide(box, data);
  }

  _answer(box, data, callback, line, command) {
    const answers = this.resolve(this._answers,
      box, data, line, command);

    if (answers === 'tty') {
      this._createTty(box, data, callback, line);
      return;
    }

    if (answers !== null) {
      this._write(box, data, callback, answers);
    }
  }

  _answerSudo(box, data, callback, line) {
    if (line === 'Sorry, try again.') {
      if (data.ssh.client.config.password) {
        this._error(box, data, callback,
          new Error('Password is invalid'));
      } else {
        this._createTty(box, data, callback, line);
      }

      return true;
    }

    if (line.match(/^\[sudo\] password for .+:$/) !== null) {
      const password = data.ssh.client.config.password;

      if (password) {
        this._write(box, data, callback, password, false);
      } else {
        this._createTty(box, data, callback, line, false);
      }

      return true;
    }

    return false;
  }

  _bind(box, data, callback, command) {
    data.ssh.lines = [];

    data.ssh.stream.on('data', (line) => {
      this._read(box, data, callback, command, line);
    });
  }

  _checkPoll(box, data, callback) {
    if (this._poll === null) {
      return true;
    }

    const poll = this._poll(box, data, data.ssh.lines);

    if (poll === true) {
      return true;
    }

    setTimeout(() => {
      this.act(box, data, callback);
    }, poll);

    return false;
  }

  _createConfirm(box, data, callback, command) {
    const question = 'Are you sure you want to ' +
      this._description.toLowerCase() + '? [Y/n] ';

    this._createQuestion(question, (answer) => {
      if (answer === 'n') {
        this.skip(box, data, callback);
      } else {
        this._bind(box, data, callback, command);
        this._write(box, data, callback, command);
      }
    });
  }

  _createQuestion(question, callback) {
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

    tty.question(question, (answer) => {
      callback(answer);
      tty.close();
    });

    write = question.match(/password/) === null;
  }

  _createTty(box, data, callback, line, log) {
    this._createQuestion(line + ' ', (answer) => {
      this._write(box, data, callback, answer, log);
      console.log();
    });
  }

  _error(box, data, callback, error) {
    error.data = data;
    this.fail(box, error, callback);
  }

  _next(box, data, callback) {
    this._unbind(box, data);

    const pass = this._checkPoll(box, data, callback);

    if (pass === false) {
      return;
    }

    data = this.merge(box, data, data.ssh.lines);

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

    data.ssh.stream.write(line + '\n');
  }
}
