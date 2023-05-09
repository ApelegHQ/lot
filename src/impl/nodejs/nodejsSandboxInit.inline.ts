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

import EMessageTypes from '../../EMessageTypes.js';
import * as Logger from '../../lib/Logger.js';
import workerSandboxInner from '../worker/workerSandboxInner.js';

const listener = (event: MessageEvent) => {
	if (
		!event.isTrusted ||
		!Array.isArray(event.data) ||
		event.data[0] !== EMessageTypes.SANDBOX_READY
	)
		return;

	Logger.info('Received SANDBOX_READY from parent. Creating sandbox.');
	self.removeEventListener('message', listener, false);
	// Fix Function prototype
	Object.defineProperty(Function, 'prototype', {
		value: listener.constructor.prototype,
	});
	Function.prototype.apply.call(
		workerSandboxInner,
		null,
		event.data.slice(1),
	);
};

const recreateError = (e: unknown): Error => {
	const newError = Object.create(Error.prototype);
	if (e) {
		newError.message = String(
			(e as Error).message ? (e as Error).message : e,
		);
	}
	if (e && (e as Error).stack) {
		newError.stack = String((e as Error).stack);
	}
	if (e && (e as Error).name !== 'Error') {
		newError.name = String((e as Error).name);
	}

	return newError;
};

// These need to be wrapped because they contain references to the parent
// environment
// Then, the parent needs to delete these functions, which it can do when
// it receives SANDBOX_READY in the next step
const nativeWrapperFactory =
	<T extends Record<string, typeof Function.prototype>>(obj: T) =>
	(name: keyof T) => {
		const fn = obj[name];

		Object.defineProperty(obj, name, {
			writable: true,
			enumerable: true,
			configurable: true,
			value: ((...args: unknown[]) => {
				try {
					const r = fn.call(obj, ...args);
					if (typeof r !== 'object' && typeof r !== 'function') {
						return r;
					}
				} catch (e: unknown) {
					throw recreateError(e);
				}
			}).bind(obj),
		});
	};

[
	'addEventListener',
	'removeEventListener',
	'postMessage',
	'close',
	'atob',
	'btoa',
].forEach(
	nativeWrapperFactory(
		self as unknown as Parameters<typeof nativeWrapperFactory>[0],
	),
);

(() => {
	const grv = self.crypto.getRandomValues;
	self.crypto.getRandomValues = (<T extends ArrayBufferView | null>(
		array: T,
	): T => {
		if (!array) return array;

		try {
			const ret = grv(array);

			if (ret !== array || ret?.buffer !== array.buffer) {
				throw new Error('Unexpected return value');
			}
		} catch (e) {
			throw recreateError(e);
		}

		return array;
	}).bind(self);
})();

Logger.info('Worker started, registering event listener');

self.addEventListener('message', listener, false);
