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
	TypeError,
	JSON,
	String,
	Object,
	Function,
	setTimeout,
	setInterval,
	clearTimeout,
	clearInterval,
	atob,
	btoa,
	EventTarget,
} = global;
const close = process.exit.bind(process, 0);
const getRandomValues = globalThis.crypto.getRandomValues.bind(crypto);

class TrustedMessageEvent<T> extends MessageEvent<T> {
	constructor(type: string, eventInitDict?: MessageEventInit<T>) {
		super(type, eventInitDict);
		Object.defineProperty(this, 'isTrusted', { value: true });
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
	Object.entries(Object.getOwnPropertyDescriptors(o)).forEach(
		([name, descriptor]) => {
			if (keep?.includes(name)) return;
			if (descriptor.configurable) {
				delete (o as ReturnType<typeof eval>)[name];
			}
		},
	);
};

const INTERNAL_SOURCE_STRING = 'function source() { [provided externally] }';

const nodejsSandbox = (
	parentPort: MessagePort,
	script: string,
	allowedGlobals?: string[] | null | undefined,
	externalMethods?: string[] | null | undefined,
	abort?: boolean | null | undefined,
) => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethods) {
		throw new TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const context = Object.create(null);
	const wrapperFn = createWrapperFn(script, String);

	const eventTargetIncoming = new EventTarget();
	const eventTargetOutgoing = new EventTarget();

	const postMessageOutgoingUnsafe = postMessageFactory(eventTargetOutgoing);
	// Messages are forced through JSON.parse(JSON.stringify()) to avoid some attack
	// vectors that involve indirect references
	const postMessageOutgoing: typeof postMessageOutgoingUnsafe = (...args) => {
		postMessageOutgoingUnsafe.apply.call(
			postMessageOutgoingUnsafe,
			null,
			JSON.parse(JSON.stringify(args)),
		);
	};

	const [scopedSetTimeout, scopedClearTimeout] = scopedTimerFunction(
		setTimeout,
		clearTimeout,
	);
	const [scopedSetInterval, scopedClearInterval] = scopedTimerFunction(
		setInterval,
		clearInterval,
	);

	// These are some functions to expose to the sandbox that Node.js does
	// not provide with vm, as well as some utility functions for communication
	// (addEventListener, removeEventListener, postMessage) and management
	// (close, Function)
	Object.defineProperties(context, {
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
					String.prototype.lastIndexOf.call(
						source,
						INTERNAL_SOURCE_STRING,
					) === -1
				) {
					return;
				}

				try {
					// Obtain the wrapper function
					const r = context.self.wrapperFn;
					// Delete the reference from context.self
					delete context.self.wrapperFn;
					// Delete this function (should still be handled later
					// on by fixGlobalTypes)
					if (r.constructor !== Function) {
						// Restore Function to its regular value
						context.self.Function = r.constructor;
					} else {
						// This shouldn't happen, but in any case this is not
						// the real Function. The most sensible thing to do is
						// to delete it
						delete context.self.Function;
					}
					return r;
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
			value: Object.create(null, {
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
			value: atob,
		},
		['btoa']: {
			writable: true,
			configurable: true,
			value: btoa,
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

	// Remove references in global and process to prevent calling require, etc.
	removeAllProperties(process, [
		'hrtime',
		'nextTick',
		'stdin',
		'stdout',
		'stderr',
		'report',
		'debugPort',
		'exit',
		'reallyExit',
		'_fatalException',
	]);
	removeAllProperties(global);

	vm.runInContext(
		`void function(){var _init=function(){${nodejsSandboxInit.default}};self.wrapperFn=function(_init){${wrapperFn}};~function(){var f=_init;_init=void 0;f();}();}.call({});`,
		context,
		{
			['displayErrors']: displayErrors,
		},
	);

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
		externalMethods && Object.keys(externalMethods),
	] as [
		EMessageTypes.SANDBOX_READY,
		...Parameters<typeof workerSandboxInner>,
	]);

	return async () => {};
};

hardenGlobals();

nodejsSandbox(
	parentPort,
	workerData['script'],
	workerData['allowedGlobals'],
	workerData['externalMethods'],
	workerData['abort'],
);
