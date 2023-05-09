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

import EMessageTypes from '../EMessageTypes.js';
import { IPerformTask } from '../types/index.js';
import { reconstructErrorInformation } from './errorModem.js';
import * as Logger from './Logger.js';
import performTaskFactory from './performTaskFactory.js';
import requestHandler from './requestHandler.js';

// Timeout for sandbox initialisation (in ms)
const ERROR_TIMEOUT = __buildtimeSettings__.sandboxInitDeadlineInMs;

const setupSandboxListeners = (
	eventTargetIncoming: EventTarget,
	originIncoming: string,
	sourceIncoming: MessageEventSource | null,
	secretIncoming: string | undefined,
	allowUntrusted: boolean,
	postMessageOutgoing: typeof postMessage,
	manager: { (): Promise<void> },
	externalMethods?: Record<string, typeof Function.prototype> | null,
	abort?: AbortSignal,
): Promise<IPerformTask> => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethods) {
		throw new TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const [performTask, resultHandler, destroyTaskPerformer] =
		performTaskFactory(postMessageOutgoing);

	const eventListener = (event: MessageEvent) => {
		if (
			(!allowUntrusted && !event.isTrusted) ||
			event.origin !== originIncoming ||
			event.source !== sourceIncoming ||
			!Array.isArray(event.data) ||
			(secretIncoming && event.data[0] !== secretIncoming)
		)
			return;

		const data = secretIncoming ? event.data.slice(1) : event.data;

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
					postMessageOutgoing,
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
		destroyTaskPerformer();
		eventTargetIncoming.removeEventListener(
			'message',
			eventListener as { (event: Event): void },
			false,
		);
		postMessageOutgoing([EMessageTypes.DESTROY]);
		abort?.removeEventListener('abort', onDestroy, false);
	};

	abort?.addEventListener('abort', onDestroy, false);

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
			onDestroy();
		};

		errorTimeout = setTimeout(
			() => reject(new Error('Timed out setting up sandbox')),
			ERROR_TIMEOUT,
		);

		const readyEventListener = (event: MessageEvent) => {
			if (
				(!allowUntrusted && !event.isTrusted) ||
				event.origin !== originIncoming ||
				event.source !== sourceIncoming ||
				!Array.isArray(event.data) ||
				(secretIncoming && event.data[0] !== secretIncoming)
			)
				return;

			const data = secretIncoming ? event.data.slice(1) : event.data;

			if (
				![
					EMessageTypes.SANDBOX_READY,
					EMessageTypes.GLOBAL_ERROR,
				].includes(data[0])
			)
				return;

			if (data[0] === EMessageTypes.SANDBOX_READY) {
				eventTargetIncoming.addEventListener(
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

		eventTargetIncoming.addEventListener(
			'message',
			readyEventListener as { (event: Event): void },
			false,
		);

		manager().catch(reject);
	});
};

export default setupSandboxListeners;
