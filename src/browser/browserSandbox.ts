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
import getRandomSecret from '../lib/getRandomSecret.js';
import * as Logger from '../lib/Logger.js';

// Timeout for worker initialisation (in ms)
const ERROR_TIMEOUT = 4000;

const browserSandbox = async (
	script: string,
	allowedGlobals: string[] | undefined,
	abort?: AbortSignal,
) => {
	const secret = getRandomSecret();
	const sourceScriptElementId = getRandomSecret();
	const nonce = getRandomSecret();

	const html = `<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Sandbox</title><script type="application/json" id="${sourceScriptElementId}">${JSON.stringify(
		[
			String(script),
			allowedGlobals?.map(String),
			self.location.origin,
			secret,
		],
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

	iframe.setAttribute('sandbox', 'allow-scripts');
	iframe.setAttribute(
		'csp',
		`default-src 'none'; script-src 'unsafe-inline' 'nonce-${nonce}'; worker-src blob:`,
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

	const pendingTasks: Record<string, (typeof Function.prototype)[]> =
		Object.create(null);

	const eventListener = (event: MessageEvent) => {
		if (
			!event.isTrusted ||
			event.origin !== 'null' ||
			event.source !== sandboxIframeCW ||
			!Array.isArray(event.data) ||
			event.data[0] !== secret ||
			![EMessageTypes.RESULT, EMessageTypes.ERROR].includes(
				event.data[1],
			) ||
			!Object.prototype.hasOwnProperty.call(pendingTasks, event.data[2])
		)
			return;

		Logger.debug(
			'Received ' +
				(event.data[1] === EMessageTypes.RESULT ? 'RESULT' : 'ERROR') +
				' from executing task [' +
				event.data[2] +
				']',
		);

		const thisTask = pendingTasks[event.data[2]];

		delete pendingTasks[event.data[2]];

		thisTask[event.data[1] === EMessageTypes.RESULT ? 0 : 1](event.data[3]);
	};

	const performTask = async (op: string, ...args: unknown[]) => {
		const taskId = getRandomSecret();

		Logger.debug('Sending REQUEST for task [' + taskId + '] ' + op);

		sandboxIframeCW.postMessage(
			[secret, EMessageTypes.REQUEST, taskId, op, ...args],
			'*',
		);

		pendingTasks[taskId] = [];

		const taskPromise = new Promise((resolve, reject) => {
			pendingTasks[taskId].push(resolve, reject);
		});

		return taskPromise;
	};

	const performTaskProxy = Proxy.revocable(performTask, {});

	abort?.addEventListener(
		'abort',
		() => {
			performTaskProxy.revoke();
			setTimeout(HTMLIFrameElement.prototype.remove.bind(iframe), 1000);
			self.removeEventListener('message', eventListener, false);
			Object.keys(pendingTasks).forEach((id) => delete pendingTasks[id]);
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
			resolve_(performTaskProxy.proxy);
		};

		const reject = (e: unknown) => {
			if (resolved) return;
			resolved = true;

			onInitResult();
			reject_(e);
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
				reject(event.data[2]);
			}
		};

		abort?.addEventListener('abort', reject, false);

		self.addEventListener('message', readyEventListener, false);
	});
};

export default browserSandbox;
