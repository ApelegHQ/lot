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

import { extractErrorInformation } from './errorModem.js';
import * as Logger from './Logger.js';
import { fnApply, oHasOwnProperty, RE, TE } from './utils.js';

/**
 * Handles a request for executing a task with the specified operation (op)
 * using the provided context (ctx).
 * The result or error of the task execution is sent back via the postMessage
 * function.
 *
 * @param postMessage - The function to send messages back to the caller.
 * @param ctx - The context object containing the operations that can be
 * executed.
 * @param id - The unique identifier for the task.
 * @param op - The name of the operation to be executed.
 * @param args - Additional arguments to be passed to the operation function.
 *
 * @returns This function does not return a value directly, but uses the postMessage function to send results or errors.
 */
const requestHandler = (
	postMessage: { (data: unknown[]): void },
	ctx: unknown,
	id: unknown,
	op: unknown,
	...args: unknown[]
): void => {
	if (typeof id !== 'string' || typeof op !== 'string') {
		Logger.trace('Rejecting REQUEST, invalid id or op', [id, op]);
		return;
	}

	Logger.debug('Handling REQUEST for task [' + id + '] ' + op);

	try {
		if (!ctx || !oHasOwnProperty(ctx, op)) {
			throw RE(`${op} is not defined`);
		}

		const fn = (ctx as Record<PropertyKey, unknown>)[
			op as keyof typeof ctx
		];

		if (typeof fn !== 'function' && args.length !== 0) {
			throw TE(`${op} is not a function`);
		}

		const result = typeof fn === 'function' ? fnApply(fn, null, args) : fn;

		if (
			result !== null &&
			typeof result === 'object' &&
			'then' in result &&
			typeof result['then'] === 'function'
		) {
			const thenable = result['then']((result: unknown) => {
				Logger.debug(
					'Sending RESULT from executing task [' +
						id +
						'] ' +
						op +
						' (async)',
				);

				postMessage([EMessageTypes.RESULT, id, result]);
			});

			if (
				thenable !== null &&
				typeof thenable === 'object' &&
				'catch' in thenable &&
				typeof thenable['catch'] === 'function'
			) {
				thenable['catch']((e: unknown) => {
					Logger.debug(
						'Sending ERROR from executing task [' +
							id +
							'] ' +
							op +
							' (async)',
					);

					postMessage([
						EMessageTypes.ERROR,
						id,
						extractErrorInformation(e),
					]);
				});
			}
		} else {
			Logger.debug(
				'Sending RESULT from executing task [' +
					id +
					'] ' +
					op +
					' (sync)',
			);

			postMessage([EMessageTypes.RESULT, id, result]);
		}
	} catch (e) {
		Logger.debug(
			'Sending ERROR from executing task [' + id + '] ' + op + ' (sync)',
		);

		postMessage([EMessageTypes.ERROR, id, extractErrorInformation(e)]);
	}
};

export default requestHandler;
