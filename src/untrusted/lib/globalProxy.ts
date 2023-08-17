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
	oCreate,
	oDefineProperty,
	oGetOwnPropertyDescriptor,
	oGetPrototypeOf,
	oHasOwnProperty,
	oKeys,
} from './utils.js';

import modulePropertyDescriptor from './modulePropertyDescriptor.js';

type TGlobalProxy<T> = T & {
	['module']: { ['exports']: unknown };
	['exports']: unknown;
};

/**
 * Creates a proxy object that mirrors the provided context, with special
 * handling for specific properties such as 'module'. The returned object
 * includes both the proxy and a 'revoke' function to invalidate it.
 *
 * This proxy is meant to be used as the context for a `with` statement to act
 * as if it were the global context from the perspective of the code running
 * within this statement.
 *
 * The proxy:
 * - Blocks getting and getting the descriptor of symbols
 * (to handle, for example, `Symbol.unscopables`).
 * - Handles 'module' property differently (i.e., outside of the context)
 * - Forces 'has' to always return `true` to keep the `with` statement
 * constrained.
 * - Prohibits some actions like preventing extensions or setting the prototype.
 *
 * @template T - The type of the context object.
 * @param ctx - The context object to create the proxy for.
 * @returns An object containing the proxy and the revoke function.
 */
const globalProxy = <T extends object>(
	ctx: T,
): {
	['proxy']: TGlobalProxy<T>;
	['revoke']: { (): void };
} => {
	const globalProxyTarget = oCreate(oGetPrototypeOf(ctx), {
		// 'module' property is special because it acts as if it weren't
		// globabally scoped (i.e., module !== globalThis.module)
		['module']: modulePropertyDescriptor,
	});
	globalProxyTarget['exports'] = globalProxyTarget['module']['exports'];

	const proxyObj = Proxy.revocable<TGlobalProxy<T>>(globalProxyTarget, {
		['defineProperty'](o, p, a) {
			if (p === 'module') return false;
			if (p === 'exports' && oHasOwnProperty(o, p)) {
				oDefineProperty(o, p, a);
				return true;
			}
			oDefineProperty(ctx, p, a);
			return true;
		},
		['deleteProperty']: (o, p) => {
			if (p === 'module') return false;
			if (p === 'exports' && oHasOwnProperty(o, p)) {
				return delete o[p];
			}
			return delete ctx[p as keyof T];
		},
		['get'](o, p) {
			// Block getting symbols
			// This is especially relevant for [Symbol.unscopables]
			// Getting/setting symbols on the inner proxy (using
			// a self reference) should work fine
			if (typeof p !== 'string') {
				// This never throws because the proxy is just for
				// an empty object
				return;
			}
			if (p === 'module' || (p === 'exports' && oHasOwnProperty(o, p)))
				return o[p];
			return ctx[p as keyof T];
		},
		['getOwnPropertyDescriptor'](o, p) {
			// Block getting symbols
			// This is especially relevant for [Symbol.unscopables]
			// Getting/setting symbols on the inner proxy (using
			// a self reference) should work fine
			if (typeof p !== 'string') {
				return;
			}
			if (p === 'module' || (p === 'exports' && oHasOwnProperty(o, p))) {
				return oGetOwnPropertyDescriptor(o, p);
			}
			return oGetOwnPropertyDescriptor(ctx, p);
		},
		['has']() {
			// This is crucial to ensure that the `with` statement
			// remains contrained and does not access the real
			// global scope. `has` must always return `true`.
			return true;
		},
		['ownKeys']() {
			return oKeys(ctx);
		},
		['preventExtensions']() {
			return false;
		},
		['set'](o, p, v) {
			if (p === 'module') return false;
			if (p === 'exports' && oHasOwnProperty(o, p)) {
				o[p] = v;
				return true;
			}
			ctx[p as keyof T] = v;
			return true;
		},
		['setPrototypeOf']() {
			return false;
		},
	});

	return proxyObj;
};

export default globalProxy;
