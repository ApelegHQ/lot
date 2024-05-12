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

import '~untrusted/lib/nodejsLoadWebcrypto.js'; // MUST BEFORE ANY LOCAL IMPORTS

import * as nodejsSandboxInit from 'inline:./nodejsSandboxInit.inline.js';
import vm from 'node:vm';
import {
	isMainThread,
	moveMessagePortToContext,
	workerData,
} from 'node:worker_threads';
import type { MessagePort as WTMessagePort } from 'node:worker_threads';
import createWrapperFn from '~untrusted/lib/createWrapperFn.js';
import hardenGlobals from '~untrusted/lib/hardenGlobals.js';
import scopedTimerFunction from '~untrusted/lib/scopedTimerFunction.js';
import { INTERNAL_SOURCE_STRING } from './constants.js';
import { MC, aIsArray } from '~/untrusted/lib/utils.js';

if (isMainThread) throw new Error('Invalid environment');

const {
	JSON: g_JSON,
	Object: g_Object,
	TypeError: g_TypeError,
	atob: g_atob,
	btoa: g_btoa,
	clearInterval: g_clearInterval,
	clearTimeout: g_clearTimeout,
	setInterval: g_setInterval,
	setTimeout: g_setTimeout,
} = global;

// Needed for CC
const exit = 'exit';
const env = 'env';
const NODE_ENV = 'NODE_ENV';

const close = process[exit].bind(process, 0);
const getRandomValues = globalThis.crypto.getRandomValues.bind(crypto);

const removeAllProperties = (o: unknown, keep?: PropertyKey[]) => {
	o &&
		g_Object
			.entries(g_Object.getOwnPropertyDescriptors(o))
			.forEach(([name, descriptor]) => {
				if (keep?.includes(name)) return;
				if (descriptor['configurable']) {
					delete (o as ReturnType<typeof eval>)[name];
				}
			});
};

const oneTimeCtxValue = <T>(
	sandboxId: string,
	context: object,
	k: PropertyKey,
	v: T,
) => {
	g_Object.defineProperty(context, k, {
		['configurable']: true,
		['get']: vm.compileFunction(
			'return function(){delete this[k];return v;};',
			['k', 'v'],
			g_Object.fromEntries([
				['filename', sandboxId + '-otcv.vm.js'],
				['parsingContext', context],
			]),
		)(k, v),
	});
};

export type TNodejsSandbox = {
	(
		sandboxId: string,
		messagePort: MessagePort,
		script: string,
		externalMethodKeys?: string[] | null | undefined,
	): void;
};

const nodejsSandbox: TNodejsSandbox = (
	sandboxId,
	messagePort,
	script,
	externalMethodKeys,
) => {
	if (!__buildtimeSettings__.bidirectionalMessaging && externalMethodKeys) {
		throw new g_TypeError(
			'Invalid value for externalMethods. Bidirectional messaging is disabled',
		);
	}

	const context = g_Object.create(null);

	const [scopedSetTimeout, scopedClearTimeout] =
		__buildtimeSettings__.scopedTimerFunctions
			? scopedTimerFunction(g_setTimeout, g_clearTimeout)
			: [g_setTimeout, g_clearTimeout];
	const [scopedSetInterval, scopedClearInterval] =
		__buildtimeSettings__.scopedTimerFunctions
			? scopedTimerFunction(g_setInterval, g_clearInterval)
			: [g_setInterval, g_clearInterval];

	// These are some functions to expose to the sandbox that Node.js does
	// not provide with vm, as well as some utility functions for communication
	// (addEventListener, removeEventListener, postMessage) and management
	// (close, Function)
	g_Object.defineProperties(
		context,
		g_Object.fromEntries([
			...(!__buildtimeSettings__.contextifyMessagePort
				? [
						[
							'addEventListener',
							{
								['writable']: true,
								['configurable']: true,
								['value']:
									EventTarget.prototype.addEventListener.bind(
										messagePort,
									),
							},
						],
						[
							'removeEventListener',
							{
								['writable']: true,
								['configurable']: true,
								['value']:
									EventTarget.prototype.removeEventListener.bind(
										messagePort,
									),
							},
						],
						[
							'postMessage',
							{
								['writable']: true,
								['configurable']: true,
								['value']:
									messagePort.postMessage.bind(messagePort),
							},
						],
					]
				: []),
			[
				'close',
				{
					['writable']: true,
					['configurable']: true,
					['value']: () => {
						g_setTimeout(
							close,
							// Necessary small delay to ensure exceptions get delivered
							__buildtimeSettings__.contextifyMessagePort ? 5 : 0,
						);
					},
				},
			],
			[
				'crypto',
				{
					['configurable']: true,
					['enumerable']: true,
					['value']: g_Object.create(
						null,
						g_Object.fromEntries([
							[
								'getRandomValues',
								{
									['writable']: true,
									['enumerable']: true,
									['configurable']: true,
									['value']: getRandomValues,
								},
							],
						]),
					),
				},
			],
			[
				'globalThis',
				{
					['writable']: true,
					['configurable']: true,
					['value']: context,
				},
			],
			[
				'atob',
				{
					['writable']: true,
					['configurable']: true,
					['value']: g_atob,
				},
			],
			[
				'btoa',
				{
					['writable']: true,
					['configurable']: true,
					['value']: g_btoa,
				},
			],
			[
				'clearInterval',
				{
					['writable']: true,
					['configurable']: true,
					['value']: scopedClearInterval,
				},
			],
			[
				'clearTimeout',
				{
					['writable']: true,
					['configurable']: true,
					['value']: scopedClearTimeout,
				},
			],
			[
				'setInterval',
				{
					['writable']: true,
					['configurable']: true,
					['value']: scopedSetInterval,
				},
			],
			[
				'setTimeout',
				{
					['writable']: true,
					['configurable']: true,
					['value']: scopedSetTimeout,
				},
			],
			...(__buildtimeSettings__.bidirectionalMessaging
				? [
						[
							'MessageChannel',
							{
								['writable']: true,
								['configurable']: true,
								['value']:
									__buildtimeSettings__.contextifyMessagePort
										? function (this: {
												['port1']: WTMessagePort;
												['port2']: WTMessagePort;
											}) {
												const mc = new MC();
												this['port1'] =
													moveMessagePortToContext(
														mc[
															'port1'
														] as unknown as WTMessagePort,
														context,
													);
												this['port2'] =
													moveMessagePortToContext(
														mc[
															'port2'
														] as unknown as WTMessagePort,
														context,
													);
											}
										: MC,
							},
						],
					]
				: []),
		]),
	);

	const result = vm.createContext(
		context,
		g_Object.fromEntries([
			[
				'codeGeneration',
				g_Object.fromEntries([
					['strings', false],
					['wasm', false],
				]),
			],
		]),
	);

	if (!result) {
		throw new Error('Unable to create context');
	}

	if (__buildtimeSettings__.contextifyMessagePort) {
		if (__buildtimeSettings__.contextifyMessagePortWorkaroundCrash) {
			const messageChannel = new MC();

			messageChannel['port1'].onmessage = (ev) => {
				if (
					aIsArray(ev.data) &&
					ev.data[0] === EMessageTypes.REQUEST &&
					typeof ev.data[1] === 'object'
				) {
					messagePort.postMessage(ev.data, [ev.data[1]]);
				} else {
					messagePort.postMessage(ev.data);
				}
			};

			messagePort.onmessage = (ev) => {
				if (
					aIsArray(ev.data) &&
					ev.data[0] === EMessageTypes.REQUEST &&
					typeof ev.data[1] === 'object'
				) {
					const innerMessageChannel = new MC();
					const origMessagePort = ev.data[1];
					ev.data[1] = moveMessagePortToContext(
						innerMessageChannel[
							'port2'
						] as unknown as WTMessagePort,
						context,
					);
					innerMessageChannel['port1'].onmessage = (ev) => {
						origMessagePort.postMessage(ev.data);
						innerMessageChannel['port1'].close();
					};
					innerMessageChannel['port1'].start();
					messageChannel['port1'].postMessage(ev.data, [ev.data[1]]);
				} else {
					messageChannel['port1'].postMessage(ev.data);
				}
			};

			oneTimeCtxValue(
				sandboxId,
				context,
				'%__messagePort__',
				moveMessagePortToContext(
					messageChannel['port2'] as ReturnType<typeof eval>,
					context,
				),
			);
		} else {
			oneTimeCtxValue(
				sandboxId,
				context,
				'%__messagePort__',
				moveMessagePortToContext(
					messagePort as ReturnType<typeof eval>,
					context,
				),
			);
		}
	}

	const displayErrors = process[env][NODE_ENV] !== 'production';

	// Remove properties from most built-in modules. This should somewhat
	// limit the access to system resources in case of an escape
	(module.constructor as unknown as { builtinModules?: string[] })[
		'builtinModules'
	]?.forEach((v) => {
		if (
			[
				'assert/strict',
				'async_hooks',
				'buffer',
				'events',
				'diagnostics_channel',
				'_http_agent',
				'_http_common',
				'_http_outgoing',
				'_http_server',
				'inspector',
				'module',
				'net',
				'path',
				'path/posix',
				'path/win32',
				'perf_hooks',
				'process',
				'stream',
				'readline',
				'trace_events',
				'v8',
				'vm',
			].includes(v)
		)
			return;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		removeAllProperties(require('node:' + v));
	});
	// Prevent loading CJS modules
	g_Object.defineProperty(global.module.constructor, '_load', {
		['set']: () => {},
	});
	// Remove references in global and process to prevent calling require, etc.
	removeAllProperties(process, [
		'_fatalException',
		'debugPort',
		'exit',
		'hrtime',
		'nextTick',
		'reallyExit',
		'report',
		'stderr',
		'stdin',
		'stdout',
	]);
	removeAllProperties(global);

	const wrapperFn = createWrapperFn(script, (s: string) => {
		return vm.compileFunction(
			s,
			undefined,
			g_Object.fromEntries([
				['filename', sandboxId + '-usertext.vm.js'],
				['parsingContext', context],
			]),
		);
	});

	// Due to how the Sandbox is constructed, it will attempt to dynamically
	// execute the sandbox source using Function. However, Function will
	// not work inside the vm context, as dynamic eval has been disabled
	// The function is provided upon vm initialisation instead, and
	// Function is defined to return that function instead.
	// This function will be called exactly once
	oneTimeCtxValue(sandboxId, context, '%__user_text__', wrapperFn);
	vm.runInContext(
		// Shadow Function to avoid changing the global namespace
		'(function(Function){\r\n' +
			nodejsSandboxInit.default +
			'\r\n}).call(' +
			'globalThis,' +
			'(function(c,lio,ut){' +
			'"use strict";' +
			'c=c.bind(c);' +
			'return function(src){' +
			`if(c(lio,src,${g_JSON.stringify(INTERNAL_SOURCE_STRING)})===-1)` +
			'throw "Invalid call";' +
			// If source includes /*@lint@*/, the constructor is called just for
			// syntax validation
			'if(c(lio,src,"/*@lint@*/")!==-1)return function(){};' +
			'var tmp=ut;' +
			'c=lio=ut=void 0;' +
			'return tmp;' +
			'};' +
			'})(' +
			'Function.prototype.call,' +
			'String.prototype.lastIndexOf,' +
			'globalThis["%__user_text__"])' +
			');' +
			'delete globalThis["%__user_text__"];',
		context,
		g_Object.fromEntries([
			['displayErrors', displayErrors],
			['filename', sandboxId + '-system.vm.js'],
		]),
	);
};

hardenGlobals();

nodejsSandbox(...(workerData as Parameters<typeof nodejsSandbox>));
