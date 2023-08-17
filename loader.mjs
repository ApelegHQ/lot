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

import module from 'node:module';
import { resolve as resolveTs } from 'ts-node/esm';
import importMap from './import_map.json' assert { type: 'json' };
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export * from 'ts-node/esm';

const absoluteBaseUrl = new URL('.', import.meta.url).toString();

const originalResolve = module._resolveFilename;

module._resolveFilename = (...args) => {
	let specifier = args[0];

	if (typeof specifier === 'string') {
		Object.entries(importMap.imports).forEach(([k, v]) => {
			if (specifier.startsWith(k)) {
				specifier = join(
					fileURLToPath(absoluteBaseUrl),
					specifier.replace(k, v),
				);
			}
		});
	}

	args[0] = specifier;

	return originalResolve.call(module, ...args);
};

export const resolve = (specifier, context, defaultResolver) => {
	if (typeof specifier === 'string') {
		Object.entries(importMap.imports).forEach(([k, v]) => {
			if (specifier.startsWith(absoluteBaseUrl + k))
				specifier = specifier.replace(k, v);
		});
	}

	return resolveTs(specifier, context, defaultResolver);
};
