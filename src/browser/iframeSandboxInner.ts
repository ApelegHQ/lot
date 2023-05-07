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

import { EMessageTypes } from '../EMessageTypes.js';
import createErrorEventListenerFactory from '../lib/createErrorEventEventListenerFactory.js';
import createMessageEventListenerFactory from '../lib/createMessageEventListenerFactory.js';
import hardenGlobals from '../lib/hardenGlobals.js';
import * as Logger from '../lib/Logger.js';
import workerSandboxManager from '../worker/workerSandboxManager.js';
import iframeFallbackSandboxManager from './iframeFallbackSandboxManager.js';

const iframeSandboxInner = async (
	script: string,
	allowedGlobals: string[] | undefined,
	origin: string,
	secret: string,
): Promise<void> => {
	Logger.info('Iframe created, setting up worker');

	const parent = self.parent;
	// Disable accessing parent.
	// This still leaves 'top', which is non-configurable.
	self.parent = self;

	const addEventListener = EventTarget.prototype.addEventListener;
	const removeEventListener = EventTarget.prototype.removeEventListener;

	const replaceFn = (replace: typeof Function.prototype) => {
		const replacement = () => undefined;
		replacement.name = replace.name;
		return replacement.bind(null);
	};

	// Disable adding and removing event listeners.
	// Even if the sandbox is escaped, it won't be able to communicate with
	// its parent except via the mechanisms provided, since it won't be able to
	// find the secret.
	EventTarget.prototype.addEventListener = replaceFn(addEventListener);
	EventTarget.prototype.removeEventListener = replaceFn(removeEventListener);
	Object.defineProperty(self, 'onmessage', {
		configurable: false,
		writable: false,
	});
	Object.defineProperty(self, 'onmessageerror', {
		configurable: false,
		writable: false,
	});

	hardenGlobals();

	const postMessage = (() => {
		// If origin is not a valid origin, a DOMException gets thrown
		// In such cases, set origin to '*'
		const outgoingOrigin = (() => {
			try {
				new URL(origin);
				return origin;
			} catch {
				return '*';
			}
		})();

		return (data: unknown[]) =>
			parent.postMessage([secret, ...data], outgoingOrigin);
	})();

	const createMessageEventListener = createMessageEventListenerFactory(
		addEventListener,
		removeEventListener,
		self,
		origin,
		parent,
		secret,
		false,
	);
	const createErrorEventListener = createErrorEventListenerFactory(
		addEventListener,
		removeEventListener,
		self,
		postMessage,
	);

	if (typeof Worker === 'function') {
		try {
			return await workerSandboxManager(
				script,
				allowedGlobals,
				createMessageEventListener,
				createErrorEventListener,
				postMessage,
			);
		} catch (e) {
			Logger.warn(
				'Error setting up worker, falling back to direct execution',
				e,
			);
		}
	}

	try {
		return await iframeFallbackSandboxManager(
			script,
			allowedGlobals,
			createMessageEventListener,
			createErrorEventListener,
			postMessage,
		);
	} catch (e) {
		Logger.warn('Error setting up fallback', e);
	}

	postMessage([EMessageTypes.GLOBAL_ERROR]);
};

export default iframeSandboxInner;
