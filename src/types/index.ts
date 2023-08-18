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

export interface IPerformTask {
	(op: string, ...args: unknown[]): Promise<unknown>;
}

export interface ISandbox {
	(
		script: string,
		allowedGlobals?: string[] | undefined | null,
		externalMethods?: Record<string, unknown> | null,
		abort?: AbortSignal,
		options?: TSandboxOptions,
	): Promise<IPerformTask>;
}

export type TContext = Record<PropertyKey, unknown> & {
	globalThis: TContext;
	module: { exports: unknown };
};

export type TSandboxOptions = {
	browserRequireWorker?: boolean;
	workerType?: WorkerOptions['type'];
};
