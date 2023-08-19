/* eslint-disable @typescript-eslint/no-unused-vars */

var module = {};

function define() {}

// Node.js modules
`/** @const */
var vm = {};

/**
 * @constructor
 */
vm.Context = function () {};

/**
 * @param {string} code
 * @param {vm.Context} context
 * @param {string=} filename
 */
vm.runInContext = function (code, context, filename) {};

/**
 * @param {Object.<string,*>=} initSandbox
 * @return {vm.Context}
 * @nosideeffects
 */
vm.createContext = function (initSandbox) {};

/**
 * @param {string} code
 * @param {string[]} [params]
 * @param {Object.<string,*>} [options]
 * @return {Function}
 * @nosideeffects
 */
vm.compileFunction = function (code, params, options) {};
;

/**
 * @const
 */
var worker_threads = {};

/**
 * @type {boolean}
 */
worker_threads.isMainThread;

/**
 * @type {*}
 */
worker_threads.workerData;

/**
 * @constructor
 * @param {string | URL} filename
 * @param {Object.<string, *>} [options]
 */
worker_threads.Worker = function (filename, options) {};

/**
 * @param {MessagePort} port
 * @param {vm.Context} contextifiedSandbox
 * @return {MessagePort}
 */
worker_threads.moveMessagePortToContext = function (
	port,
	contextifiedSandbox,
) {};
`;
