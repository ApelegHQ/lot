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
import EMessageTypes from '../../EMessageTypes.js';
import { createWrapperFn } from '../../lib/genericSandbox.js';
import getRandomUuid from '../../lib/getRandomUuid.js';
import scopedTimerFunction from '../../lib/scopedTimerFunction.js';
import setupSandboxListeners from '../../lib/setupSandboxListeners.js';
import { ISandbox } from '../../types/index.js';
import type workerSandboxInner from '../worker/workerSandboxInner.js';

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
				...(message !== undefined && { data: message }),
				origin: origin,
			}),
		);
	};

const INTERNAL_SOURCE_STRING = 'function source() { [provided externally] }';

const nodejsSandbox: ISandbox = async (
	script,
	allowedGlobals,
	externalMethods,
	abort,
) => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethods) {
		throw new TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const context = Object.create(null);
	const wrapperFn = createWrapperFn(script, String);

	const originIncoming = 'urn:uuid:' + getRandomUuid();

	const eventTargetIncoming = new EventTarget();
	const eventTargetOutgoing = new EventTarget();

	eventTargetOutgoing.dispatchEvent(new MessageEvent('message', { data: 1 }));

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
			value: postMessageFactory(eventTargetIncoming, originIncoming),
		},
		['close']: {
			writable: true,
			configurable: true,
			value: () => 'TODO',
		},
		['crypto']: {
			configurable: true,
			enumerable: true,
			value: Object.create(null, {
				['getRandomValues']: {
					writable: true,
					enumerable: true,
					configurable: true,
					value: globalThis.crypto.getRandomValues.bind(
						globalThis.crypto,
					),
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

	vm.runInContext(
		`void function(){var _init=function(){${nodejsSandboxInit.default}};self.wrapperFn=function(_init){${wrapperFn}};~function(){var f=_init;_init=void 0;f();}();}.call({});`,
		context,
		{
			displayErrors: process.env['NODE_ENV'] !== 'production',
		},
	);

	return setupSandboxListeners(
		eventTargetIncoming,
		originIncoming,
		null,
		undefined,
		false,
		postMessageOutgoing,
		async () => {
			try {
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
			} catch {
				// empty
			}
		},
		externalMethods,
		abort,
	);
};

export default nodejsSandbox;
