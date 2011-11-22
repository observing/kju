# kju [![Build
Status](https://secure.travis-ci.org/observing/kju.png)](http://travis-ci.org/observing/kju)

kju (queue) is a evented and dynamic fault tolerant queueing system for
Node.js. Node currently suffers from a big limitation, it does not support hot
code reload. So when you want to upgrade your site or service, you need to kill
the running process and have it restart again.

### lol, wut?

Node does not provide a way to do this safely, if you queued up data in memory
it will be lost. If you where about to send a query to your database for a new
account.. You will be fucked. You can consider the query lost. Everything that
where about to do is dropped.

### how

kju is designed to work around this limitation by doing a sync write of the
data to disk when the process.exit is about to occur. This needs to be done in
sync mode as the next tick of the event loop in node might never fire. When kju
starts up again it will search for old data dumps and loads this back again in
to the internal data structure where it's ready to be processed again. In
addition to writing to disk, it will also send the complete JSON dump to the
`stderr` so you have 2 snap shots to recover from.

### use case

A use case for kju would be buffering up data for batch inserts in to the
database. Some database are optimized for batch inserts so they don't have to
reset the indexes on each insert, but they can just do it all in one shot.

### evented dynamic or dynamically evented

kju is designed to do inserts at a fixed interval that you have set. If kju is
not completely filled it will automatically decrease the interval so it has
more to fill up with data before it emits the `data` event. But if the buffer
is filling up really quickly again it will increase the interval adjusting it
self to your website's pressure and bursts.

But there are limits, it will only increase or decrease by a factor of 2 from
the set interval.

## Installation

The easiest way to install kju is by using the Node Package Manager (NPM).

```
npm install kju
```

If npm is not available on your system you can fetch the latest version from
this Github repository.

## API

### configuring

Adding kju to your application is quite simple

```js
var kju = require('kju');
```

Now that you required the module you can create a new instance and configure
it.

```js
var q = new kju; // no configuration

var q = new kju({ limit: 100 }) // with configuration
```

The following configuration flags are supported:

- `limit` Limit of the buffer. Defaults to 500 items.
- `ms` Amount of milliseconds to increase or decrease the interval. Defaults to 100 ms
- `interval` Baseline interval for queue, this is where the minimum and maximum levels are based off.  Defaults to 15000 ms
- `warnings` When enabled we will emit events when our maximum or minimum interval has been reached. Defaults to true.
- `enabled` Enable the queue by default. Defaults to true.
- `recover` Enable recovery of old `.kju` storage files so no data is lost when the process is exiting. Defaults to true.
- `dump` In addition to the storage of `.kju` files also dump JSON to stderr. Defaults to false.
- `path` Location where the `.kju` recover files are stored. Defaults to the current working directory.
- `name` Name of the `.kju` recover files, should contain {sequence}.kju at the end for numbering. Defaults to node_kju_backup.{sequence}.kju.

### events

`error` (err) Error

The error event emitted in several crucial parts in the code. For example if
your supplied path does not exist, we cannot create a backup of your data. But
this event is also fired when the recovery of your backed up file has failed.

`data` (data, length) Array, Number

When kju has reached its limit it will fire off the the data event with queued
data that you can process. It also has a handy length parameter. Because
currently there is no guarantee that the amount of data is the same as your set
limit. It might be more, it might be less.

`maximum interval.warning` (null)

When kju has reached it's maximum timeout and the warning option has been set
to you can be notified by this event.

`minimum interval.warning` (null)

Same as above, but for the minimum timeout this one is probably the most
usefull as it will give you a small indication of what load your queue is
currently under and if you might need to adjust some settings.

> Because we are using EventEmitter 2 you can actually listen to both warnings
at once using `kju.on('\*.warning', function () { .. })`. Which be handy in
some cases where you want to listen to all the events.

`recovered` (null)

Emitted when we have successfully recovered a old data file.

### methods & properties

`kju.push` () Arguments

Adds the arguments to kju. Just like you would with a normal array.

`kju.enable` (null)

Enables kju, it sets the internal interval again and adds a listeners for
process closing.

`kju.disable` (nocommit) Boolean

Disables kju and processes all internally queued data unless the `nocommit`
argument has been set to true.

`kju.forEach` (fn, that) Function, thisArg

Loops over the current queued data, just like it would with a normal array.


## License

The module is licensend under MIT, see the LICENSE file in the repository for
more information.
