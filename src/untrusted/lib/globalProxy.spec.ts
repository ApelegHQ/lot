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
import globalProxy from './globalProxy.js';

describe('globalProxy', () => {
	it('should create a proxy with correct behaviour', () => {
		const ctx: Record<PropertyKey, unknown> = {
			prop: 42,
			module: 'testModule',
		};
		const { proxy, revoke } = globalProxy(ctx);

		// Test normal property access
		assert.equal(proxy.prop, 42);

		// Test 'module' property behaviour
		assert.notEqual(proxy.module, 'testModule');
		assert.equal(typeof proxy.module, 'object');
		assert.ok(
			Object.prototype.hasOwnProperty.call(proxy.module, 'exports'),
		);
		assert.equal(typeof proxy.module.exports, 'object');

		// Test symbol blocking
		const symbolKey = Symbol('key');
		assert.ok(symbolKey in proxy);
		assert.ok(!Object.prototype.hasOwnProperty.call(proxy, symbolKey));
		ctx[symbolKey] = 'value';
		assert.equal(proxy[symbolKey], undefined);

		// Test setting property
		assert.ok('newProp' in proxy);
		assert.ok(!Object.prototype.hasOwnProperty.call(proxy, 'newProp'));
		proxy.newProp = 'value';
		assert.ok(Object.prototype.hasOwnProperty.call(proxy, 'newProp'));
		assert.equal(ctx.newProp, 'value');

		// Test deleting property
		delete proxy.newProp;
		assert.ok(!Object.prototype.hasOwnProperty.call(proxy, 'newProp'));
		assert.ok('newProp' in proxy);
		assert.equal(ctx.newProp, undefined);

		// Test 'ownKeys'
		assert.deepEqual(Object.keys(proxy), ['prop']);

		// Test revoking
		revoke();
		assert.throws(() => {
			void proxy.prop;
		}, TypeError);
	});
});
