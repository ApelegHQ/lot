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
import { reconstructErrorInformation } from '../lib/errorModem.js';
import getRandomSecret from '../lib/getRandomSecret.js';
import getRandomUuid from '../lib/getRandomUuid.js';
import * as Logger from '../lib/Logger.js';
import performTaskFactory from '../lib/performTaskFactory.js';
import requestHandler from '../lib/requestHandler.js';
import workerSandboxManager from './workerSandboxManager.js';

// Timeout for worker initialisation (in ms)
const ERROR_TIMEOUT = 4000;

const workerSandbox = async (
	script: string,
	allowedGlobals: string[] | undefined | null,
	externalMethods?: Record<string, typeof Function.prototype> | null,
	abort?: AbortSignal,
) => {
	const secret = getRandomSecret();
	const originIncoming = 'urn:uuid:' + getRandomUuid();
	const originOutgoing = 'urn:uuid:' + getRandomUuid();

	const eventTargetIncoming = new EventTarget();
	const eventTargetOutgoing = new EventTarget();

	const postMessageIncoming = (data: unknown[]) =>
		eventTargetIncoming.dispatchEvent(
			new MessageEvent('message', {
				data: [secret, ...data],
				origin: originIncoming,
			}),
		);

	const postMessageOutgoing = (data: unknown[]) =>
		eventTargetOutgoing.dispatchEvent(
			new MessageEvent('message', {
				data: [secret, ...data],
				origin: originOutgoing,
			}),
		);

	const createMessageEventListener = createMessageEventListenerFactory(
		addEventListener,
		removeEventListener,
		eventTargetOutgoing,
		originOutgoing,
		null,
		secret,
		true,
	);

	const createErrorEventListener = createErrorEventListenerFactory(
		addEventListener,
		removeEventListener,
		eventTargetOutgoing,
		postMessageIncoming,
	);

	const [performTask, resultHandler, destroyTaskPerformer] =
		performTaskFactory(postMessageOutgoing);

	const eventListener = (event: MessageEvent) => {
		if (
			event.origin !== originIncoming ||
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
			eventTargetIncoming.removeEventListener(
				'message',
				eventListener as { (event: Event): void },
				false,
			);
			postMessageOutgoing([EMessageTypes.DESTROY]);
		},
		false,
	);

	return new Promise<typeof performTask>((resolve_, reject_) => {
		let errorTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
		let resolved = false;

		const onInitResult = () => {
			clearTimeout(errorTimeout);
			eventTargetIncoming.removeEventListener(
				'message',
				readyEventListener as { (event: Event): void },
				false,
			);
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
			postMessageOutgoing([EMessageTypes.DESTROY]);
		};

		errorTimeout = setTimeout(
			() => reject(new Error('Timed out setting up worker')),
			ERROR_TIMEOUT,
		);

		const readyEventListener = (event: MessageEvent) => {
			if (
				event.origin !== originIncoming ||
				!Array.isArray(event.data) ||
				event.data[0] !== secret ||
				![
					EMessageTypes.SANDBOX_READY,
					EMessageTypes.GLOBAL_ERROR,
				].includes(event.data[1])
			)
				return;

			console.log('Processing event (validation success)');

			if (event.data[1] === EMessageTypes.SANDBOX_READY) {
				eventTargetIncoming.addEventListener(
					'message',
					eventListener as { (event: Event): void },
					false,
				);

				resolve();
			} else {
				reject(reconstructErrorInformation(event.data[2]));
			}
		};

		abort?.addEventListener('abort', reject, false);

		eventTargetIncoming.addEventListener(
			'message',
			readyEventListener as { (event: Event): void },
			false,
		);

		workerSandboxManager(
			script,
			allowedGlobals,
			externalMethods && Object.keys(externalMethods),
			createMessageEventListener,
			createErrorEventListener,
			postMessageIncoming,
		).catch(reject);
	});
};

export default workerSandbox;
