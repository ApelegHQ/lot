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

import global from '../../untrusted/lib/global.js';

const helper = (v: number) => v.toString(16).padStart(4, '0');

/**
 * Generates a random UUID (Universally Unique Identifier) using the Crypto API.
 *
 * If `crypto.randomUUID` is available, it's bound and used directly. Otherwise,
 * a custom logic is applied to generate the UUID:
 *
 * 1. Obtains a random array of 8 × 16-bit values using `getRandomValues`.
 * 2. Applies specific bitwise operations to elements at positions 3 and 4 of
 * the array to conform to the UUID specification.
 * 3. Maps the array segments into string parts using a helper function, and
 * joins them with '-'.
 *
 * The generated UUID adheres to the standard UUID v4 format.
 *
 * @returns The randomly generated UUID, in the format of
 * "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".
 * Here 'x' is any hexadecimal digit and 'y' is one of 8, 9, A or B.
 */
const getRandomUuid: typeof global.crypto.randomUUID = global.crypto?.randomUUID
	? global.crypto.randomUUID.bind(global.crypto)
	: () => {
			const uuid = global.crypto.getRandomValues(new Uint16Array(8));
			uuid[3] = (uuid[3] & 0x0fff) | 0x4000;
			uuid[4] = (uuid[4] & 0x3fff) | 0x8000;
			return [[0, 1], [2], [3], [4], [5, 6, 7]]
				.map((p) => p.map((i) => helper(uuid[i])).join(''))
				.join(
					'-',
				) as `${string}-${string}-${string}-${string}-${string}`;
	  };

export default getRandomUuid;
