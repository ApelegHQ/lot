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

/**
 * Wraps the provided script string with security enhancements to mitigate
 * potential malicious behaviours during its dynamic evaluation. This function
 * leverages a series of techniques to ensure the user script is sandboxed:
 *
 * - **`with` Statement**: Reduces the user script's scope, preventing it from
 * accessing the global scope directly.
 * - **'use strict' Mode**: Enforces stricter parsing and error handling on the
 * wrapped code, as well as limiting access to the real global scope via the
 * `this` keyword.
 *
 * @param script - The raw user-provided script to be wrapped.
 * @param preamble - Additional code to execute before the user-provided script
 * @returns The script wrapped with security enhancements.
 */
const functionContextWrapper = (script: string, preamble?: string): string => {
	if (!preamble) {
		preamble = '';
	}

	// The 'with' block restricts access to the global scope
	return (
		'/*@user text(wrapper)@*/with(this){' +
		preamble +
		`(function(){` +
		'"use strict";' +
		'(' +
		'function(){/*@user text(start)@*/' +
		'\r\n' +
		script +
		'\r\n/*@user text(end)@*/;}' +
		')' +
		'.call(globalThis);' +
		'}).call(this);' +
		'}'
	);
};

export default functionContextWrapper;
