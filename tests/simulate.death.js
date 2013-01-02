'use strict';

/**!
 * kju
 * @copyright (c) 2013 Observe.it (http://observe.it) <opensource@observe.it>
 * MIT Licensed
 */

var kju = new (require('../index'));

// add some items to the kju so we need to
// store them once process is existing.
kju.push(1, 2, 'three', 4, 10);

// kill the processes
setTimeout(function () {
  process.exit();
}, 100);
