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

import * as fixGlobalTypes from 'inline:./fixGlobalTypes.inline.js';
import censorUnsafeExpressions from './censorUnsafeExpressions.js';
import functionContextWrapper from './functionContextWrapper.js';
import { TE } from './utils.js';

const syntaxCheckWrapper = (script: string) =>
	'"use strict";for(;;)/*@lint@*/;\r\n' + script;

/**
 * Create a sandboxed wrapper function.
 * This function is meant to be used in combination with the other utilities in
 * this file to constrain its execution to a specific context.
 * It can censor unsafe expressions and wrap the script with an enhanced
 * wrapper, if configured.
 *
 * @template T - A generic type representing a function.
 * @param script - The script to be wrapped.
 * @param functionConstructor - The constructor function.
 * @returns A sandboxed version of the provided script.
 * @throws {TypeError} Will throw an error if script is not a string.
 */
const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	functionConstructor: T,
): ReturnType<T> => {
	if (typeof script !== 'string') {
		throw TE('called on incompatible ' + typeof script);
	}

	if (__buildtimeSettings__.censorUnsafeExpressions) {
		script = censorUnsafeExpressions(script);
	}

	// First, simply call function constructor on the script to validate
	// syntax. The result is explicitly marked as void to mean that the
	// result must be thrown away
	{
		void functionConstructor(syntaxCheckWrapper(script));
	}

	script = functionContextWrapper(
		script,
		__buildtimeSettings__.fixGlobalTypes
			? `~function(){${fixGlobalTypes.default}}();`
			: '',
	);

	const sandboxWrapperFn = functionConstructor(script);

	return sandboxWrapperFn;
};

export default createWrapperFn;
export { syntaxCheckWrapper };
