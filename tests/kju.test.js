/**!
 * kju
 * @copyright (c) 2011 Observer (observer.no.de) <info@3rd-Eden.com>
 * MIT Licensed
 */

var kju = require('../index')
  , spawn = require('child_process').spawn;

// make sure we have proper stack traces for when things fail
// require('long-stack-traces');

// the tests
module.exports = {
    'semver compatible version number': function (next) {
      kju.version.should.match(/^\d+\.\d+\.\d+$/);
      next();
    }

  , 'basic kju configurations': function (next) {
      // default kju
      var q = new kju;

      q.limit.should.be.a('number');
      q.ms.should.be.a('number');
      q.interval.should.be.a('number');

      q.warnings.should.be.true
      q.enabled.should.be.true;
      q.recover.should.be.true;

      q.path.should.be.be.a('string');
      q.name.should.match(/\{sequence\}/);

      q.minimum.should.be.below(q.maximum);
      q.minimum.should.be.below(q.interval);
      q.maximum.should.be.above(q.minimum);
      q.maximum.should.be.above(q.interval);

      q.since.should.be.a('number');
      q.since.should.be.above(0);

      // don't block the event loop
      q.disable();

      var Q = new kju({ limit: 600, enabled: false });

      Q.limit.should.equal(600);
      Q.ms.should.equal(q.ms);
      Q.enabled.should.be.false;

      next();
    }

  , 'invalid path for .kju files': function (next) {
      var path = '/73179817047/kju/pew/pew/foo/bar'
        , q = new kju({ path: path });

      q.on('error', function (err) {
        err.message.should.equal(path + ' does not exist.');
        next();
      });

      // you know, to kill the interval ;o
      q.disable();
    }

  , 'enabling & disabling kju': function (next) {
      // disabled events
      var q = new kju
        , events = 0;

      q.on('disabled', function () { events++ });
      q.disable();

      // enabled events
      q = new kju({ enabled: false });
      q.on('enabled', function () { events++ });
      q.enable();

      // don't block the event loop
      q.disable();
      events.should.equal(2);

      next();
    }

  , 'enabling & disabling kju multiple times': function (next) {
      // disabled events
      var q = new kju
        , events = 0;

      q.on('disabled', function () { events++ });
      q.disable();
      q.disable();
      q.disable();
      q.disable();
      q.disable();
      q.disable();
      q.disable();

      // enabled events
      q = new kju({ enabled: false });
      q.on('enabled', function () { events++ });
      q.enable();
      q.enable();
      q.enable();
      q.enable();
      q.enable();
      q.enable();
      q.enable();

      // don't block the event loop
      q.disable();
      events.should.equal(2);

      next();
    }

  , 'pushing items in to kju': function (next) {
      var q = new kju
        , i = 1000;

      while (i--) {
        q.push(i);
        q.length.should.equal(q.buffer.length);
      }

      q.disable();
      next();
    }

  , 'pushing multiple arguments in to kju': function (next) {
      var q = new kju;

      q.push(1, 2, 3, 4, 5, 6, 7, 8, 9);
      q.length.should.equal(9);
      q.length.should.equal(q.buffer.length);

      q.disable();
      next();
    }

  , 'kju chaining': function (next) {
      var q = new kju;

      // \o/ method chaining
      q.push(1)
       .push(2)
       .push(3, 4)
       .disable(true)
       .length.should.equal(4);

      next();
    }

  , 'draining kju': function (next) {
      var q = new kju
        , events = 0;

      q.on('data', function (data, length) {
        Array.isArray(data).should.be.true;
        length.should.equal(3);

        data[0].should.equal('foo');
        data[1].should.equal('bar');
        data[2].should.equal(12);

        events++;
      });

      // add some values, in different orders <3
      q.push('foo', 'bar').push(12);

      // manually trigger the drain function
      q.drain();

      q.drained.should.equal(1);
      q.processed.should.equal(3);
      q.length.should.equal(0);
      events.should.equal(1);

      // cleanup, do this last as it also resets the drained
      q.disable(true);
      next();
    }

  , 'kju iterating': function (next) {
      var q = new kju
        , count = 0
        , that = {};

      q.push(1, 2, 3);

      // argument verification
      q.forEach(function (item, index, array) {
        index.should.equal(count);
        (++count).should.equal(item);
        array.length.should.equal(3);
      });

      // context verification
      q.forEach(function () {
        this.should.equal(that);
      }, that);

      // oh, w r disabling the queue
      q.disable();
      next();
    }

  , 'default data behaviour': function (next) {
      var q = new kju({ limit: 10 })
        , events = 0;

      q.on('data', function (data, length) {
        length.should.be.above(9);
        length.should.be.below(20);

        if (++events === 2) {
          return q.disable();
        }
      });

      q.on('disabled', function () {
        next();
      });

      // add items to the que, async :)
      var i = 10;
      while (i--) {
        q.push(i);
      }

      // 19 more later, so we are under our limit
      process.nextTick(function () {
        var i = 19;
        while (i--) {
          q.push(i);
        }
      });
    }

  , 'reaching the maximum timeout': function (next) {
      var q = new kju({ limit: 10, interval: 500 });

      q.on('maximum timeout.warning', function () {
        q.disable();
        next();
      });
    }

  , 'reaching the minimum timeout': function (next) {
      var q = new kju({ limit: 10, interval: 500 });

      q.on('minimum timeout.warning', function () {
        q.disable(true);
        next();
      });

      // keep cycling the inital data
      q.on('data', function (data) {
        setTimeout(function () {
          q.push.apply(q, data);
        }, 10);
      });

      // feed inital data
      var i = 10;
      while (i--) {
        q.push(i);
      }
    }

  , 'death recovery and data output': function (next) {
      var external = spawn('node', [__dirname + '/simulate.death.js'])
        , output
        , buffering = '';

      // monitor for the output of the dump
      external.stderr.on('data', function (data) {
        buffering += data.toString();
      });

      // wait for the simulated death to end so we can read in the
      // kju backup file
      external.on('exit', function () {
        var lines = buffering.toString().split('\n');

        // make sure we have the correct output here
        lines[0].should.equal('-- begin kju backup output');
        lines[2].should.equal('-- end kju backup output');

        output = JSON.parse(lines[1]);

        var q = new kju;

        q.on('data', function (data) {
          // validate the data
          data[0].should.equal(1);
          data[1].should.equal(2);
          data[2].should.equal('three');
          data[3].should.equal(4);
          data[4].should.equal(10);
        })

        // wait until the data has been read
        q.on('recovered', function () {
          // no need to do any assert tests here, if this doesn't
          // get called, we get a timeout error. Which tells us enough.
          q.disable();
          next();
        });
      });
    }

  , 'kju metrics': function (next) {
      var q = new kju
        , i = 1345
        , m1;

      // add some data in to the kju, so we get some metrics
      while (i--) q.push(i);
      m1 = q.metrics();

      // add more stats, but that is done a bit later
      setTimeout(function () {
        var i = 2424
          , m2;

        while (i--) q.push(i);

        m2 = q.metrics();
        m2['drained'].should.be.above(m1['drained']);
        m2['processed'].should.be.above(m1['processed']);
        m2['uptime'].should.be.above(m1['uptime']);

        q.disable();
        next();
      }, 1000);
    }
};
