'use strict';

/**!
 * kju
 * @copyright (c) 2013 Observe.it (http://observe.it) <opensource@observe.it>
 * MIT Licensed
 */

var kju = require('../index')
  , spawn = require('child_process').spawn;

// set up chai, our assertation library
var chai = require('chai')
  , expect = chai.expect;

chai.Assertion.includeStack = true;

// make sure we have proper stack traces for when things fail
// require('long-stack-traces');

// the tests
module.exports = {
    'semver compatible version number': function () {
      expect(kju.version).to.match(/^\d+\.\d+\.\d+$/);
    }

  , 'basic kju configurations': function () {
      // default kju
      var q = new kju;

      expect(q.limit).to.be.a('number');
      expect(q.ms).to.be.a('number');
      expect(q.interval).to.be.a('number');

      expect(q.warnings).to.equal(true);
      expect(q.enabled).to.equal(true);
      expect(q.recover).to.equal(true);

      expect(q.path).to.be.be.a('string');
      expect(q.name).to.match(/\{sequence\}/);

      expect(q.minimum).to.be.below(q.maximum);
      expect(q.minimum).to.be.below(q.interval);
      expect(q.maximum).to.be.above(q.minimum);
      expect(q.maximum).to.be.above(q.interval);

      expect(q.since).to.be.a('number');
      expect(q.since).to.be.above(0);

      // don't block the event loop
      q.disable();

      var Q = new kju({ limit: 600, enabled: false });

      expect(Q.limit).to.equal(600);
      expect(Q.ms).to.equal(q.ms);
      expect(Q.enabled).to.equal(false);
    }

  , 'invalid path for .kju files': function (next) {
      var path = '/73179817047/kju/pew/pew/foo/bar'
        , q = new kju({ path: path });

      q.on('error', function (err) {
        expect(err.message).to.equal(path + ' does not exist.');
        next();
      });

      // you know, to kill the interval ;o
      q.disable();
    }

  , 'enabling & disabling kju': function () {
      // disabled events
      var q = new kju
        , events = 0;

      q.on('disabled', function () { events++; });
      q.disable();

      // enabled events
      q = new kju({ enabled: false });
      q.on('enabled', function () { events++; });
      q.enable();

      // don't block the event loop
      q.disable();
      expect(events).to.equal(2);
    }

  , 'enabling & disabling kju multiple times': function () {
      // disabled events
      var q = new kju
        , events = 0;

      q.on('disabled', function () { events++; });
      q.disable();
      q.disable();
      q.disable();
      q.disable();
      q.disable();
      q.disable();
      q.disable();

      // enabled events
      q = new kju({ enabled: false });
      q.on('enabled', function () { events++; });
      q.enable();
      q.enable();
      q.enable();
      q.enable();
      q.enable();
      q.enable();
      q.enable();

      // don't block the event loop
      q.disable();
      expect(events).to.equal(2);
    }

  , 'pushing items in to kju': function () {
      var q = new kju
        , i = 1000;

      while (i--) {
        q.push(i);
        expect(q.length).to.equal(q.buffer.length);
      }

      q.disable();
    }

  , 'pushing multiple arguments in to kju': function () {
      var q = new kju;

      q.push(1, 2, 3, 4, 5, 6, 7, 8, 9);
      expect(q.length).to.equal(9);
      expect(q.length).to.equal(q.buffer.length);

      q.disable();
    }

  , 'kju chaining': function () {
      var q = new kju;

      // \o/ method chaining
      expect(q.push(1)
       .push(2)
       .push(3, 4)
       .disable(true)
       .length
      ).to.equal(4);
    }

  , 'draining kju': function () {
      var q = new kju
        , events = 0;

      q.on('data', function (data, length) {
        expect(Array.isArray(data)).to.equal(true);
        expect(length).to.equal(3);

        expect(data[0]).to.equal('foo');
        expect(data[1]).to.equal('bar');
        expect(data[2]).to.equal(12);

        events++;
      });

      // add some values, in different orders <3
      q.push('foo', 'bar').push(12);

      // manually trigger the drain function
      q.drain();

      expect(q.drained).to.equal(1);
      expect(q.processed).to.equal(3);
      expect(q.length).to.equal(0);
      expect(events).to.equal(1);

      // cleanup, do this last as it also resets the drained
      q.disable(true);
    }

  , 'kju iterating': function () {
      var q = new kju
        , count = 0
        , that = {};

      q.push(1, 2, 3);

      // argument verification
      q.forEach(function (item, index, array) {
        expect(index).to.equal(count);
        expect(++count).to.equal(item);
        expect(array.length).to.equal(3);
      });

      // context verification
      q.forEach(function () {
        expect(this).to.equal(that);
      }, that);

      // oh, w r disabling the queue
      q.disable();
    }

  , 'default data behaviour': function (next) {
      var q = new kju({ limit: 10 })
        , events = 0;

      q.on('data', function (data, length) {
        expect(length).to.be.above(9);
        expect(length).to.be.below(20);

        if (++events === 2) {
          return q.disable();
        }
      });

      q.on('disabled', next);

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
        expect(lines[0]).to.equal('-- begin kju backup output');
        expect(lines[2]).to.equal('-- end kju backup output');

        output = JSON.parse(lines[1]);

        var q = new kju;

        q.on('data', function (data) {
          // validate the data
          expect(data[0]).to.equal(1);
          expect(data[1]).to.equal(2);
          expect(data[2]).to.equal('three');
          expect(data[3]).to.equal(4);
          expect(data[4]).to.equal(10);
        });

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
        expect(m2.drained).to.be.above(m1.drained);
        expect(m2.processed).to.be.above(m1.processed);
        expect(m2.uptime).to.be.above(m1.uptime);

        q.disable();
        next();
      }, 1000);
    }
};
