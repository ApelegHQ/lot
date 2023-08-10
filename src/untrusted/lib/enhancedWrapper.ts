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
import getRandomSecret from './getRandomSecret.js';
import { E, cGRV, mR, sSlice, u8Alloc } from './utils.js';

const enhancedWrapper = (script: string): string => {
	if (
		!__buildtimeSettings__.dynamicCodeGeneration &&
		script.indexOf('__canary$zzby$') !== -1
	) {
		throw E('__canary$zzby$ inside script not supported');
	}

	// It is possible for a malicious script to escape the
	// with block by ending with `});} { <code here >; ({`
	// This is imperfectly mitigated by adding a random number of
	// braces
	// Math.random is fine here as it's a fallback and, while not
	// ideal, it's also better than nothing
	const guardCount = __buildtimeSettings__.dynamicCodeGeneration
		? ((cGRV ? cGRV(u8Alloc(1))[0] : (mR() * 128) | 0) & 0x7f) + 1
		: 0;
	const canary = __buildtimeSettings__.dynamicCodeGeneration
		? getRandomSecret()
		: '';
	const canaryStart = __buildtimeSettings__.dynamicCodeGeneration
		? sSlice(canary, 0, canary.length / 2)
		: '';
	const canaryMid = __buildtimeSettings__.dynamicCodeGeneration
		? sSlice(canary, canary.length / 4, canary.length / 2)
		: '';
	const canaryEnd = __buildtimeSettings__.dynamicCodeGeneration
		? sSlice(canary, canary.length / 2)
		: '';

	const fixGlobals = __buildtimeSettings__.fixGlobalTypes
		? `~function(){${fixGlobalTypes.default}}();`
		: '';

	// The 'with' block restricts access to the global scope
	return __buildtimeSettings__.dynamicCodeGeneration
		? 'with(this){' +
				fixGlobals +
				`(function(){` +
				"'use strict';" +
				// The canary is an additional mechanism to ensure that if the
				// code after 'script' is skipped, it will throw because it
				// doesn't know the variable name or its contents, even if it
				// managed to guess the guardCount variable
				`var __canary$${canaryStart}__=` +
				'(function(_){' +
				`_="${canaryEnd}";` +
				`return function(){this.__canary${canaryMid}__=_;}.bind(this)` +
				'})' +
				'.call(this);' +
				// The guard makes it difficult for the script to execute code
				// outside of the 'with' block by having it guess the correct
				// number of parentheses it needs to inject. Since guardCount
				// is random, it cannot be guessed deterministically.
				'('.repeat(guardCount) +
				// Function arguments to shadow canary values
				`function(__canary$${canaryStart}__,__canary${canaryMid}__){` +
				'\r\n' +
				script +
				// Prevent the script from excluding the following code
				// via comments or template strings
				'\r\n/*`*/' +
				'}' +
				')'.repeat(guardCount) +
				'.call(globalThis);' +
				`__canary$${canaryStart}__();` +
				'}).call(this);' +
				'}' + // End `with`
				`if("${canaryEnd}"!==this.__canary${canaryMid}__)` +
				'throw "__canary__";' +
				`delete this.__canary${canaryMid}__;`
		: 'const __canary$zzby$t__=' +
				'(' +
				'function(_){' +
				'this.__canary$zzby$f__=_={};' +
				'return function(){return _!==this.__canary$zzby$f__;};' +
				'})' +
				'.call(this);' +
				// Outer function shadows __canary$zzby$t__ to avoid
				// reassignment of the trap function (like using `const`)
				'(function(__canary$zzby$t__,arguments){' +
				'with(this){' +
				fixGlobals +
				'(function(){' +
				"'use strict';" +
				// The canary is an additional mechanism to ensure that if the
				// code after 'script' is skipped, it will throw because it
				// doesn't know the variable name or its contents, even if it
				// managed to guess the guardCount variable
				'var __canary$zzby$s__=' +
				'(function(_){' +
				'delete this.__canary$zzby$f__;' +
				'return function(){this.__canary$zzby$f__=_;_=void 0;}.bind(this)})' +
				'.call(this,this.__canary$zzby$f__);' +
				// No parenthesis-based guard when not using dynamic code
				// generation (single parenthesis pair used)
				'(' +
				// Function arguments to shadow canary values
				'function(__canary$zzby$s__,__canary$zzby$f__){' +
				'\r\n' +
				script +
				// Prevent the script from excluding the following code
				// via comments or template strings
				'\r\n/*`*/' +
				'}' +
				')' +
				'.call(globalThis);' +
				'__canary$zzby$s__();' +
				'}).call(this);' +
				'}' + // End `with`
				'}).call(this);' +
				'if(__canary$zzby$t__.call(this))' +
				'throw "__canary__";' +
				'delete this.__canary$zzby$f__;';
};

export default enhancedWrapper;
