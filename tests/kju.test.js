var kju = require('../index')
  , should = require('should');

module.exports = {
    'semver compatible version number': function (next) {
      kju.version.should.match(/^\d+\.\d+\.\d+$/);
    }

  , 'configuring kju': function () {
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

      // don't block the event loop
      q.disable();

      var Q = new kju({ limit: 600, enabled: false });

      Q.limit.should.equal(600);
      Q.ms.should.equal(q.ms);
      Q.enabled.should.be.false;
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
    }

  , 'data events': function (next) {
      var q = new kju({ limit: 10 })
        , events = 2;

      q.on('data', function (data, length) {
        if (!--events || length == 20) {
          // don't block the event loop, damit
          q.disable();
          next();
        }

        length.should.be.above(9);
      });

      // add items to the que, async :)
      var i = 20;
      while (i--) {
        process.nextTick(function () { q.push(i); });
      }
    }
};
