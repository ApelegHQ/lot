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
import { EMessageTypes } from '../EMessageTypes.js';
import { reconstructErrorInformation } from '../lib/errorModem.js';
import getRandomSecret from '../lib/getRandomSecret.js';
import * as Logger from '../lib/Logger.js';
import performTaskFactory from '../lib/performTaskFactory.js';
import requestHandler from '../lib/requestHandler.js';
import type iframeSandboxInner from './iframeSandboxInner.js';

// Timeout for worker initialisation (in ms)
const ERROR_TIMEOUT = 4000;

const browserSandbox = async (
	script: string,
	allowedGlobals: string[] | undefined,
	externalMethods?: Record<string, typeof Function.prototype> | null,
	abort?: AbortSignal,
) => {
	const secret = getRandomSecret();
	const sourceScriptElementId = getRandomSecret();
	const nonce = getRandomSecret();

	const html = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Sandbox</title><script type="application/json" id="${sourceScriptElementId}">${JSON.stringify(
		[
			String(script),
			allowedGlobals?.map(String),
			externalMethods && Object.keys(externalMethods),
			self.location.origin,
			secret,
		] as Parameters<typeof iframeSandboxInner>,
	)
		.split('&')
		.join('\\u0026')
		.split('>')
		.join('\\u003e')
		.split('<')
		.join('\\u003c')}</script><script crossorigin="anonymous" integrity="${
		iframeSandboxInit.sri
	}" nonce="${nonce}" src="data:;base64,${
		iframeSandboxInit.contentBase64
	}" type="text/javascript"></script></head><body></body></html>`;

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
	// TODO: If the fallback mechanism is disabled, then it's possible to
	// remove the 'unsafe-inline' (used as a fallback for older browsers that
	// don't support CSP 3) and 'strict-dynamic' parts (used for newer browsers)
	iframe.setAttribute(
		'csp',
		`default-src 'none'; script-src 'nonce-${nonce}' '${iframeSandboxInit.sri}' 'unsafe-inline' 'strict-dynamic'; script-src-attr 'none'; worker-src blob:`,
	);
	const iframeSrcUrl = self.URL.createObjectURL(blob);
	iframe.setAttribute('src', iframeSrcUrl + '#' + sourceScriptElementId);
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

	const postMessageOutgoing = (data: unknown[]) =>
		sandboxIframeCW.postMessage([secret, ...data], '*');

	const [performTask, resultHandler, destroyTaskPerformer] =
		performTaskFactory(postMessageOutgoing);

	const eventListener = (event: MessageEvent) => {
		if (
			!event.isTrusted ||
			event.origin !== 'null' ||
			event.source !== sandboxIframeCW ||
			!Array.isArray(event.data) ||
			event.data[0] !== secret
		)
			return;

		if (event.data[1] === EMessageTypes.REQUEST) {
			Logger.debug(
				'Received REQUEST for task [' +
					event.data[2] +
					'] ' +
					event.data[3],
			);

			if (!externalMethods) {
				// This situation should not be possible
				Logger.debug(
					'Received REQUEST for task [' +
						event.data[2] +
						'] ' +
						event.data[3] +
						', but there are no external methods configured',
				);
				return;
			}

			requestHandler(
				postMessageOutgoing,
				externalMethods,
				event.data[2],
				event.data[3],
				event.data[4],
			);
		} else {
			resultHandler(event.data.slice(1));
		}
	};

	abort?.addEventListener(
		'abort',
		() => {
			destroyTaskPerformer();
			setTimeout(HTMLIFrameElement.prototype.remove.bind(iframe), 1000);
			self.removeEventListener('message', eventListener, false);
			sandboxIframeCW.postMessage([secret, EMessageTypes.DESTROY], '*');
		},
		false,
	);

	return new Promise<typeof performTask>((resolve_, reject_) => {
		let errorTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
		let resolved = false;

		const onInitResult = () => {
			self.URL.revokeObjectURL(iframeSrcUrl);
			clearTimeout(errorTimeout);
			self.removeEventListener('message', readyEventListener, false);
			abort?.removeEventListener('abort', reject, false);
		};

		const resolve = () => {
			if (resolved) return;
			resolved = true;

			onInitResult();
			resolve_(performTask);
		};

		const reject = (e: unknown) => {
			if (resolved) return;
			resolved = true;

			onInitResult();
			reject_(e);
			destroyTaskPerformer();
			iframe.remove();
		};

		errorTimeout = setTimeout(
			() => reject(new Error('Timed out setting up iframe')),
			ERROR_TIMEOUT,
		);

		const readyEventListener = (event: MessageEvent) => {
			if (
				!event.isTrusted ||
				event.origin !== 'null' ||
				event.source !== sandboxIframeCW ||
				!Array.isArray(event.data) ||
				event.data[0] !== secret ||
				![
					EMessageTypes.SANDBOX_READY,
					EMessageTypes.GLOBAL_ERROR,
				].includes(event.data[1])
			)
				return;

			if (event.data[1] === EMessageTypes.SANDBOX_READY) {
				self.addEventListener('message', eventListener, false);

				resolve();
			} else {
				console.log('calling reject on event.data');
				console.log(event.data);
				reject(reconstructErrorInformation(event.data[2]));
			}
		};

		abort?.addEventListener('abort', reject, false);

		self.addEventListener('message', readyEventListener, false);
	});
};

export default browserSandbox;
