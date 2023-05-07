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
import extractErrorInformation from './extractErrorInformation.js';
import genericSandbox from './genericSandbox.js';
import * as Logger from './Logger.js';

const FERAL_FUNCTION = Function;

const createSandboxedHandler = (
	script: string,
	allowedGlobals: string[] | undefined,
	postMessage: { (data: unknown[]): void },
	cleanup: { (): void },
) => {
	const sandbox = genericSandbox(script, allowedGlobals, FERAL_FUNCTION);

	const ctx = sandbox.sandboxWrapperThis;

	const promise =
		typeof Promise === 'function'
			? Promise
			: (function () {
					/* empty*/
			  } as unknown as { new <T>(): Promise<T> });

	const handler = (data: unknown[]) => {
		if (
			![EMessageTypes.REQUEST, EMessageTypes.DESTROY].includes(
				data[0] as EMessageTypes,
			)
		) {
			return;
		}

		if (data[0] === EMessageTypes.DESTROY) {
			Logger.debug('Received DESTROY from parent');

			sandbox.sandboxWrapperRevoke();
			postMessage = Boolean;

			cleanup();

			return;
		}

		Logger.debug('Received REQUEST for task [' + data[1] + '] ' + data[2]);

		try {
			if (
				!ctx ||
				!ctx['module'] ||
				!ctx['module']['exports'] ||
				!Object.prototype.hasOwnProperty.call(
					ctx['module']['exports'],
					data[2] as PropertyKey,
				)
			) {
				throw new ReferenceError(`${data[2]} is not defined`);
			}

			const fn = ctx['module']['exports'][data[2] as PropertyKey];

			if (typeof fn !== 'function') {
				throw new TypeError(`${data[2]} is not a function`);
			}

			const result = Function.prototype.apply.call(
				fn,
				null,
				data.slice(3),
			);

			if (result instanceof promise) {
				result
					.then((r) => {
						Logger.debug(
							'Sending RESULT from executing task [' +
								data[1] +
								'] ' +
								data[2] +
								' (async)',
						);

						postMessage([EMessageTypes.RESULT, data[1], r]);
					})
					.catch((e) => {
						Logger.debug(
							'Sending ERROR from executing task [' +
								data[1] +
								'] ' +
								data[2] +
								' (async)',
						);

						postMessage([
							EMessageTypes.ERROR,
							data[1],
							extractErrorInformation(e),
						]);
					});
			} else {
				Logger.debug(
					'Sending RESULT from executing task [' +
						data[1] +
						'] ' +
						data[2] +
						' (sync)',
				);

				try {
					postMessage([EMessageTypes.RESULT, data[1], result]);
				} catch (e) {
					postMessage([
						EMessageTypes.ERROR,
						data[1],
						extractErrorInformation(e),
					]);
				}
			}
		} catch (e) {
			Logger.debug(
				'Sending ERROR from executing task [' +
					data[1] +
					'] ' +
					data[2] +
					' (sync)',
			);

			postMessage([
				EMessageTypes.ERROR,
				data[1],
				extractErrorInformation(e),
			]);
		}
	};

	sandbox.sandboxWrapperFn();

	return handler;
};

export default createSandboxedHandler;
