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

import { IPerformTask } from '~/types/index.js';
import { reconstructErrorInformation } from '~untrusted/lib/errorModem.js';
import * as Logger from '~untrusted/lib/Logger.js';
import performTaskFactory from '~untrusted/lib/performTaskFactory.js';
import requestHandler from '~untrusted/lib/requestHandler.js';

// Timeout for sandbox initialisation (in ms)
const ERROR_TIMEOUT = __buildtimeSettings__.sandboxInitDeadlineInMs;

/**
 * Set up sandbox listeners to facilitate (uni- or bidirectional) communication
 * between the main context and a sandbox.
 * This function ensures messages are appropriately handled and processed.
 *
 * @param messagePort - The communication port used to send and receive
 * messages.
 * @param allowUntrusted - A flag to determine if untrusted messages (i.e.,
 * events with the `isTrusted` flag set to false) should be processed.
 * @param manager - A function responsible for additional set up tasks, if
 * needed.
 * @param externalMethods - An optional object of external methods that can be
 * invoked via messages.
 * @param abort - An optional abort signal to stop processing or listening for
 * messages.
 * @returns A promise resolving to a performTask function, allowing the caller
 * to initiate tasks.
 * @throws {TypeError} Throws if bidirectional messaging is disabled but
 * externalMethods is provided.
 */
const setupSandboxListeners = (
	messagePort: MessagePort,
	allowUntrusted: boolean,
	manager: { (): Promise<void> },
	externalMethods?: Record<string, unknown> | null,
	abort?: AbortSignal,
): Promise<IPerformTask> => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethods) {
		throw new TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const postMessage = messagePort.postMessage.bind(messagePort);

	const [performTask, resultHandler, destroyTaskPerformer] =
		performTaskFactory(!!abort, postMessage);

	const eventListener = (event: MessageEvent) => {
		if ((!allowUntrusted && !event.isTrusted) || !Array.isArray(event.data))
			return;

		const data = event.data;

		if (__buildtimeSettings__.bidirectionalMessaging) {
			if (data[0] === EMessageTypes.REQUEST) {
				Logger.debug(
					'Received REQUEST for task [' + data[1] + '] ' + data[2],
				);

				if (!externalMethods) {
					// This situation should not be possible
					Logger.debug(
						'Received REQUEST for task [' +
							data[1] +
							'] ' +
							data[2] +
							', but there are no external methods configured',
					);
					return;
				}

				requestHandler(
					postMessage,
					externalMethods,
					data[1],
					data[2],
					data[3],
				);

				return;
			}
		}

		resultHandler(data);
	};

	const onDestroy = () => {
		postMessage([EMessageTypes.DESTROY]);
		destroyTaskPerformer();
		messagePort.removeEventListener(
			'message',
			eventListener as { (event: Event): void },
			false,
		);
		abort?.removeEventListener('abort', onDestroy, false);
	};

	abort?.addEventListener('abort', onDestroy, false);

	return new Promise<typeof performTask>((resolve_, reject_) => {
		let errorTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
		let resolved = false;

		const onInitResult = () => {
			clearTimeout(errorTimeout);
			messagePort.removeEventListener(
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
			onDestroy();
		};

		errorTimeout = setTimeout(
			() => reject(new Error('Timed out setting up sandbox')),
			ERROR_TIMEOUT,
		);

		const readyEventListener = (event: MessageEvent) => {
			if (
				(!allowUntrusted && !event.isTrusted) ||
				!Array.isArray(event.data)
			)
				return;

			const data = event.data;

			if (
				![
					EMessageTypes.SANDBOX_READY,
					EMessageTypes.GLOBAL_ERROR,
				].includes(data[0])
			)
				return;

			if (data[0] === EMessageTypes.SANDBOX_READY) {
				messagePort.addEventListener(
					'message',
					eventListener as { (event: Event): void },
					false,
				);

				resolve();
			} else {
				reject(reconstructErrorInformation(data[1]));
			}
		};

		abort?.addEventListener('abort', reject, false);

		messagePort.addEventListener(
			'message',
			readyEventListener as { (event: Event): void },
			false,
		);

		manager().catch(reject);
	});
};

export default setupSandboxListeners;
