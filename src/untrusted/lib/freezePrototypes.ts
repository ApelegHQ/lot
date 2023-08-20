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

import {
	S,
	aFilter,
	aForEach,
	aFrom,
	aIndexOf,
	oEntries,
	oFreeze,
	oGetOwnPropertyDescriptors,
	oGetPrototypeOf,
	sIndexOf,
} from './utils.js';

/**
 * Recursively collects prototypes that can be frozen into a set.
 *
 * @param object - The object whose prototypes should be collected.
 * @param exclude - Array of property keys to exclude from the collection process.
 * @param set - Set to which the freezable prototypes will be added.
 */
const collectFreezablePrototypes = (
	object: Record<PropertyKey, unknown> | typeof Function.prototype,
	exclude: PropertyKey[],
	set: Set<unknown>,
) => {
	if (set.has(object)) return;
	set.add(object);
	aForEach(
		aFilter(
			oEntries(oGetOwnPropertyDescriptors(object)),
			(v): v is typeof v => aIndexOf(exclude, v[0]) === -1,
		),
		([, d]) => {
			aForEach([d.value, d.get, d.set], (v) => {
				if (
					(typeof v === 'function' &&
						sIndexOf(S(v), '[native code]') === -1) ||
					(v && typeof v === 'object')
				) {
					set.add(v);
					let protoAttr: ReturnType<typeof eval>;
					if ('prototype' in (v as typeof Function.prototype)) {
						const protoAttr = (v as typeof Function.prototype)
							.prototype;
						if (protoAttr != null) {
							collectFreezablePrototypes(protoAttr, exclude, set);
						}
					}
					const proto = oGetPrototypeOf(v);
					if (protoAttr != null && protoAttr !== proto) {
						collectFreezablePrototypes(protoAttr, exclude, set);
					}
				}
			});
		},
	);
};

/**
 * Freeze the prototypes of various global objects and functions.
 *
 * This method aims to improve the immutability and safety of an environment by
 * freezing prototypes of commonly used objects and functions, thereby
 * preventing modifications to these prototypes.
 */
const freezePrototypes = () => {
	const set = new Set<unknown>();
	collectFreezablePrototypes(globalThis, [], set);
	collectFreezablePrototypes((async () => {}).constructor, [], set);
	collectFreezablePrototypes(function* () {}.constructor, [], set);
	collectFreezablePrototypes(async function* () {}.constructor, [], set);

	aForEach(aFrom(set), (p) => {
		if (p === globalThis) return;
		try {
			oFreeze(p);
		} catch {
			// empty
		}
	});
};

export default freezePrototypes;
