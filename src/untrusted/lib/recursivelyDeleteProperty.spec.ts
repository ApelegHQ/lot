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
import recursivelyDeleteProperty from './recursivelyDeleteProperty.js';

describe('recursivelyDeleteProperty', () => {
	it('should delete a property from the object itself', () => {
		const obj = { prop: 'value', anotherProp: 'anotherValue' };
		recursivelyDeleteProperty(obj, 'prop');

		assert.equal('prop' in obj, false);
		assert.equal('anotherProp' in obj, true);
	});

	it("should delete a property from the object's prototype chain", () => {
		const prototypeObj = { prop: 'value' };
		const obj = Object.create(prototypeObj);
		obj.anotherProp = 'anotherValue';

		recursivelyDeleteProperty(obj, 'prop');

		assert.equal('prop' in obj, false);
		assert.equal('anotherProp' in obj, true);
	});

	it('should not delete a property if it does not exist in the object or its prototype chain', () => {
		const prototypeObj = { prop: 'value' };
		const obj = Object.create(prototypeObj);
		obj.anotherProp = 'anotherValue';

		recursivelyDeleteProperty(obj, 'nonexistentProp' as keyof typeof obj);

		assert.equal('prop' in obj, true);
		assert.equal('anotherProp' in obj, true);
	});
});
