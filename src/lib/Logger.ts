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

const { trace, debug, info, log } =
	__buildtimeSettings__.buildType === 'debug' && typeof console === 'object'
		? console
		: {
				trace: /* @__PURE__ */ Boolean,
				debug: /* @__PURE__ */ Boolean,
				info: /* @__PURE__ */ Boolean,
				log: /* @__PURE__ */ Boolean,
		  };

const { warn, error } =
	typeof console === 'object'
		? console
		: {
				warn: /* @__PURE__ */ Boolean,
				error: /* @__PURE__ */ Boolean,
		  };

export { trace, debug, info, log, warn, error };
