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

import assert from 'node:assert/strict';
import proxyMaybeRevocable from './proxyMaybeRevocable.js';

describe('proxyMaybeRevocable', () => {
	it('should return a revocable Proxy when revocable is true', () => {
		const target: Record<PropertyKey, unknown> = {};
		const handler: ProxyHandler<typeof target> = {
			get: (obj, prop) => (prop in obj ? obj[prop] : 42),
		};

		const { proxy, revoke } = proxyMaybeRevocable(true, target, handler);

		assert.equal(proxy.someNonExistentProp, 42);

		revoke();

		assert.throws(() => {
			void proxy.someNonExistentProp;
		}, TypeError);
	});

	it('should return a regular Proxy when revocable is false or not provided', () => {
		const target: Record<PropertyKey, unknown> = {};
		const handler: ProxyHandler<typeof target> = {
			get: (obj, prop) => (prop in obj ? obj[prop] : 42),
		};

		const { proxy, revoke } = proxyMaybeRevocable(false, target, handler);
		assert.equal(proxy.someNonExistentProp, 42);

		revoke();

		assert.equal(proxy.someNonExistentProp, 42);
	});

	it('should return the first argument from args when revocable is null', () => {
		const someObject = {};
		const result = proxyMaybeRevocable(null, someObject, someObject);

		assert.strictEqual(result.proxy, someObject);
	});
});
