/**!
 * kju
 * @copyright (c) 2011 Observer (observer.no.de) <info@3rd-Eden.com>
 * MIT Licensed
 */

/**
 * Module dependencies
 */

var EventEmitter2 = require('eventemitter2').EventEmitter2
  , path = require('path')
  , fs = require('fs');

/**
 * Initialize our queue.
 *
 * Options:
 *
 *  - `limit` Limit of the buffer. Defaults to 500 items.
 *  - `ms` Amount of miliseconds to increase or decrease the interval. Defaults
 *    to 100 ms
 *  - `interval` Baseline interval for queue, this is where the minimum and
 *    maximum levels are based off.  Defaults to 15000 ms
 *  - `warnings` When enabled we will emit events when our maximum or minimum
 *    interval has been reached. Defaults to true.
 *  - `enabled` Enable the queue by default. Defaults to true.
 *  - `recover` Enable recovery of old `.kju` storage files so no data is lost
 *    when the process is exiting. Defaults to true.
 *  - `dump` In addition to the storage of `.kju` files also dump JSON to
 *  stder. Defaults to false.
 *  - `path` Location where the `.kju` recover files are stored. Defaults to
 *    the current working directory.
 *  - `name` Name of the `.kju` recover files.
 *
 * @constructor
 * @param {Object} configuration kju configuration
 * @api public
 */

function kju (configuration) {
  var self = this
    , option;

  // defaults
  this.limit = 500;
  this.ms = 100;
  this.interval = 15000;
  this.warnings = true;
  this.enabled = true;
  this.recover = true;
  this.dump = true;
  this.path = process.cwd() + '/';
  this.name = 'node_kju_backup.{sequence}.kju';

  // apply the configuration
  for (var option in configuration)
    this[option] = configuration[option];

  // these values should not be configured
  this.buffer = [];
  this.length = 0;

  this.drained = 0;
  this.processed = 0;
  this.since = Date.now();

  this.minimum = this.interval / 2;
  this.maximum = this.interval * 2;

  // initialize the event emitter
  EventEmitter2.call(this, { wildcard: true });

  if (this.recover) this.recovery();
  if (this.enabled) this.enable();

  // make sure our backup path exists
  path.exists(this.path, function exists (exists) {
    if (!exists) {
      return self.emit('error', new Error(self.path + ' does not exist.'));
    }

    if (self.path[self.path.length - 1] !== '/') {
      return self.emit('error', new Error(self.path + ' should end with a slash'));
    }
  });
};

kju.prototype = new EventEmitter2;
kju.constructor = kju;

/**
 * Enable kju
 *
 * @returns {kju}
 * @api public
 */

kju.prototype.enable = function enable () {
  if (this.timeout) return this;

  this.timeout = setTimeout(this.update.bind(this), this.interval);

  // add an exit listener
  process.on('exit', this.backup.bind(this));
  this.emit('enabled');

  return this;
};

/**
 * Disables kju, and flushes the remaining buffer by default
 *
 * @param {Boolean} nocommit prevent from sending the last batch of data
 * @returns {kju}
 * @api public
 */

kju.prototype.disable = function disable (nocommit) {
  if (!this.timeout) return this;

  // clean up, the order matters as this.drain() can set a new
  // timeout. And it doesn't work if there isn't a timeout, because
  // kju would be disabled then.
  if (this.length && !nocommit) this.drain();
  if (this.timeout) clearTimeout(this.timeout);

  // remove the exit listener
  process.removeListener('exit', this.backup.bind(this));

  // reset to the default values
  delete this.timeout;
  this.emit('disabled');

  return this;
};

/**
 * Queues up the items untill it reaches the limit.
 *
 * @returns {kju}
 * @api public
 */

kju.prototype.push = function push () {
  this.length += arguments.length;
  Array.prototype.push.apply(this.buffer, arguments);

  // check if we need do a update right away, as we might hit our limit. But
  // make sure we are not in our disabled state, aka no timeout.
  if (this.length >= this.limit && this.timeout) {
    this.update();
  }

  return this;
};

/**
 * We have reached a limit and we are going to emit the buffered data
 *
 * @returns {kju}
 * @api private
 */

kju.prototype.drain = function drain () {
  this.emit('data', this.buffer.splice(0), this.length);

  // increase metrics & reset
  this.drained++;
  this.processed += this.length;
  this.length = 0;

  return this;
};

/**
 * Loops over the current buffered items
 *
 * @param {Function} fn callback
 * @param {thisArg} that this argument
 * @return {kju}
 * @api public
 */

kju.prototype.forEach = function forEach (fn, that) {
  this.buffer.forEach(fn, that || this);

  return this;
};

/**
 * Checks if we need to increase or decrease kju's interval so we are
 * optimizing our network connection for batch updates.
 *
 * @returns {kju}
 * @api public
 */

kju.prototype.update = function update () {
  // don't reinitialize the timeout, we are probably disabled
  if (!this.timeout) return this;

  var self = this;

  if (this.timeout) { 
    clearTimeout(this.timeout);
    delete this.timeout;
  }

  // do we need to increase the interval so it has more time to fill up the
  // internal buffer.
  if (!this.length || this.length < this.limit) {
    this.interval = this.interval >= this.maximum
      ? this.maximum
      : this.interval + this.ms;

    // did we reach our maximum interval?
    if (this.warnings && this.interval >= this.maximum) {
      process.nextTick(function maximum () {
        self.emit('maximum interval.warning');
      });
    }
  } else {
    // check if we are reaching our minimum level here
    if (this.length >= this.limit) {
      this.interval = this.interval <= this.minimum
        ? this.minimum
        : this.interval - this.ms;

      // did we reach our minimum interval?
      if (this.warnings && this.interval <= this.minimum) {
        process.nextTick(function minimum () {
          self.emit('minimum interval.warning');
        })
      }
    }
  }

  // set a new timeout
  this.timeout = setTimeout(update.bind(this), this.interval);

  // drain kju if needed
  if (this.length) this.drain();
};

/**
 * Outputs some metrics about the kju's current state
 *
 * @returns {Object} object with metrics
 * @api public
 */

kju.prototype.metrics = function metrics () {
  var uptime = this.since ? Date.now() - this.since : 0
    , minute = 1000 * 60;

  return {
      'drain': this.drained
    , 'processed': this.processed
    , 'uptime': uptime
    , 'interval': this.interval
    , 'items per minute': (this.processed / minute).toFixed(2)
    , 'drains per minute': (this.drain / minute).toFixed(2)
  }
}

/**
 * Backup the current internal queue, please note that we need to use sync
 * methods here because event loop has already been stopped. We could wrap all
 * methods in try catch blocks because we use a sync version, but as this
 * method is only called on exit, it doesn't really matter as the process is
 * going to die anyways.
 *
 * @api private
 */

kju.prototype.backup = function backup () {
  if (!this.recover || !this.length || !path.existsSync(this.path)) return;

  var filename = /(\d+)\.kju$/
    , data = JSON.stringify(this.buffer)
    , sequence = 0;

  // read the files in the set path, see if we can find old kju back up files
  // and parse our the {sequence} number so we clash
  var files = [];

  fs.readdirSync(this.path)
    .filter(function map (file) { return filename.test(file) })
    .map(function map (file) { return +filename.exec(file)[1] })
    .sort(function sort (a, b) { return a - b })
    .forEach(function forEach (file) {
      if (files.indexOf(file) === -1) files.push(file)
    })

  // determin sequence number
  if (files.length) {
    sequence = ++files[files.length - 1];
  }

  // write to file
  fs.writeFileSync(this.path + this.name.replace('{sequence}', sequence), data);

  // do we need to output the dump of data to the stderr?
  if (this.dump) {
    console.error('-- begin kju backup output');
    console.error(data);
    console.error('-- end kju backup output');
  }

};

/**
 * Recover old `.kju` backup files if they exist. This does not need to be sync
 * like the backup method.
 *
 * @api private
 */

kju.prototype.recovery = function recover () {
  var self = this
    , processed = 0
    , currently = 0;

  /**
   * filter all none `.kju` files out of the array
   *
   * @param {Error} err Set when a error occured
   * @param {Array} files Files to filter
   * @api private
   */

  function filter (err, files) {
    if (err) return self.emit('error', err);

    var kjud = files.filter(function (file) {
      return /(\d)\.kju$/.test(file);
    });

    // if we don't have any files we don't really need to emit 'recovered' so
    // no need to check for the length here. We are only gonna use the length
    // if there are files.
    processed = kjud.length;
    kjud.forEach(read);
  }

  /**
   * Read file and process it
   *
   * @param {String} file
   * @param {Number} index
   * @param {Array} files
   * @api private
   */

  function read (file, index, files) {
    fs.readFile(self.path + file, function readFile (err, contents) {
      if (err) return done(), self.emit('error', err);

      // try to parse the file as JSON, if that doesn't work we have big issue
      // because the file is damaged.
      try {
        var todo = JSON.parse(contents.toString('utf8'));

        // pfew, it worked re-add it to kju and remove the file, I don't really
        // care about the clean up process. So I'm not gonna handle the errors
        // that could occure there.
        self.push.apply(self, todo);
        fs.unlink(self.path + file, function () {});
      } catch (e) {
        self.emit('error'
          , new Error('corrupted file, unable to parse contents of ' + file)
        );
      }

      done();
    });
  }

  /**
   * Simple way to keep track of async events
   *
   * @api private
   */

  function done () {
    if (--processed) self.emit('recovered');
  }

  // check if the path exists and if there are files to filter
  path.exists(this.path, function existsPath (exists) {
    if (!exists) return;

    fs.readdir(self.path, filter);
  })
};

/**
 * Version number
 *
 * @static
 * @type {String}
 */

kju.version = '0.0.1';

/**
 * Expose the API
 */

module.exports = kju;
