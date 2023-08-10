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

import { oCreate } from './utils.js';

/**
 * A property descriptor that defines properties for a CommonJS-like module
 * object.
 *
 * This descriptor is structured to support the `module.exports` pattern,
 * commonly found in CommonJS module systems. The `exports` property within
 * allows the assignment of exported values, separating internal logic
 * from what is shared or exported to other modules.
 *
 * @property value - An object representing the main property attributes.
 * @property value.exports - An object created with a null prototype to store
 * exported values.
 * @property value.exports.value - The value to be exported, initially an empty
 * object.
 * @property value.exports.writable - Indicates if the `exports` property can be
 * changed.
 * @property value.exports.enumerable - Makes the `exports` property show up
 * during enumeration.
 * @property value.exports.configurable - Indicates if the property can be
 * deleted or changed.
 */
const modulePropertyDescriptor: PropertyDescriptor = {
	['value']: oCreate(null, {
		['exports']: {
			['value']: oCreate(null),
			['writable']: true,
			['enumerable']: true,
			['configurable']: true,
		},
	}),
};

export default modulePropertyDescriptor;
