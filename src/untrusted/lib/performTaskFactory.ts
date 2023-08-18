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

import {
	aForEach,
	aIncludes,
	aIsArray,
	aMap,
	E,
	oCreate,
	oFreeze,
	oHasOwnProperty,
	oKeys,
	PM,
	TE,
} from './utils.js';

import type { IPerformTask } from '~/types/index.js';
import { reconstructErrorInformation } from './errorModem.js';
import getRandomSecret from './getRandomSecret.js';
import * as Logger from './Logger.js';
import proxyMaybeRevocable from './proxyMaybeRevocable.js';

/**
 * Factory function to create a performTask instance.
 *
 * @param revocable - Determines if the performTask methods are revocable.
 * @param postMessageOutgoing - Callback function to send results.
 * @returns Returns a tuple containing the IPerformTask function, a
 * resultHandler function, and a cleanup function to revoke the performTask
 * methods and clear pending tasks.
 */
const performTaskFactory = (
	revocable: boolean,
	postMessageOutgoing: MessagePort['postMessage'],
): [IPerformTask, { (data: unknown[]): void }, { (): void }] => {
	const pendingTasks: Record<
		string,
		[typeof Function.prototype, typeof Function.prototype]
	> = oCreate(null);

	const resultHandler = (data: unknown[]) => {
		if (
			!aIsArray(data) ||
			!aIncludes(
				[EMessageTypes.RESULT, EMessageTypes.ERROR],
				data[0] as EMessageTypes,
			) ||
			typeof data[1] !== 'string' ||
			!oHasOwnProperty(pendingTasks, data[1] as PropertyKey)
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

	const performTask: IPerformTask = async (op, ...args) => {
		if (typeof op !== 'string') {
			throw TE('Operation must be of string type');
		}

		const taskId = getRandomSecret();

		Logger.debug('Sending REQUEST for task [' + taskId + '] ' + op);

		const taskPromise = new PM((resolve, reject) => {
			pendingTasks[taskId] = [resolve, reject];
		});

		try {
			postMessageOutgoing([EMessageTypes.REQUEST, taskId, op, ...args]);
		} catch (e) {
			pendingTasks[taskId][1](e);
		}

		return taskPromise;
	};

	const performTaskMethods: [typeof performTask, typeof resultHandler] = [
		performTask,
		resultHandler,
	];

	const performTaskMethodsProxy = aMap(performTaskMethods, (m) =>
		proxyMaybeRevocable(revocable || null, m, {}),
	);

	return [
		performTaskMethodsProxy[0].proxy as typeof performTask,
		performTaskMethodsProxy[1].proxy as typeof resultHandler,
		() => {
			performTaskMethodsProxy[0].revoke();
			performTaskMethodsProxy[1].revoke();
			const error = E('Task cancelled');
			aForEach(oKeys(pendingTasks), (id) => {
				pendingTasks[id][1](error);
				delete pendingTasks[id];
			});
			oFreeze(pendingTasks);
		},
	];
};

export default performTaskFactory;
