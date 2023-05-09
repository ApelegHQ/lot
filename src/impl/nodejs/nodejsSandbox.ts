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
import setupSandboxListeners from '../../lib/setupSandboxListeners.js';
import { ISandbox } from '../../types/index.js';

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
			new TrustedMessageEvent(
				'message',
				message !== undefined
					? {
							...(message !== undefined && { data: message }),
							origin: origin,
					  }
					: undefined,
			),
		);
	};

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

	const postMessageOutgoing = postMessageFactory(eventTargetOutgoing);

	Object.defineProperties(context, {
		// We expect the sandbox to call 'Function' exactly once
		['Function']: {
			writable: true,
			configurable: true,
			value: () => {
				const r = context.self.wrapperFn;
				// delete rawContext.self.wrapperFn;
				// rawContext.self.Function = r.constructor;
				return r;
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
		// TODO: Add setTimeout, clearTimeout, setInterval, clearInterval
	});

	vm.createContext(context, {
		codeGeneration: {
			strings: false,
			wasm: false,
		},
	});

	vm.runInContext(
		`void function(){var _init=function(){${nodejsSandboxInit.default}};self.wrapperFn=function(){var _init;${wrapperFn}};~function(){var f=_init;_init=void 0;f();}();}.call(Object.create(null));`,
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
					'/* source already provided */',
					allowedGlobals,
					externalMethods && Object.keys(externalMethods),
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
