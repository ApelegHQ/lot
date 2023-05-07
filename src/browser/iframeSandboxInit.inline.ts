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

import iframeSandboxInner from './iframeSandboxInner.js';

// Exceptions to throw
class InvalidOrUnsupportedStateError extends Error {}

// Entry point
const browserOnLoad = function (handler: { (): void }) {
	if (['interactive', 'complete'].includes(document.readyState)) {
		// The page has already loaded and the 'DOMContentLoaded'
		// event has already fired
		// Call handler directly
		setTimeout(handler, 0);
	} else if (typeof document.addEventListener === 'function') {
		// 'DOMContentLoaded' has not yet fired
		const listener = function () {
			if (typeof document.removeEventListener === 'function') {
				// Remove the event listener to avoid double firing
				document.removeEventListener('DOMContentLoaded', listener);
			}

			// Call handler on 'DOMContentLoaded'
			handler();
		};
		// Set an event listener on 'DOMContentLoaded'
		document.addEventListener('DOMContentLoaded', listener);
	} else {
		// The page has not fully loaded but addEventListener isn't
		// available. This shouldn't happen.
		throw new InvalidOrUnsupportedStateError();
	}
};

const onLoadHandler = Proxy.revocable(() => {
	onLoadHandler.revoke();
	if (document.currentScript) {
		document.currentScript.remove();
	}
	const elementId = self.location.hash.slice(1);
	const el = document.getElementById(elementId);
	if (!(el instanceof HTMLScriptElement)) throw Error();
	el.remove();
	const args = JSON.parse(el.text);
	if (!Array.isArray(args) || args.length !== 4) throw Error();
	iframeSandboxInner.apply(
		globalThis,
		args as Parameters<typeof iframeSandboxInner>,
	);
}, {});

browserOnLoad(onLoadHandler.proxy);
