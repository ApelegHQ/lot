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

import * as iframeSandboxInit from 'inline:./iframeSandboxInit.inline.js';
import EMessageTypes from '../../EMessageTypes.js';
import getRandomSecret from '../../lib/getRandomSecret.js';
import setupSandboxListeners from '../../lib/setupSandboxListeners.js';
import { ISandbox } from '../../types/index.js';
import type iframeSandboxInner from './iframeSandboxInner.js';

const browserSandbox: ISandbox = async (
	script,
	allowedGlobals,
	externalMethods,
	abort,
	options,
) => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethods) {
		throw new TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const secret = getRandomSecret();
	const initMesssageKeyA = getRandomSecret();
	const initMesssageKeyB = getRandomSecret();
	const nonce = getRandomSecret();

	const html = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Sandbox</title><script crossorigin="anonymous" integrity="${iframeSandboxInit.sri}" nonce="${nonce}" src="data:;base64,${iframeSandboxInit.contentBase64}" type="text/javascript"></script></head><body></body></html>`;

	const iframe = document.createElement('iframe');
	const blob = new Blob([html], { type: 'application/xhtml+xml' });

	// Request that the iframe be isolated from its parent, with the ability
	// to run scripts.
	iframe.setAttribute('sandbox', 'allow-scripts');
	// CSP for iframe set to trust the given loader script and any subsequent
	// scripts it might load, which is necessary for the fallback mechanism in
	// case the worker could not be started.
	// This CSP is further adjusted dynamically once the sandbox is created to
	// entirely prohibit new scripts.
	// If the fallback mechanism is disabled, then it's possible to
	// remove the 'unsafe-inline' (used as a fallback for older browsers that
	// don't support CSP 3) and 'strict-dynamic' parts (used for newer browsers)
	// TODO: Improve CSP. Seems like unsafe-eval is required with newer Chrome
	// to be able to call Function
	iframe.setAttribute(
		'csp',
		__buildtimeSettings__.isolationStategyIframeSole
			? `default-src 'none'; script-src 'nonce-${nonce}' '${iframeSandboxInit.sri}' 'unsafe-eval' 'unsafe-inline' 'strict-dynamic'; script-src-attr 'none'; worker-src blob:`
			: `default-src 'none'; script-src 'nonce-${nonce}' '${iframeSandboxInit.sri}' 'unsafe-eval'; script-src-attr 'none'; worker-src blob:`,
	);
	const iframeSrcUrl = self.URL.createObjectURL(blob);
	iframe.setAttribute(
		'src',
		iframeSrcUrl + '#' + initMesssageKeyA + '-' + initMesssageKeyB,
	);
	Object.assign(iframe.style, {
		['display']: 'none',
		['position']: 'absolute',
		['visibility']: 'hidden',
		['opacity']: '0',
		['top']: '-9999px',
		['left']: '-9999px',
		['width']: '1px',
		['height']: '1px',
	});
	document.body.appendChild(iframe);

	if (!iframe.contentWindow) {
		throw new Error('Unable to get iframe content window');
	}

	const sandboxIframeCW = iframe.contentWindow;

	const sendSourceEventListener = (event: MessageEvent) => {
		if (
			!event.isTrusted ||
			event.source !== sandboxIframeCW ||
			!Array.isArray(event.data) ||
			event.data.length !== 2 ||
			event.data[1] !== EMessageTypes.SANDBOX_READY ||
			event.data[0] !== initMesssageKeyA
		)
			return;

		self.removeEventListener('message', sendSourceEventListener, false);

		postMessageOutgoing([
			initMesssageKeyB,
			EMessageTypes.SANDBOX_READY,
			...([
				String(script),
				!!abort,
				allowedGlobals?.map(String),
				externalMethods && Object.keys(externalMethods),
				self.location.origin,
				secret,
			] as Parameters<typeof iframeSandboxInner>),
		]);
	};

	self.addEventListener('message', sendSourceEventListener);

	// The targetOrigin is set to '*' because the correct value of 'null' is not
	// accepted as a valid origin. Although this is not ideal, it's also not much
	// worse than setting it to 'null', since it still doesn't fully an uniquely
	// identify the origin
	const postMessageOutgoing = (data: unknown[]) =>
		sandboxIframeCW.postMessage([secret, ...data], '*');

	const onDestroy = () => {
		self.removeEventListener('message', sendSourceEventListener, false);
		abort?.removeEventListener('abort', onDestroy, false);
		iframe.remove();
	};

	abort?.addEventListener('abort', onDestroy, false);

	return setupSandboxListeners(
		self,
		'null',
		sandboxIframeCW,
		secret,
		false,
		postMessageOutgoing,
		Promise.resolve.bind(Promise),
		externalMethods,
		abort,
	)
		.catch((e) => {
			onDestroy();
			throw e;
		})
		.finally(() => {
			self.URL.revokeObjectURL(iframeSrcUrl);
		});
};

export default browserSandbox;
