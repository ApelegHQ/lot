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

import { aIncludes, aIsArray, aPush, E, MC, PM, TE } from './utils.js';

import type { IPerformTask } from '~/types/index.js';
import { reconstructErrorInformation } from './errorModem.js';
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
const performTaskFactory = <T>(
	revocable: boolean,
	postMessageOutgoing: MessagePort['postMessage'],
): [performTask: IPerformTask<T>, revoke: { (): void }] => {
	const unresolved: [MessagePort, typeof Boolean][] = [];

	const performTask: IPerformTask<T> = async (op, ...args) => {
		if (typeof op !== 'string') {
			throw TE('Operation must be of string type');
		}

		Logger.debug('Sending REQUEST for task ' + op);

		// TODO: Fix type with real return type
		const taskPromise = new PM<never>((resolve, reject) => {
			const channel = new MC();
			const incomingPort = channel['port1'];
			const outgoingPort = channel['port2'];
			aPush(unresolved, [incomingPort, reject]);
			const markAsResolved = () => {
				incomingPort.close();
				const idx = unresolved.findIndex((v) => {
					return v[0] === incomingPort;
				});
				if (idx !== -1) {
					unresolved.splice(idx, 1);
				}
			};
			// The following const definitions prevent Google Closure Compiler
			// from mangling the event handler names
			const onmessage = 'onmessage';
			const onmessageerror = 'onmessageerror';
			incomingPort[onmessage] = (ev) => {
				const data = ev['data'];
				if (
					!aIsArray(data) ||
					!aIncludes(
						[EMessageTypes.RESULT, EMessageTypes.ERROR],
						data[0] as EMessageTypes,
					)
				)
					return;

				Logger.debug(
					'Received ' +
						(data[0] === EMessageTypes.RESULT
							? 'RESULT'
							: 'ERROR') +
						' from executing task ' +
						op,
				);

				if (data[0] === EMessageTypes.RESULT) {
					resolve(data[1]);
				} else {
					reject(reconstructErrorInformation(data[1]));
				}
				markAsResolved();
			};
			incomingPort[onmessageerror] = () => {
				Logger.debug(
					'Error decoding task result after executing task ' + op,
				);

				reject(new E('Error decoding task result'));
				markAsResolved();
			};
			incomingPort.start();
			try {
				postMessageOutgoing(
					[EMessageTypes.REQUEST, outgoingPort, op, ...args],
					[outgoingPort],
				);
			} catch (e) {
				reject(e);
				markAsResolved();
			}
		});

		return taskPromise;
	};

	const [performTaskProxy, revoke] = proxyMaybeRevocable(
		revocable || null,
		performTask,
		{},
	);

	return [
		performTaskProxy,
		() => {
			if (revoke) {
				revoke();
			}
			const e = new E('Task aborted');
			// Abort all pending tasks
			unresolved.splice(0).forEach((x) => {
				try {
					x[1](e);
					x[0].close();
				} catch (e) {
					void e;
				}
			});
		},
	];
};

export default performTaskFactory;
