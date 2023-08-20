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

import * as workerSandboxInit from 'inline:~untrusted/impl/worker/workerSandboxInit.inline.js';
import * as Logger from '~untrusted/lib/Logger.js';
import type createErrorEventListenerFactory from '~untrusted/lib/createErrorEventEventListenerFactory.js';
import type createMessageEventListenerFactory from '~untrusted/lib/createMessageEventListenerFactory.js';
import { reconstructErrorInformation } from '~untrusted/lib/errorModem.js';
import type { TSandboxOptions } from '~/types/index.js';
import type workerSandboxInner from '~untrusted/impl/worker/workerSandboxInner.js';

// Timeout for worker initialisation (in ms)
const ERROR_TIMEOUT = __buildtimeSettings__.innerSandboxInitDeadlineInMs;

/**
 * Create a Web Worker instance with provided scripts and configurations.
 *
 * @param script - The script content to be executed inside the worker.
 * @param script - The script to be executed in the iframe or its worker.
 * @param revocable - Determines if the sandbox can be torn down.
 * @param allowedGlobals - List of global properties/methods that should remain
 * accessible.
 * @param externalMethodsList - List of external methods available to the
 * sandboxed environment.
 * @param options - Optional configuration parameters.
 * @returns Tuple containing the worker instance and a function to revoke the
 * worker source URL.
 */
const createWorker = (
	script: string,
	revocable: boolean,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	options?: TSandboxOptions,
): [Worker, { (): void }] => {
	const blob = new Blob([workerSandboxInit.default], {
		['type']: 'text/javascript',
	});
	const workerSrcUrl = globalThis.URL.createObjectURL(blob);
	// Option name extracted as string constant to avoid name mangling
	const typeOptName = 'workerType';
	const worker = new Worker(
		workerSrcUrl,
		options?.[typeOptName] ? { ['type']: options[typeOptName] } : undefined,
	);

	worker.postMessage([
		EMessageTypes.SANDBOX_READY,
		script,
		revocable,
		false,
		allowedGlobals,
		externalMethodsList,
	] as [
		EMessageTypes.SANDBOX_READY,
		...Parameters<typeof workerSandboxInner>,
	]);

	const revokeWorkerSrcUrl = globalThis.URL.revokeObjectURL.bind(
		null,
		workerSrcUrl,
	);

	return [worker, revokeWorkerSrcUrl];
};

/**
 * Manages the Web Worker sandbox environment, either setting it up or handling
 * any encountered errors.
 *
 * @param messagePort - The communication channel to the main context.
 * @param script - The script to be executed in the iframe or its worker.
 * @param revocable - Determines if the sandbox can be torn down.
 * @param allowedGlobals - List of global properties/methods that should remain
 * accessible.
 * @param externalMethodsList - List of external methods available to the
 * sandboxed environment.
 * @param createMessageEventListener - A factory function to create message
 * event listeners.
 * @param createErrorEventListener - A factory function to create an error event
 * listeners.
 * @param postMessageOutgoing - A function to post outgoing messages to the main
 * context.
 * @param options - Optional configuration parameters.
 * @param teardown - Optional function to release resources.
 * @returns A promise that settles when the setup is complete or on error.
 * @throws Will throw an error if there's an issue with setting up the
 * worker sandbox.
 */
const workerSandboxManager = async (
	messagePort: MessagePort,
	script: string,
	revocable: boolean,
	allowedGlobals: string[] | undefined | null,
	externalMethodsList: string[] | undefined | null,
	createMessageEventListener: ReturnType<
		typeof createMessageEventListenerFactory
	>,
	createErrorEventListener: ReturnType<
		typeof createErrorEventListenerFactory
	>,
	options?: TSandboxOptions,
	teardown?: { (): void },
): Promise<void> => {
	let postMessageOutgoing = messagePort.postMessage.bind(messagePort);

	const postInitSetup = (worker: Worker) => {
		Logger.info('Sandbox ready. Setting up event listeners.');

		const revokeRootMessageEventListener = createMessageEventListener(
			messagePort,
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

					postMessageOutgoing = Boolean;

					revokeRootMessageEventListener();
					revokeRootErrorEventListener();

					revokeWorkerMessageEventListener();
					revokeWorkerErrorEventListener();

					worker.terminate();

					if (typeof teardown === 'function') {
						teardown();
					}
				}
			},
		);

		const revokeRootErrorEventListener = createErrorEventListener();

		const revokeWorkerMessageEventListener = createMessageEventListener(
			worker,
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

				postMessageOutgoing(data);
			},
		);

		const revokeWorkerErrorEventListener = createErrorEventListener(
			undefined,
			worker,
		);

		Logger.info('Sending SANDBOX_READY to parent');
		postMessageOutgoing([EMessageTypes.SANDBOX_READY]);
	};

	const startWorker = new Promise<Worker>((resolve_, reject_) => {
		const workerSandbox = createWorker(
			script,
			revocable,
			allowedGlobals,
			externalMethodsList,
			options,
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

				if (typeof teardown === 'function') {
					teardown();
				}
			} catch {
				// empty
			}
		};

		errorTimeout = setTimeout(
			() => reject(new Error('Timed out starting worker')),
			ERROR_TIMEOUT,
		);

		const revokeWorkerInitMessageEventListener = createMessageEventListener(
			workerSandbox[0],
			(data: unknown[]) => {
				if (
					![
						EMessageTypes.SANDBOX_READY,
						EMessageTypes.GLOBAL_ERROR,
					].includes(data[0] as EMessageTypes)
				)
					return;

				if (data[0] === EMessageTypes.SANDBOX_READY) {
					Logger.info('Received SANDBOX_READY from worker');

					resolve();
				} else {
					Logger.info('Received GLOBAL_ERROR from worker');

					reject(reconstructErrorInformation(data[1]));
				}
			},
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
