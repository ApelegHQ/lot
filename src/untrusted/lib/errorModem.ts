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
	aForEach,
	aIncludes,
	aIsArray,
	aMap,
	E,
	oCreate,
	oDefineProperty,
	oHasOwnProperty,
	S,
} from './utils.js';

const MAX_DEPTH = 3;

/* General note about this file:

Since most communication happens through the MessagePort interface, these
functions are technically not needed. However, in practice it is, because
`structuredClone` doesn't work as it should.

  - On Firefox, `structuredClone(Error())` results in a DOMException
    (DataCloneError)
  - On Node.js, `try { structuredClone(structuredClone) } catch (e) {
    structuredClone(e) }` incorrectly results in an empty object (instead of
    cloning a DataCloneError).

*/

/**
 * Extracts error information from the given value, optionally including information about
 * nested causes to a specified depth.
 *
 * 1. If the input is neither an object nor a function, it's returned as-is.
 * 2. If the input is an Error object or has a 'stack' property, the function
 * extracts the 'name', 'message', and 'stack' properties and returns them as
 * an array of strings.
 * 3. If the input includes a 'cause' property and the depth of extraction is
 * within limits, the function recursively extracts information from the cause
 * as well.
 * 4. If none of the above conditions are met, the function returns the string
 * representation of the input.
 *
 * @param e - The input value, possibly an error object, from which information
 * will be extracted.
 * @param depth - Optional. The current depth of extraction, used for recursive
 * cause extraction. If not specified or if within the maximum depth limit
 * (MAX_DEPTH), the extraction will include nested cause information.
 * @returns The extracted error information, possibly including an array of
 * strings for the 'name', 'message', and 'stack' properties, along with
 * recursively extracted cause information. If the input does not match known
 * error patterns, the return value may be a string or the unmodified input.
 */
const extractErrorInformation = (e: unknown, depth?: number) => {
	if (!aIncludes(['object', 'function'], typeof e)) {
		return e;
	} else if (e && (e instanceof E || oHasOwnProperty(e, 'stack'))) {
		const d: unknown[] = aMap(['name', 'message', 'stack'], (p) => {
			try {
				return S(e[p as unknown as keyof typeof e]);
			} catch {
				return '';
			}
		});

		if ((!depth || depth < MAX_DEPTH) && oHasOwnProperty(e, 'cause')) {
			d[3] = extractErrorInformation(
				(e as Error & { cause: unknown })['cause'],
				depth ? depth + 1 : 1,
			);
		}

		return d;
	} else {
		return S(e);
	}
};

/**
 * Reconstructs an Error object from the provided information, optionally
 * including nested causes to a specified depth.
 *
 * The function takes an array of information that was extracted using the
 * `extractErrorInformation` function, and attempts to reconstruct an Error
 * object or a specific error class from the information.
 *
 * 1. If the input is an array of length 3 or 4, and the third element is a
 * string, the function attempts to reconstruct the error.
 * 2. The function looks for a global error class matching the provided name,
 * and falls back to the generic Error class if none is found.
 * 3. It assigns the 'name', 'message', and 'stack' properties from the input
 * array, and may recursively assign a 'cause' property if depth is within
 * limits (MAX_DEPTH).
 * 4. If the reconstruction conditions are not met, the input is returned as-is.
 *
 * @param d - The input information, potentially an array containing 'name',
 * 'message', 'stack', and optionally 'cause' values.
 * @param depth - Optional. The current depth of reconstruction, used for
 * recursive cause reconstruction. If not specified or if within the maximum
 * depth limit (MAX_DEPTH), the reconstruction will include nested cause
 * information.
 * @returns The reconstructed Error object, or the unmodified input if the
 * input does not match known reconstruction patterns.
 */
const reconstructErrorInformation = (d: unknown, depth?: number) => {
	if (
		aIsArray(d) &&
		d.length &&
		(d.length === 3 || d.length === 4) &&
		typeof d[2] === 'string'
	) {
		const errorClass =
			oHasOwnProperty(globalThis, d[0] as PropertyKey) &&
			typeof globalThis[d[0] as 'Error'] === 'function' &&
			globalThis[d[0] as 'Error'].prototype instanceof E
				? globalThis[d[0] as 'Error']
				: E;

		const e = oCreate(errorClass.prototype);

		aForEach(['name', 'message', 'stack'], (p, i) => {
			try {
				if (d[i] !== e[p]) {
					oDefineProperty(e, p, {
						['configurable']: true,
						['writable']: true,
						['value']: S(d[i]),
					});
				}
			} catch {
				// reading or setting a property might fail
			}
		});

		if ((!depth || depth < MAX_DEPTH) && d.length === 4) {
			try {
				oDefineProperty(e, 'cause', {
					['configurable']: true,
					['writable']: true,
					['value']: reconstructErrorInformation(
						d[3],
						depth ? depth + 1 : 1,
					),
				});
			} catch (e) {
				// reading or setting a property might fail
			}
		}

		return e;
	}

	return d;
};

export { extractErrorInformation, reconstructErrorInformation };
