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

import { aJoin, aMap, cGRV, mR, sFromCharCode, u8Alloc } from './utils.js';

/**
 * Converts a given buffer into a Base16 string (using a custom logic)
 *
 * The conversion is not a standard hexadecimal conversion. It performs specific
 * bitwise operations and character code translations, including:
 *
 * 1. Right shifting the value 4 bits and masking it with 0x0f, then OR'ing it
 * with 0x40.
 * 2. Right shifting the value 0 bits (leaving it unchanged) and masking it with
 * 0x0f, then OR'ing it with 0x40.
 * 3. Adding 1 to both of these values and converting them to ASCII characters.
 *
 * This gives a string with values in the range A-P. This range was chosen
 * because it is an acceptable range for most places and because of the ease
 * of calculation.
 *
 * @param buffer - The buffer that will be converted to a string
 * @returns The string representation of the buffer using the custom logic.
 */
const bufferToHex = (buffer: Uint8Array | number[]) =>
	aJoin(
		aMap(buffer as unknown as number[], (v) =>
			sFromCharCode(
				1 + (0x40 | ((v >> 4) & 0x0f)),
				1 + (0x40 | ((v >> 0) & 0x0f)),
			),
		),
		'',
	);

/**
 * Generates a random secret string using the Crypto API.
 *
 * These secrets are as a flag to serve as a rudimentary check for message
 * provenance (browser sandbox), to generate canary parts in the enhanced
 * sandbox wrapper as well as to generate task IDs.
 *
 * @returns The randomly generated secret as a string.
 */
const getRandomSecret = cGRV
	? // If crypto.getRandomValues is available, use that.
	  (): string =>
			bufferToHex(
				(cGRV as unknown as Crypto['getRandomValues'])(u8Alloc(16)),
			)
	: // Otherwise, use fall back to Math.random. The values might be
	  // predictable, but it should be fine as the strings generated are not
	  // used in contexts that require secrecy as an absolute requirement.
	  (): string =>
			bufferToHex(
				aMap(
					u8Alloc(16) as unknown as number[],
					() => (mR() * 256) | 0,
				),
			);

export default getRandomSecret;
