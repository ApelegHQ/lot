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

import { PX } from './utils.js';

type TProxyMaybeRevocable = {
	<T extends object>(
		revocable: boolean | null,
		target: T,
		handler: ProxyHandler<T>,
	): {
		proxy: T;
		revoke: () => void;
	};
};

/**
 * Creates either a revocable or non-revocable Proxy based on the value of
 * `revocable`.
 *
 * When `revocable` is true, a standard revocable Proxy is created using
 * `Proxy.revocable()`.
 * If `revocable` is false or not provided, a regular object is constructed.
 * If `revocable` is `null`, the first argument from `args` is returned as
 * the `proxy` without modification.
 *
 * @param revocable - Determines the type of Proxy to create.
 * @param args - Arguments to pass to the Proxy or custom Proxy constructor.
 * @returns An object containing the Proxy and a revoke function, mimicking the
 * structure returned by `Proxy.revocable`.
 */
const proxyMaybeRevocable: TProxyMaybeRevocable = (revocable, ...args) => {
	if (revocable) {
		return Proxy.revocable(...args);
	}
	return {
		['proxy']: revocable === null ? args[0] : new PX(...args),
		['revoke']: Boolean,
	};
};

export default proxyMaybeRevocable;
