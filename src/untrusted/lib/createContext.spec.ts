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

if (typeof __buildtimeSettings__ !== 'object')
	Reflect.set(globalThis, '__buildtimeSettings__', {});

Reflect.set(__buildtimeSettings__, 'bidirectionalMessaging', true);
Reflect.set(__buildtimeSettings__, 'defaultAllowedGlobalProps', []);

import assert from 'node:assert/strict';
import createContext, { setupExternalMethods } from './createContext.js';

describe('Sandbox Context Creation', () => {
	describe('createContext', () => {
		it('should return a sandboxed context with allowed globals', () => {
			const allowedGlobals = ['Date', 'Math', 'parseInt'];
			const ctx = createContext(allowedGlobals);

			assert.equal(typeof ctx.Date, 'function');
			assert.notEqual(ctx.Date, global.Date);
			assert.ok(new (ctx.Date as typeof Date)() instanceof global.Date);
			assert.equal(typeof ctx.parseInt, 'function');
			assert.notEqual(ctx.parseInt, global.parseInt);
			assert.equal(
				(ctx.Date as typeof Date).prototype,
				global.Date.prototype,
			);
			assert.equal(ctx.Math, global.Math);
			assert.equal(ctx.Object, undefined);
		});

		it('should setup external methods if provided', () => {
			const externalMethods = ['externalMethod1', 'externalMethod2'];
			const mockExternalCall = async () => {};

			const ctx = createContext(
				undefined,
				mockExternalCall,
				externalMethods,
			);
			assert.equal(typeof ctx.externalMethod1, 'function');
			assert.equal(typeof ctx.externalMethod2, 'function');
		});
	});

	describe('setupExternalMethods', () => {
		it('should setup specified external methods on context', () => {
			const mockContext: Record<PropertyKey, unknown> = {};
			const externalMethods = ['method1', 'method2'];
			const mockExternalCall = async () => {};

			setupExternalMethods(
				mockContext,
				mockExternalCall,
				externalMethods,
			);
			assert.equal(typeof mockContext.method1, 'function');
			assert.equal(typeof mockContext.method2, 'function');
		});
	});
});
