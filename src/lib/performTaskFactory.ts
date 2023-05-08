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

import { EMessageTypes } from '../EMessageTypes';
import { reconstructErrorInformation } from './errorModem';
import getRandomSecret from './getRandomSecret.js';
import * as Logger from './Logger.js';

const performTaskFactory = (postMessageOutgoing: {
	(data: unknown[]): void;
}): [
	{ (op: string, ...args: unknown[]): Promise<unknown> },
	{ (data: unknown[]): void },
	{ (): void },
] => {
	const pendingTasks: Record<string, (typeof Function.prototype)[]> =
		Object.create(null);

	const resultHandler = (data: unknown[]) => {
		if (
			!Array.isArray(data) ||
			![EMessageTypes.RESULT, EMessageTypes.ERROR].includes(
				data[0] as EMessageTypes,
			) ||
			typeof data[1] !== 'string' ||
			!Object.prototype.hasOwnProperty.call(
				pendingTasks,
				data[1] as PropertyKey,
			)
		)
			return;

		Logger.debug(
			'Received ' +
				(data[0] === EMessageTypes.RESULT ? 'RESULT' : 'ERROR') +
				' from executing task [' +
				data[1] +
				']',
		);

		const thisTask = pendingTasks[data[1]];

		delete pendingTasks[data[1]];

		if (data[0] === EMessageTypes.RESULT) {
			thisTask[0](data[2]);
		} else {
			thisTask[1](reconstructErrorInformation(data[2]));
		}
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

	const performTaskMethods: [typeof performTask, typeof resultHandler] = [
		performTask,
		resultHandler,
	];

	const performTaskMethodsProxy = performTaskMethods.map((m) =>
		Proxy.revocable(m, {}),
	);

	return [
		performTaskMethodsProxy[0].proxy as typeof performTask,
		performTaskMethodsProxy[1].proxy as typeof resultHandler,
		() => {
			performTaskMethodsProxy[0].revoke();
			performTaskMethodsProxy[1].revoke();
			Object.keys(pendingTasks).forEach((id) => delete pendingTasks[id]);
		},
	];
};

export default performTaskFactory;
