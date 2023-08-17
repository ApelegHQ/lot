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

import {
	aFrom,
	aIndexOf,
	aIsArray,
	aPush,
	aSlice,
	aSplice,
	fnApply,
	oCreate,
	oDefineProperty,
} from '~untrusted/lib/utils.js';

import workerSandboxInner from '~untrusted/impl/worker/workerSandboxInner.js';
import * as Logger from '~untrusted/lib/Logger.js';

const l_Function = (() => {}).constructor;
const l_String = String;
const l_ePrototype = Error.prototype;

/**
 * Handles incoming messages and initialises the sandbox if necessary.
 * @param event - The incoming message event.
 */
const listener = (event: MessageEvent) => {
	if (
		/* !event.isTrusted || */ // Node.js doesn't set isTrusted
		!aIsArray(event.data) ||
		event.data[0] !== EMessageTypes.SANDBOX_READY
	)
		return;

	Logger.info('Received SANDBOX_READY from parent. Creating sandbox.');
	globalThis.removeEventListener('message', listener, false);
	// Fix Function prototype
	oDefineProperty(Function, 'prototype', {
		['value']: l_Function.constructor.prototype,
	});
	fnApply(workerSandboxInner, null, aSlice(event.data, 1));
};

/**
 * Recreates an error object from a given input.
 * This ensures that no references are leaked when errors occur.
 * @param e - The input that may be an error.
 * @returns The recreated error object.
 */
const recreateError = (e: unknown): Error => {
	const newError = oCreate(l_ePrototype);
	// try-catch block to prevent leaking references if this function itself
	// errors
	try {
		if (e) {
			newError.message = l_String(
				(e as Error).message ? (e as Error).message : e,
			);
		}
		if (e && (e as Error).stack) {
			newError.stack = l_String((e as Error).stack);
		}
		if (e && (e as Error).name !== 'Error') {
			newError.name = l_String((e as Error).name);
		}
	} catch {
		// empty
	}

	return newError;
};

/**
 * Factory function to create a wrapper for native functions.
 * This wrapper ensures that function calls don't leak references and
 * safely handles any exceptions, recreating them to prevent reference leakage.
 *
 * @template T
 * @param obj - The object containing the function to be wrapped.
 * @returns A function that, when called with a function name, wraps that
 * function.
 */
const nativeWrapperFactory =
	<T extends Record<string, typeof Function.prototype>>(obj: T) =>
	(name: keyof T) => {
		const fn = obj[name];

		if (typeof fn !== 'function') return;

		oDefineProperty(obj, name, {
			['writable']: true,
			['enumerable']: true,
			['configurable']: true,
			['value']: function (...args: unknown[]) {
				try {
					const r = fnApply(fn, obj, args);
					if (typeof r !== 'object' && typeof r !== 'function') {
						return r;
					}
				} catch (e: unknown) {
					throw recreateError(e);
				}
			}.bind(obj),
		});
	};

// These need to be wrapped because they contain references to the parent
// environment
// Then, the parent needs to delete these functions, which it can do when
// it receives SANDBOX_READY in the next step
['atob', 'btoa', 'close', 'clearInterval', 'clearTimeout'].forEach(
	nativeWrapperFactory(
		globalThis as unknown as Parameters<typeof nativeWrapperFactory>[0],
	),
);

if (__buildtimeSettings__.contextifyMessagePort) {
	const messagePort = (() => {
		// Local copy to please TypeScript
		const gT = globalThis as unknown as {
			['%__messagePort__']?: MessagePort;
			[k: PropertyKey]: unknown;
		};
		const messagePort = gT['%__messagePort__'];
		if (typeof messagePort !== 'object') {
			throw 'Missing %__messagePort__';
		}
		delete gT['%__messagePort__'];
		return messagePort;
	})();

	const eventListeners: (typeof Function.prototype)[] = [];

	messagePort.onmessage = (event) => {
		for (let i = 0; i < eventListeners.length; i++) {
			eventListeners[i](event);
		}
	};
	messagePort.start();

	/**
	 * Shim function for the `addEventListener` method.
	 * This ensures that messages passed to the listeners are cloned to prevent
	 * reference leaks, by using the provided MessagePort.
	 * @template T
	 * @param type - The type of event (only `message` is supported)
	 * @param listener - The event listener function.
	 */
	globalThis.addEventListener = function <T extends keyof WindowEventMap>(
		type: T,
		listener: { (e: WindowEventMap[T]): ReturnType<typeof eval> },
	) {
		if (type !== 'message') return;
		aPush(eventListeners, listener);
	}.bind(globalThis) as typeof addEventListener;

	/**
	 * Shim function for the `removeEventListener` method using the
	 * provided MessagePort.
	 * @template T
	 * @param type - The type of event.
	 * @param listener - The event listener function.
	 */
	globalThis.removeEventListener = function <T extends keyof WindowEventMap>(
		type: T,
		listener: { (e: WindowEventMap[T]): ReturnType<typeof eval> },
	) {
		if (type !== 'message') return;
		const index = aIndexOf(eventListeners, listener);
		if (index !== -1) {
			aSplice(eventListeners, index, 1);
		}
	}.bind(globalThis) as typeof removeEventListener;

	globalThis.postMessage = messagePort.postMessage.bind(
		messagePort,
	) as typeof postMessage;
} else {
	const l_WeakMap = WeakMap;
	const l_wmpDelete = WeakMap.prototype.delete;
	const l_wmpGet = WeakMap.prototype.get;
	const l_wmpHas = WeakMap.prototype.has;
	const l_wmpSet = WeakMap.prototype.set;
	const l_wmDelete = <TT extends object, TU>(
		wm: WeakMap<TT, TU>,
		...args: Parameters<typeof wm.delete>
	): ReturnType<typeof wm.delete> => {
		return fnApply(l_wmpDelete, wm, args);
	};
	const l_wmGet = <TT extends object, TU>(
		wm: WeakMap<TT, TU>,
		...args: Parameters<typeof wm.get>
	): ReturnType<typeof wm.get> => {
		return fnApply(l_wmpGet, wm, args);
	};
	const l_wmHas = <TT extends object, TU>(
		wm: WeakMap<TT, TU>,
		...args: Parameters<typeof wm.has>
	): ReturnType<typeof wm.has> => {
		return fnApply(l_wmpHas, wm, args);
	};
	const l_wmSet = <TT extends object, TU>(
		wm: WeakMap<TT, TU>,
		...args: Parameters<typeof wm.set>
	): ReturnType<typeof wm.set> => {
		return fnApply(l_wmpSet, wm, args);
	};

	/**
	 * Provides a shim for the structuredClone function, relying on JSON
	 * Tries to clone a given data object and throws an error if the data
	 * can't be cloned.
	 * @template T
	 * @param {T} data - The data to be cloned.
	 * @returns {T} A clone of the input data.
	 */
	const l_structuredClone =
		typeof structuredClone === 'function'
			? // Local copy to prevent it from being overwritten
			  structuredClone
			: // JSON-based shim
			  (() => {
					// Fallback for when structuredClone is unavailable
					// The goal is to ensure that we don't get references to the
					// parent context. Although structuredClone would be ideal,
					// we can emulate some of its functionality with the JSON
					// utility functions.
					// It doesn't behave quite exactly the same, but it should
					// be reasonably fine.
					// JSON is much more limited in terms of the types it
					// supports, so objects like BigInt, Uint8Array and RegExp
					// will not work.
					// Local copies to prevent them from being overwritten.
					// This is used for *incoming* data, which have already been
					// stuctureClone'd.
					// For *outgoing* data, the host's structuredClone function
					// is relied on to remove references to the sandbox
					const l_JSONparse = JSON.parse;
					const l_JSONstringify = JSON.stringify;

					return function <T>(data: T) {
						try {
							return l_JSONparse(l_JSONstringify(data));
						} catch (e: unknown) {
							const err = oCreate(l_ePrototype, {
								['name']: {
									['configurable']: true,
									['writable']: true,
									['value']: 'DataCloneError',
								},
							});
							if (e != null) {
								oDefineProperty(err, 'message', {
									['configurable']: true,
									['writable']: true,
									['value']: l_String(
										(e as unknown as { message?: string })[
											'message'
										] || e,
									),
								});
							}
							if (e && typeof e === 'object' && 'stack' in e) {
								oDefineProperty(err, 'stack', {
									['configurable']: true,
									['writable']: true,
									['value']: l_String(
										(e as unknown as { stack: string })[
											'stack'
										],
									),
								});
							}
							throw err;
						}
					}.bind(globalThis);
			  })();

	// Messages are forced through structuredClone() to avoid some attack
	// vectors that involve indirect references
	(() => {
		const aEL = globalThis.addEventListener;
		const rEL = globalThis.removeEventListener;

		const eventMap = new l_WeakMap<
			typeof Function.prototype,
			typeof Function.prototype
		>();

		/**
		 * Wrapper function for the `addEventListener` method.
		 * This ensures that messages passed to the listeners are cloned to
		 * prevent reference leaks.
		 * @template T
		 * @param type - The type of event (only `message` is supported)
		 * @param listener - The event listener function.
		 */
		globalThis.addEventListener = (
			function (...args: Parameters<typeof globalThis.addEventListener>) {
				const [type, listener] = args;
				if (
					type !== 'message' ||
					typeof listener !== 'function' ||
					l_wmHas(eventMap, listener)
				)
					return;

				const wrappedListener = (ev: Event) => {
					if (ev.type !== 'message') return;

					oDefineProperty(ev, 'data', {
						['value']: l_structuredClone((ev as MessageEvent).data),
					});
					listener(ev);
				};

				l_wmSet(eventMap, listener, wrappedListener);
				try {
					aEL(type, wrappedListener, false);
				} catch (e) {
					l_wmDelete(eventMap, listener);
					throw recreateError(e);
				}
			} as typeof globalThis.addEventListener
		).bind(globalThis);

		/**
		 * Wrapper function for the `removeEventListener` method.
		 * @template T
		 * @param type - The type of event.
		 * @param listener - The event listener function.
		 */
		globalThis.removeEventListener = (
			function (...args: Parameters<typeof rEL>) {
				const [type, listener] = args;
				if (type !== 'message' || typeof listener !== 'function')
					return;
				const wrappedListener = l_wmGet(eventMap, listener);
				if (wrappedListener) {
					try {
						rEL(
							type,
							wrappedListener as unknown as typeof listener,
							false,
						);
					} catch (e) {
						throw recreateError(e);
					}
					l_wmDelete(eventMap, listener);
				}
			} as typeof rEL
		).bind(globalThis);
	})();

	(() => {
		const pm = globalThis.postMessage;

		if (typeof pm !== 'function') return;

		globalThis.postMessage = (
			function (...args) {
				try {
					// structuredClone is called by the parent, so we don't need
					// to call it here again
					fnApply(
						pm,
						globalThis,
						args as unknown as Parameters<typeof pm>,
					);
				} catch (e) {
					throw recreateError(e);
				}
			} as typeof pm
		).bind(globalThis);
	})();

	if (typeof globalThis['structuredClone'] === 'undefined') {
		oDefineProperty(
			globalThis,
			'structuredClone',
			l_structuredClone.bind(globalThis),
		);
	}
}

(() => {
	const grv = globalThis.crypto?.getRandomValues;

	if (typeof grv !== 'function') return;

	/**
	 * Wrapper function for the `crypto.getRandomValues` method.
	 * Safely retrieves random values and ensures there's no reference leakage.
	 * @template T
	 * @param array - The TypedArray for the random values.
	 * @returns The array filled with random values.
	 */
	globalThis.crypto.getRandomValues = function <
		T extends ArrayBufferView | null,
	>(array: T): T {
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
	}.bind(globalThis);
})();

['setInterval', 'setTimeout'].forEach((v) => {
	const setTimer = (
		globalThis as unknown as Record<
			string,
			{ (...args: unknown[]): unknown }
		>
	)[v];

	if (typeof setTimer !== 'function') return;

	(globalThis as unknown as Record<string, typeof setTimer>)[v] = function (
		...args: Parameters<typeof setTimer>
	): unknown {
		try {
			const callback = args[0] as { (...args: unknown[]): unknown };

			// Wrapper around callback to prevent access to the host Array
			// constructor through references
			args[0] = (...params: unknown[]) => {
				fnApply(callback, globalThis, aFrom(params));
			};

			const ret = setTimer(...args);

			// Warning: this is unsafe because it exposes an Object to the
			// sandbox
			if (__buildtimeSettings__.scopedTimerFunctions) {
				if (typeof ret !== 'number') {
					throw new Error('Unexpected return value');
				}
			}

			return ret;
		} catch (e) {
			throw recreateError(e);
		}
	}.bind(globalThis);
});

Logger.info('Worker started, registering event listener');

globalThis.addEventListener('message', listener, false);
