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

import * as workerSandboxInit from 'inline:../worker/workerSandboxInit.inline.js';
import EMessageTypes from '../../EMessageTypes.js';
import * as Logger from '../../lib/Logger.js';
import type workerSandboxInner from './workerSandboxInner.js';

// Timeout for worker initialisation (in ms)
const ERROR_TIMEOUT = __buildtimeSettings__.innerSandboxInitDeadlineInMs;

const createWorker = (
	script: string,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
): [Worker, { (): void }] => {
	const blob = new Blob([workerSandboxInit.default]);
	const workerSrcUrl = self.URL.createObjectURL(blob);
	const worker = new Worker(workerSrcUrl);

	worker.postMessage([
		EMessageTypes.SANDBOX_READY,
		script,
		allowedGlobals,
		externalMethodsList,
	] as [
		EMessageTypes.SANDBOX_READY,
		...Parameters<typeof workerSandboxInner>,
	]);

	const revokeWorkerSrcUrl = self.URL.revokeObjectURL.bind(
		null,
		workerSrcUrl,
	);

	return [worker, revokeWorkerSrcUrl];
};

const workerSandboxManager = async (
	script: string,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	createMessageEventListener: {
		(handler: { (data: unknown[]): void }, worker?: Worker): { (): void };
	},
	createErrorEventListener: {
		(
			handler?: {
				(): void;
			},
			worker?: Worker,
		): { (): void };
	},
	postMessage: { (data: unknown[]): void },
): Promise<void> => {
	const postInitSetup = (worker: Worker) => {
		Logger.info('Sandbox ready. Setting up event listeners.');

		const revokeRootMessageEventListener = createMessageEventListener(
			(data: unknown[]) => {
				if (
					[
						EMessageTypes.REQUEST,
						EMessageTypes.RESULT,
						EMessageTypes.ERROR,
					].includes(data[0] as EMessageTypes)
				) {
					if (data[0] === EMessageTypes.REQUEST) {
						Logger.debug(
							'Forwarding REQUEST from parent to worker for task [' +
								data[1] +
								'] ' +
								data[2],
						);
					} else {
						Logger.debug(
							'Forwarding ' +
								(data[0] === EMessageTypes.RESULT
									? 'RESULT'
									: 'ERROR') +
								' from parent to worker for task [' +
								data[1] +
								']',
						);
					}

					worker.postMessage(data);
				} else if (data[0] === EMessageTypes.DESTROY) {
					Logger.debug('Received DESTROY from parent');

					worker.postMessage(data);

					postMessage = Boolean;

					revokeRootMessageEventListener();
					revokeRootErrorEventListener();

					revokeWorkerMessageEventListener();
					revokeWorkerErrorEventListener();

					worker.terminate();
				}
			},
		);

		const revokeRootErrorEventListener = createErrorEventListener();

		const revokeWorkerMessageEventListener = createMessageEventListener(
			(data: unknown[]) => {
				if (
					![
						EMessageTypes.REQUEST,
						EMessageTypes.RESULT,
						EMessageTypes.ERROR,
					].includes(data[0] as EMessageTypes)
				)
					return;

				if (data[0] === EMessageTypes.REQUEST) {
					Logger.debug(
						'Forwarding REQUEST from worker to parent for executing task [' +
							data[1] +
							'] ' +
							data[2],
					);
				} else {
					Logger.debug(
						'Forwarding ' +
							(data[0] === EMessageTypes.RESULT
								? 'RESULT'
								: 'ERROR') +
							' from worker to parent from executing task [' +
							data[1] +
							']',
					);
				}

				postMessage(data);
			},
			worker,
		);

		const revokeWorkerErrorEventListener = createErrorEventListener(
			undefined,
			worker,
		);

		Logger.info('Sending SANDBOX_READY to parent');
		postMessage([EMessageTypes.SANDBOX_READY]);
	};

	const startWorker = new Promise<Worker>((resolve_, reject_) => {
		const workerSandbox = createWorker(
			script,
			allowedGlobals,
			externalMethodsList,
		);

		let errorTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
		let resolved = false;

		const onInitResult = () => {
			workerSandbox[1]();
			clearTimeout(errorTimeout);
			revokeWorkerInitMessageEventListener();
			revokeWorkerInitErrorEventListener();
		};

		const resolve = () => {
			if (resolved) return;
			resolved = true;

			onInitResult();
			resolve_(workerSandbox[0]);
		};

		const reject = (e: unknown) => {
			if (resolved) return;
			resolved = true;

			onInitResult();
			reject_(e);
			try {
				workerSandbox[0].terminate();
			} catch {
				// empty
			}
		};

		errorTimeout = setTimeout(
			() => reject(new Error('Timed out starting worker')),
			ERROR_TIMEOUT,
		);

		const revokeWorkerInitMessageEventListener = createMessageEventListener(
			(data: unknown[]) => {
				if (data[0] !== EMessageTypes.SANDBOX_READY) return;

				Logger.info('Received SANDBOX_READY from worker');

				resolve();
			},
			workerSandbox[0],
		);

		const revokeWorkerInitErrorEventListener = createErrorEventListener(
			() => {
				Logger.warn('An error occurred during worker initialisation');
				reject(new Error('Error during worker initialisation'));
			},
			workerSandbox[0],
		);
	});

	return await startWorker.then(postInitSetup);
};

export default workerSandboxManager;
