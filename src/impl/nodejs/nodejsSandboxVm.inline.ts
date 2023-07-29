/* Copyright © 2023 Exact Realty Limited.
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

import * as nodejsSandboxInit from 'inline:./nodejsSandboxInit.inline.js';
import vm from 'node:vm';
import type { MessagePort } from 'node:worker_threads';
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import EMessageTypes from '../../EMessageTypes.js';
import { createWrapperFn } from '../../lib/genericSandbox.js';
import hardenGlobals from '../../lib/hardenGlobals.js';
import scopedTimerFunction from '../../lib/scopedTimerFunction.js';
import type workerSandboxInner from '../worker/workerSandboxInner.js';

if (isMainThread || !parentPort) throw new Error('Invalid environment');

const {
	EventTarget: g_EventTarget,
	Function: g_Function,
	JSON: g_JSON,
	Object: g_Object,
	String: g_String,
	TypeError: g_TypeError,
	atob: g_atob,
	btoa: g_btoa,
	clearInterval: g_clearInterval,
	clearTimeout: g_clearTimeout,
	setInterval: g_setInterval,
	setTimeout: g_setTimeout,
} = global;
const close = process.exit.bind(process, 0);
const getRandomValues = globalThis.crypto.getRandomValues.bind(crypto);

class TrustedMessageEvent<T> extends MessageEvent<T> {
	constructor(type: string, eventInitDict?: MessageEventInit<T>) {
		super(type, eventInitDict);
		g_Object.defineProperty(this, 'isTrusted', { value: true });
	}
}

const postMessageFactory =
	(target: EventTarget, origin?: string): typeof postMessage =>
	(message: unknown) => {
		target.dispatchEvent(
			new TrustedMessageEvent('message', {
				...(message !== undefined && { ['data']: message }),
				['origin']: origin,
			}),
		);
	};

const removeAllProperties = (o: unknown, keep?: PropertyKey[]) => {
	o &&
		g_Object
			.entries(g_Object.getOwnPropertyDescriptors(o))
			.forEach(([name, descriptor]) => {
				if (keep?.includes(name)) return;
				if (descriptor.configurable) {
					delete (o as ReturnType<typeof eval>)[name];
				}
			});
};

const INTERNAL_SOURCE_STRING = 'function source() { [provided externally] }';

const nodejsSandbox = (
	parentPort: MessagePort,
	script: string,
	allowedGlobals?: string[] | null | undefined,
	externalMethodKeys?: string[] | null | undefined,
	abort?: boolean | null | undefined,
) => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethodKeys) {
		throw new g_TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const context = g_Object.create(null);
	const wrapperFn = createWrapperFn(script, g_String);

	const eventTargetIncoming = new g_EventTarget();
	const eventTargetOutgoing = new g_EventTarget();

	const postMessageOutgoingUnsafe = postMessageFactory(eventTargetOutgoing);
	// Messages are forced through JSON.parse(JSON.stringify()) to avoid some attack
	// vectors that involve indirect references
	const postMessageOutgoing: typeof postMessageOutgoingUnsafe = (...args) => {
		postMessageOutgoingUnsafe.apply.call(
			postMessageOutgoingUnsafe,
			null,
			g_JSON.parse(g_JSON.stringify(args)),
		);
	};

	const [scopedSetTimeout, scopedClearTimeout] = scopedTimerFunction(
		g_setTimeout,
		g_clearTimeout,
	);
	const [scopedSetInterval, scopedClearInterval] = scopedTimerFunction(
		g_setInterval,
		g_clearInterval,
	);

	// These are some functions to expose to the sandbox that Node.js does
	// not provide with vm, as well as some utility functions for communication
	// (addEventListener, removeEventListener, postMessage) and management
	// (close, Function)
	g_Object.defineProperties(context, {
		// Due to how the Sandbox is constructed, it will attempt to dynamically
		// execute the sandbox source using Function. However, Function will
		// not work inside the vm context, as dynamic eval has been disabled
		// The function is provided upon vm initialisation instead, and
		// Function is defined to return that function instead.
		// This function will be called exactly once
		['Function']: {
			writable: true,
			configurable: true,
			value: (source: unknown) => {
				// If the source is not a string or does not contain the expected
				// token, return (exceptions might expose internals to the Sandbox)
				if (
					typeof source !== 'string' ||
					g_String.prototype.lastIndexOf.call(
						source,
						INTERNAL_SOURCE_STRING,
					) === -1
				) {
					return;
				}

				try {
					// Delete this function (should still be handled later
					// on by fixGlobalTypes)
					if (fn.constructor !== g_Function) {
						// Restore Function to its regular value
						context.self.Function = fn.constructor;
					} else {
						// This shouldn't happen, but in any case this is not
						// the real Function. The most sensible thing to do is
						// to delete it
						delete context.self.Function;
					}
					return fn;
				} catch {
					// empty
					// (exceptions might expose internals)
				}
			},
		},
		['addEventListener']: {
			writable: true,
			configurable: true,
			value: eventTargetOutgoing.addEventListener.bind(
				eventTargetOutgoing,
			),
		},
		['removeEventListener']: {
			writable: true,
			configurable: true,
			value: eventTargetOutgoing.removeEventListener.bind(
				eventTargetOutgoing,
			),
		},
		['postMessage']: {
			writable: true,
			configurable: true,
			value: postMessageFactory(eventTargetIncoming),
		},
		['close']: {
			writable: true,
			configurable: true,
			value: close,
		},
		['crypto']: {
			configurable: true,
			enumerable: true,
			value: g_Object.create(null, {
				['getRandomValues']: {
					writable: true,
					enumerable: true,
					configurable: true,
					value: getRandomValues,
				},
			}),
		},
		['self']: {
			writable: true,
			configurable: true,
			value: context,
		},
		['globalThis']: {
			writable: true,
			configurable: true,
			value: context,
		},
		['atob']: {
			writable: true,
			configurable: true,
			value: g_atob,
		},
		['btoa']: {
			writable: true,
			configurable: true,
			value: g_btoa,
		},
		['clearInterval']: {
			writable: true,
			configurable: true,
			value: scopedClearInterval,
		},
		['clearTimeout']: {
			writable: true,
			configurable: true,
			value: scopedClearTimeout,
		},
		['setInterval']: {
			writable: true,
			configurable: true,
			value: scopedSetInterval,
		},
		['setTimeout']: {
			writable: true,
			configurable: true,
			value: scopedSetTimeout,
		},
	});

	vm.createContext(context, {
		codeGeneration: {
			strings: false,
			wasm: false,
		},
	});

	const displayErrors = process.env['NODE_ENV'] !== 'production';

	// Remove properties from most built-in modules. This should somewhat
	// limit the access to system resources in case of an escape
	(module.constructor as unknown as { builtinModules?: string[] })[
		'builtinModules'
	]?.forEach((v) => {
		if (
			[
				'assert/strict',
				'async_hooks',
				'buffer',
				'events',
				'diagnostics_channel',
				'_http_agent',
				'_http_common',
				'_http_outgoing',
				'_http_server',
				'inspector',
				'module',
				'net',
				'path',
				'path/posix',
				'path/win32',
				'perf_hooks',
				'process',
				'stream',
				'readline',
				'trace_events',
				'v8',
				'vm',
			].includes(v)
		)
			return;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		removeAllProperties(require('node:' + v));
	});
	// Prevent loading CJS modules
	Object.defineProperty(module.constructor, '_load', {
		['set']: () => {},
	});
	// Remove references in global and process to prevent calling require, etc.
	removeAllProperties(process, [
		'_fatalException',
		'debugPort',
		'exit',
		'hrtime',
		'nextTick',
		'reallyExit',
		'report',
		'stderr',
		'stdin',
		'stdout',
	]);
	removeAllProperties(global);

	const fn = vm.runInContext(`(function(){${wrapperFn}})`, context, {
		['displayErrors']: displayErrors,
	});

	vm.runInContext(nodejsSandboxInit.default, context, {
		['displayErrors']: displayErrors,
	});

	parentPort.on('message', (message) => {
		postMessageOutgoing(message);
	});

	eventTargetIncoming.addEventListener('message', (event) => {
		parentPort.postMessage((event as MessageEvent).data);
	});

	postMessageOutgoing([
		EMessageTypes.SANDBOX_READY,
		INTERNAL_SOURCE_STRING,
		!!abort,
		allowedGlobals,
		externalMethodKeys,
	] as [
		EMessageTypes.SANDBOX_READY,
		...Parameters<typeof workerSandboxInner>,
	]);
};

hardenGlobals();

nodejsSandbox(
	parentPort,
	workerData['script'],
	workerData['allowedGlobals'],
	workerData['externalMethodKeys'],
	workerData['abort'],
);
