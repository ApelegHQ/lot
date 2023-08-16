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

const noop: { (...args: unknown[]): unknown } = /* @__PURE__ */ () => {};

const debugOnlyLogWrapper = <T extends object>(o: T, v: keyof T) =>
	__buildtimeSettings__.buildType === 'debug' && typeof o === 'object'
		? o[v]
		: noop;

const logWrapper = <T extends object>(o: T, v: keyof T) =>
	__buildtimeSettings__.buildType === 'debug' && typeof o === 'object'
		? o[v]
		: noop;

const trace = debugOnlyLogWrapper(console, 'trace');
const debug = debugOnlyLogWrapper(console, 'debug');
const info = debugOnlyLogWrapper(console, 'info');
const log = debugOnlyLogWrapper(console, 'log');
const warn = logWrapper(console, 'warn');
const error = logWrapper(console, 'error');

export { trace, debug, info, log, warn, error };
