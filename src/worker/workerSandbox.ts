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
import getRandomSecret from '../lib/getRandomSecret.js';
import getRandomUuid from '../lib/getRandomUuid.js';
import * as Logger from '../lib/Logger.js';
import workerSandboxManager from './workerSandboxManager.js';

// Timeout for worker initialisation (in ms)
const ERROR_TIMEOUT = 4000;

const workerSandbox = async (
	script: string,
	allowedGlobals: string[] | undefined,
	abort?: AbortSignal,
) => {
	const secret = getRandomSecret();
	const originIncoming = 'urn:uuid:' + getRandomUuid();
	const originOutgoing = 'urn:uuid:' + getRandomUuid();
	const pendingTasks: Record<string, (typeof Function.prototype)[]> =
		Object.create(null);

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

	const eventListener = (event: MessageEvent) => {
		if (
			event.origin !== originIncoming ||
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

		postMessageOutgoing([EMessageTypes.REQUEST, taskId, op, ...args]);

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
			eventTargetIncoming.removeEventListener(
				'message',
				eventListener as { (event: Event): void },
				false,
			);
			Object.keys(pendingTasks).forEach((id) => delete pendingTasks[id]);
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
			resolve_(performTaskProxy.proxy);
		};

		const reject = (e: unknown) => {
			if (resolved) return;
			resolved = true;

			onInitResult();
			reject_(e);

			performTaskProxy.revoke();
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
				reject(event.data[2]);
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
			createMessageEventListener,
			createErrorEventListener,
			postMessageIncoming,
		).catch(reject);
	});
};

export default workerSandbox;
