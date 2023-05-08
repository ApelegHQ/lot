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
import { extractErrorInformation } from './errorModem.js';
import * as Logger from './Logger.js';

const promise =
	typeof Promise === 'function'
		? Promise
		: (function () {
				/* empty*/
		  } as unknown as { new <T>(): Promise<T> });

const requestHandler = (
	postMessage: { (data: unknown[]): void },
	ctx: unknown,
	id: unknown,
	op: unknown,
	...args: unknown[]
) => {
	if (typeof id !== 'string' || typeof op !== 'string') {
		Logger.trace('Rejecting REQUEST, invalid id or op', [id, op]);
		return;
	}

	Logger.debug('Handling REQUEST for task [' + id + '] ' + op);

	try {
		if (!ctx || !Object.prototype.hasOwnProperty.call(ctx, op)) {
			throw new ReferenceError(`${op} is not defined`);
		}

		const fn = (ctx as Record<PropertyKey, unknown>)[
			op as keyof typeof ctx
		];

		if (typeof fn !== 'function') {
			throw new TypeError(`${op} is not a function`);
		}

		const result = Function.prototype.apply.call(fn, null, args);

		if (result instanceof promise) {
			result
				.then((result) => {
					Logger.debug(
						'Sending RESULT from executing task [' +
							id +
							'] ' +
							op +
							' (async)',
					);

					postMessage([EMessageTypes.RESULT, id, result]);
				})
				.catch((e) => {
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
		} else {
			Logger.debug(
				'Sending RESULT from executing task [' +
					id +
					'] ' +
					op +
					' (sync)',
			);

			try {
				postMessage([EMessageTypes.RESULT, id, result]);
			} catch (e) {
				postMessage([
					EMessageTypes.ERROR,
					id,
					extractErrorInformation(e),
				]);
			}
		}
	} catch (e) {
		Logger.debug(
			'Sending ERROR from executing task [' + id + '] ' + op + ' (sync)',
		);

		postMessage([EMessageTypes.ERROR, id, extractErrorInformation(e)]);
	}
};

export default requestHandler;
