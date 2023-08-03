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

import * as Logger from '../../lib/Logger.js';
import {
	aFrom,
	aIsArray,
	fnApply,
	oCreate,
	oDefineProperty,
} from '../../lib/utils.js';
import workerSandboxInner from '../worker/workerSandboxInner.js';

const l_Function = (() => {}).constructor;
const l_String = globalThis['String'];
const l_WeakMap = WeakMap;
const l_ePrototype = Error.prototype;
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

// Local copy to prevent it from being overwritten
const l_structuredClone =
	typeof globalThis['structuredClone'] === 'function'
		? globalThis['structuredClone']
		: (() => {
				// Fallback for when structuredClone is unavailable
				// The goal is to ensure that we don't get references to the
				// parent context. Although structuredClone would be ideal,
				// we can emulate some of its functionality with the JSON
				// utility functions.
				// It doesn't behave quite exactly the same, but it should be
				// reasonably fine.
				// JSON is much more limited in terms of the types it supports,
				// so objects like BigInt, Uint8Array and RegExp will not work
				// Local copies to prevent them from being overwritten.
				// This is used for *incoming* data, which have already been
				// stuctureClone'd.
				// For *outgoing* data, the host's structuredClone function is
				// relied on to remove references to the sandbox
				const l_JSONparse = JSON.parse;
				const l_JSONstringify = JSON.stringify;

				return <T>(data: T) => {
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
				};
		  })();

const listener = (event: MessageEvent) => {
	if (
		!event.isTrusted ||
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
	fnApply(workerSandboxInner, null, event.data.slice(1));
};

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

// These need to be wrapped because they contain references to the parent
// environment
// Then, the parent needs to delete these functions, which it can do when
// it receives SANDBOX_READY in the next step
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

['atob', 'btoa', 'close', 'clearInterval', 'clearTimeout', 'Function'].forEach(
	nativeWrapperFactory(
		globalThis as unknown as Parameters<typeof nativeWrapperFactory>[0],
	),
);

// Messages are forced through structuredClone() to avoid some attack
// vectors that involve indirect references
(() => {
	const aEL = globalThis.addEventListener;
	const rEL = globalThis.removeEventListener;

	const eventMap = new l_WeakMap<
		typeof Function.prototype,
		typeof Function.prototype
	>();

	globalThis.addEventListener = (
		function (...args: Parameters<typeof aEL>) {
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
		} as typeof aEL
	).bind(globalThis);

	globalThis.removeEventListener = (
		function (...args: Parameters<typeof rEL>) {
			const [type, listener] = args;
			if (type !== 'message' || typeof listener !== 'function') return;
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
				pm.apply(globalThis, args as unknown as Parameters<typeof pm>);
			} catch (e) {
				throw recreateError(e);
			}
		} as typeof pm
	).bind(globalThis);
})();

(() => {
	const grv = globalThis.crypto?.getRandomValues;

	if (typeof grv !== 'function') return;

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

if (typeof globalThis['structuredClone'] === 'undefined') {
	oDefineProperty(
		globalThis,
		'structuredClone',
		l_structuredClone.bind(globalThis),
	);
}

Logger.info('Worker started, registering event listener');

globalThis.addEventListener('message', listener, false);
