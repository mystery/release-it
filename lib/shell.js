const sh = require('shelljs');
const execa = require('execa');
const debug = require('debug')('release-it:shell');
const { format } = require('./util');

sh.config.silent = !debug.enabled;

const noop = Promise.resolve();

class Shell {
  constructor({ global = {}, container }) {
    this.global = global;
    this.log = container.log;
    this.config = container.config;
  }

  exec(command, options = {}, context = {}) {
    if (!command || !command.length) return;
    return typeof command === 'string'
      ? this.execFormattedCommand(format(command, context), options)
      : this.execFormattedCommand(command, options);
  }

  async execFormattedCommand(command, options = {}) {
    const isDryRun = this.global.isDryRun;
    const isWrite = options.write !== false;
    const isExternal = options.external === true;

    if (isDryRun && isWrite) {
      this.log.exec(command, { isDryRun });
      return noop;
    }

    this.log.exec(command, { isExternal });

    if (typeof command === 'string') {
      return this.execStringCommand(command, options, { isExternal });
    } else {
      return this.execWithArguments(command, options, { isExternal });
    }
  }

  execStringCommand(command, options, { isExternal }) {
    return new Promise((resolve, reject) => {
      sh.exec(command, { async: true }, (code, stdout, stderr) => {
        stdout = stdout.toString().trim();
        this.log.verbose(stdout, { isExternal });
        debug({ command, options, code, stdout, stderr });
        if (code === 0) {
          resolve(stdout);
        } else {
          if (stdout && stderr) {
            this.log.log(`\n${stdout}`);
          }
          reject(new Error(stderr || stdout));
        }
      });
    });
  }

  async execWithArguments(command, options, { isExternal }) {
    const [program, ...programArgs] = command;

    try {
      const { stdout: out, stderr } = await execa(program, programArgs);
      const stdout = out === '""' ? '' : out;
      this.log.verbose(stdout, { isExternal });
      debug({ command, options, stdout, stderr });
      return Promise.resolve(stdout || stderr);
    } catch (error) {
      if (error.stdout) {
        this.log.log(`\n${error.stdout}`);
      }
      debug({ error });
      return Promise.reject(new Error(error.stderr || error.message));
    }
  }
}

module.exports = Shell;
