# kju

kju (queue) is a evented and dynamic fault tolerant queueing system for
Node.js. Node currently suffers from a big limitation, it does not support hot
code reload. So when you want to upgrade your site or service, you need to kill
the running process and have it restart again.

## lol, wut?

Node does not provide a way to do this safely, if you queued up data in memory
it will be lost. If you where about to send a query to your database for a new
account.. You will be fucked. You can consider the query lost. Everything that
where about to do is dropped.

## how

kju is designed to work around this limitation by doing a sync write of the
data to disk when the process.exit is about to occur. This needs to be done in
sync mode as the next tick of the event loop in node might never fire. When kju
starts up again it will search for old data dumps and loads this back again in
to the internal data structure where it's ready to be processed again. In
addition to writing to disk, it will also send the complete JSON dump to the
`stderr` so you have 2 snap shots to recover from.

## use case

A use case for kju would be buffering up data for batch inserts in to the
database. Some database are optimized for batch inserts so they don't have to
reset the indexes on each insert, but they can just do it all in one shot.

## evented dynamic or dynamically evented

kju is designed to do inserts at a fixed interval that you have set. If kju is
not completely filled it will automatically decrease the interval so it has
more to fill up with data before it emits the `data` event. But if the buffer
is filling up really quickly again it will increase the interval adjusting it
self to your website's pressure and bursts.

But there are limits, it will only increase or decrease by a factor of 2 from
the set interval.

# Installation

The easiest way to install kju is by using the Node Package Manager (NPM).

```
npm install kju
```

If npm is not available on your system you can fetch the latest version from
this Github repository.

# API

## events

## methods

# License

The module is licensend under MIT, see the LICENSE file in the repository for
more information.
