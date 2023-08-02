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
 * PERFORMANCE 5OF THIS SOFTWARE.
 */

/**
 * Censors the use of the `import` keyword in a given script.
 * Replaces occurrences of "import" with an escaped version, except when
 * preceded by exactly a single dot (`.`).
 *
 * This function aims to prevent import expressions from being used, as they
 * may be used to load arbitrary code.
 *
 * @param script - The script to be processed.
 * @returns The modified script with "import" occurrences censored where
 * applicable.
 */
const censorUnsafeExpressions = (script: string): string => {
	// Remove import expresions from the code by introducing an escape sequence
	// Strings are unaffected, but using the import keyword will trigger a
	// syntax error
	// This supports properties called 'import', but they must be quoted
	// TODO: Improve regex to support things like { import: 123 } and
	// { import() { return } } (seems difficult without a lot of parsing)
	// Regex: makes an exception for .import so long as there is exactly one
	// dot
	// {
	//	"   import": "   im\\u0070ort",
	//	"  .import": "  .import",
	//	" ..import": " ..im\\u0070ort",
	//	"...import": "...im\\u0070ort",
	//	"import0": "import0",
	//	"0import": "0import",
	//	"ximportx": "ximportx",
	//	"import_": "import_",
	//	"_import": "_import",
	//	"_import_": "_import_"
	//	"import:": "im\\u0070ort:",
	// }
	return script.replace(/\b(?<=(?:^|[^.]|[.]{2}))import\b/g, 'im\\u0070ort');
};

export default censorUnsafeExpressions;
