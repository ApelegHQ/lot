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

import createErrorEventListenerFactory from '../../lib/createErrorEventEventListenerFactory.js';
import createMessageEventListenerFactory from '../../lib/createMessageEventListenerFactory.js';
import { extractErrorInformation } from '../../lib/errorModem.js';
import hardenGlobals from '../../lib/hardenGlobals.js';
import * as Logger from '../../lib/Logger.js';
import recursivelyDeleteProperty from '../../lib/recursivelyDeleteProperty.js';
import tightenCsp from '../../lib/tightenCsp.js';
import type { TSandboxOptions } from '../../../types/index.js';
import workerSandboxManager from '../../../neutral/impl/worker/workerSandboxManager.js';
import iframeSoleSandboxManager from './iframeSoleSandboxManager.js';

const iframeSandboxInner = async (
	messagePort: MessagePort,
	script: string,
	revocable: boolean,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	options?: TSandboxOptions,
): Promise<void> => {
	Logger.info('Iframe created, setting up worker');

	let error: unknown;

	const close = self['close'].bind(self);
	const start = messagePort['start'].bind(messagePort);
	const postInit = () => {
		tightenCsp();
		start();
	};

	recursivelyDeleteProperty(self, 'close');
	recursivelyDeleteProperty(self, 'postMessage');

	// This still leaves 'top', which is non-configurable.
	recursivelyDeleteProperty(self, 'opener');
	recursivelyDeleteProperty(self, 'parent');

	const addEventListener = EventTarget.prototype.addEventListener;
	const removeEventListener = EventTarget.prototype.removeEventListener;

	const replaceFn = (replace: typeof Function.prototype) => {
		const replacement = () => undefined;
		const replacementNameDescriptor = Object.getOwnPropertyDescriptor(
			replace,
			'name',
		);
		if (replacementNameDescriptor) {
			Object.defineProperty(
				replacement,
				'name',
				replacementNameDescriptor,
			);
		}
		return replacement.bind(null);
	};

	// Disable adding and removing event listeners.
	// Even if the sandbox is escaped, it won't be able to communicate with
	// its parent except via the mechanisms provided, since it won't be able to
	// find the secret.
	EventTarget.prototype.addEventListener = replaceFn(addEventListener);
	EventTarget.prototype.removeEventListener = replaceFn(removeEventListener);
	Object.defineProperty(self, 'onmessage', {
		['configurable']: false,
		['writable']: false,
	});
	Object.defineProperty(self, 'onmessageerror', {
		['configurable']: false,
		['writable']: false,
	});

	hardenGlobals();

	const postMessage = messagePort.postMessage.bind(messagePort);

	const createMessageEventListener = createMessageEventListenerFactory(
		addEventListener,
		removeEventListener,
		false,
	);
	const createErrorEventListener = createErrorEventListenerFactory(
		addEventListener,
		removeEventListener,
		self,
		postMessage,
	);

	if (__buildtimeSettings__.isolationStategyIframeWorker) {
		if (typeof Worker === 'function') {
			try {
				return await workerSandboxManager(
					messagePort,
					script,
					revocable,
					allowedGlobals,
					externalMethodsList,
					createMessageEventListener,
					createErrorEventListener,
					postMessage,
					options,
				).then(postInit);
			} catch (e) {
				Logger.warn(
					'Error setting up worker, falling back to direct execution if enabled',
					e,
				);
				error = e;
			}
		} else {
			error = new TypeError('Worker is not a function');
			Logger.info(
				'`Worker` undefined, falling back to direct execution if enabled',
			);
		}
	}

	// Option name extracted as string constant to avoid name mangling
	const requireWorkerOptName = 'browserRequireWorker';

	if (
		__buildtimeSettings__.isolationStategyIframeSole &&
		!options?.[requireWorkerOptName]
	) {
		if (error) {
			Logger.info('Falling back to direct execution');
		}
		try {
			return await iframeSoleSandboxManager(
				messagePort,
				script,
				revocable,
				allowedGlobals,
				externalMethodsList,
				createMessageEventListener,
				createErrorEventListener,
				close,
			).then(postInit);
		} catch (e) {
			Logger.warn('Error setting up direct execution sandbox', e);
			error = e;
		}
	}

	const returnError = new Error('Error setting up iframe');
	if (error) {
		(returnError as Error & { cause: unknown }).cause = error;
	}

	postMessage([EMessageTypes.GLOBAL_ERROR, extractErrorInformation(error)]);
};

export default iframeSandboxInner;
