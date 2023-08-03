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

import { oGetPrototypeOf, oHasOwnProperty } from './utils.js';

/**
 * Recursively deletes a property from an object or its prototype chain.
 *
 * @template T - The object type.
 * @param o - The object from which the property should be deleted.
 * @param p - The property name to delete from the object.
 * @returns - This function does not return a value.
 *
 * @example
 * const obj = Object.create({ prop: 'value' });
 * // deletes 'prop' from the object's prototype
 * recursivelyDeleteProperty(obj, 'prop');
 */
const recursivelyDeleteProperty = <T extends object>(o: T, p: keyof T) => {
	while (o && p in o) {
		if (oHasOwnProperty(o, p)) {
			delete o[p];
			return;
		}
		o = oGetPrototypeOf(o);
	}
};

export default recursivelyDeleteProperty;
