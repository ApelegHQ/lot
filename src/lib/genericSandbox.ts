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

import * as fixGlobalTypes from 'inline:./fixGlobalTypes.inline.js';
import { IPerformTask, TContext } from '../types/index.js';
import global from './global.js';

const createWrapperFn = <T extends { (s: string): ReturnType<T> }>(
	script: string,
	Function: T,
): ReturnType<T> => {
	// It is possible for a malicious script to escape the
	// with block by ending with `});} { <code here >; ({`
	// This is imperfectly mitigated by adding a random number of
	// braces
	const guardCount =
		(global.crypto?.getRandomValues(new Uint16Array(1))[0] ??
			(Math.random() * 65536) | 0) & 0x7ff;
	const sandboxWrapperFn = Function(
		'with(this){' +
			`~function(){${fixGlobalTypes.default}}();` +
			'(function(){' +
			"'use strict';" +
			'{'.repeat(guardCount) +
			script +
			'\r\n/*`*/' +
			'}'.repeat(guardCount) +
			'})();' +
			'}',
	);

	return sandboxWrapperFn;
};

const createContext = (
	allowedGlobals?: string[] | undefined | null,
	externalCallMethod?: IPerformTask | null,
	externalMethodsList?: string[] | null,
): TContext => {
	const allowedProps =
		(Array.isArray(allowedGlobals) && allowedGlobals) ||
		__buildtimeSettings__.defaultAllowedGlobalProps;

	const sandboxWrapperThis = Object.create(
		null,
		Object.fromEntries(
			allowedProps
				.map((prop) => [
					prop,
					Object.getOwnPropertyDescriptor(global, prop),
				])
				.filter(([, d]) => !!d),
		),
	);

	Object.defineProperties(sandboxWrapperThis, {
		['global']: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		['globalThis']: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		['self']: {
			writable: true,
			configurable: true,
			value: sandboxWrapperThis,
		},
		['module']: {
			value: Object.create(null, {
				['exports']: {
					value: Object.create(null),
					writable: true,
					enumerable: true,
					configurable: true,
				},
			}),
		},
	});

	if (externalCallMethod && Array.isArray(externalMethodsList)) {
		Object.defineProperties(
			sandboxWrapperThis,
			Object.fromEntries(
				externalMethodsList.map((external) => [
					external,
					{
						configurable: true,
						writable: false,
						enumerable: true,
						value: externalCallMethod.bind(null, external),
					},
				]),
			),
		);
	}

	return sandboxWrapperThis;
};

const genericSandbox = (
	script: string,
	allowedGlobals: string[] | undefined | null,
	Function: (typeof global)['Function'],
	externalCallMethod?: IPerformTask | null,
	externalMethodsList?: string[] | null,
): { fn: { (): void }; ctx: TContext; revoke: { (): void } } => {
	if (
		!__buildtimeSettings__.bidirectionalMessaging &&
		(externalCallMethod || externalMethodsList)
	) {
		throw new TypeError(
			'Invalid value for externalCallMethod or externalMethodsList. Bidirectional messaging is disabled',
		);
	}

	const sandboxWrapperThis = createContext(
		allowedGlobals,
		externalCallMethod,
		externalMethodsList,
	);

	const sandboxWrapperThisProxy = Proxy.revocable(sandboxWrapperThis, {
		['get'](o, p) {
			return o[p];
		},
		['has']() {
			return true;
		},
	});

	const sandboxWrapperFn = createWrapperFn(script, Function);

	return {
		fn: sandboxWrapperFn.bind(sandboxWrapperThisProxy.proxy),
		ctx: sandboxWrapperThisProxy.proxy,
		revoke: sandboxWrapperThisProxy.revoke,
	};
};

export default genericSandbox;
export { createWrapperFn, createContext };
