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

import workerSandboxManager from '~untrusted/impl/worker/workerSandboxManager.js';
import setupSandboxListeners from '~trusted/lib/setupSandboxListeners.js';
import { ISandbox } from '~/types/index.js';
import createErrorEventListenerFactory from '~untrusted/lib/createErrorEventEventListenerFactory.js';
import createMessageEventListenerFactory from '~untrusted/lib/createMessageEventListenerFactory.js';

const workerSandbox: ISandbox = async (
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

	const addEventListener = EventTarget.prototype.addEventListener;
	const removeEventListener = EventTarget.prototype.removeEventListener;

	const channel = new MessageChannel();

	const postMessageIncoming = channel.port2.postMessage.bind(channel.port2);

	const createMessageEventListener = createMessageEventListenerFactory(
		addEventListener,
		removeEventListener,
		true,
	);

	const createErrorEventListener = createErrorEventListenerFactory(
		addEventListener,
		removeEventListener,
		channel.port2,
		postMessageIncoming,
	);

	const teardown = () => {
		channel.port1.close();
		channel.port2.close();
	};

	return setupSandboxListeners(
		channel.port1,
		true,
		() => {
			channel.port1.start();
			channel.port2.start();

			return workerSandboxManager(
				channel.port2,
				script,
				!!abort,
				allowedGlobals,
				externalMethods && Object.keys(externalMethods),
				createMessageEventListener,
				createErrorEventListener,
				postMessageIncoming,
				options,
				teardown,
			);
		},
		externalMethods,
		abort,
	);
};

export default workerSandbox;
