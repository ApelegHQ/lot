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

type TAny = ReturnType<typeof eval>;

const l_Array = Array;
const l_aP = l_Array.prototype;
const l_Object = Object;
const l_oP = l_Object.prototype;

const l_aFilter = l_aP.filter;
const l_aForEach = l_aP.forEach;
const l_aIncludes = l_aP.includes;
const l_aIndexOf = l_aP.indexOf;
const l_aJoin = l_aP.join;
const l_aMap = l_aP.map;
const l_aPush = l_aP.push;
const l_aSlice = l_aP.slice;
const l_aSplice = l_aP.splice;

const l_Function = (() => {}).constructor;
const l_fnpApply = l_Function.apply;
const l_fnpCall = l_Function.call;

const l_crypto = typeof crypto === 'object' ? crypto : undefined;
const l_cGRV = l_crypto?.getRandomValues;

export const S = String;
export const E = Error;
export const EE = EvalError;
export const PM = Promise;
export const PX = Proxy;
export const RE = ReferenceError;
export const TE = TypeError;

export const mR = Math.random;

const l_sP = S.prototype;
const l_sReplace = l_sP.replace;
const l_sIndexOf = l_sP.indexOf;
const l_sSlice = l_sP.slice;
const l_sSplit = l_sP.split;

const l_oHasOwnPropery = l_oP.hasOwnProperty;

const l_Uint8Array = Uint8Array;

export const aFilter = <TT, TU extends TT>(
	a: TT[],
	predicate: { (value: TT, index: number, array: TT[]): value is TU },
	thisArg?: TAny,
): TU[] => fnCall(l_aFilter, a, predicate, thisArg);
export const aForEach = <TT>(
	a: TT[],
	callbackfn: { (value: TT, index: number, array: TT[]): void },
	thisArg?: TAny,
): void => fnCall(l_aForEach, a, callbackfn, thisArg);
export const aFrom = l_Array.from;
export const aIncludes = <TT>(
	a: TT[],
	searchElement: TT,
	fromIndex?: number | undefined,
): boolean => fnCall(l_aIncludes, a, searchElement, fromIndex);
export const aIndexOf = <TT>(
	a: TT[],
	searchElement: TT,
	fromIndexOf?: number | undefined,
): number => fnCall(l_aIndexOf, a, searchElement, fromIndexOf);
export const aJoin = <TT>(a: TT[], separator?: string | undefined): string =>
	fnCall(l_aJoin, a, separator);
export const aIsArray = l_Array.isArray;
export const aMap = <TT, TU>(
	a: TT[],
	callbackfn: (value: TT, index: number, array: TT[]) => TU,
	thisArg?: TAny,
): TU[] => fnCall(l_aMap, a, callbackfn, thisArg);
export const aPush = <TT>(a: TT[], ...items: TT[]): number =>
	fnApply(l_aPush, a, items);
export const aSlice = <TT>(
	a: TT[],
	start?: number | undefined,
	end?: number | undefined,
): TT[] => fnCall(l_aSlice, a, start, end);
export const aSplice = <TT>(
	a: TT[],
	start: number | undefined,
	deleteCount?: number | undefined,
	...items: TT[]
): TT[] => fnCall(l_aSplice, a, start, deleteCount, ...items);

export const fnApply = l_fnpCall.bind(l_fnpApply);
export const fnCall = l_fnpCall.bind(l_fnpCall);

export const oCreate = l_Object.create;
export const oDefineProperties = l_Object.defineProperties;
export const oDefineProperty = l_Object.defineProperty;
export const oEntries = l_Object.entries;
export const oFreeze = l_Object.freeze;
export const oFromEntries = l_Object.fromEntries;
export const oGetOwnPropertyDescriptor = l_Object.getOwnPropertyDescriptor;
export const oGetOwnPropertyDescriptors = l_Object.getOwnPropertyDescriptors;
export const oGetPrototypeOf = l_Object.getPrototypeOf;
export const oHasOwnProperty = (o: object, v: PropertyKey): boolean =>
	fnCall(l_oHasOwnPropery, o, v);
export const oKeys = l_Object.keys;
export const oSetPrototypeOf = l_Object.setPrototypeOf;

export const sFromCharCode = String.fromCharCode;
export const sIndexOf = <TT extends string>(
	s: string,
	searchString: TT,
	position?: number | undefined,
): number => fnCall(l_sIndexOf, s, searchString, position);
export const sReplace = <TT extends string | RegExp, TU>(
	s: string,
	searchValue: TT,
	replaceValue: TU,
): string => fnCall(l_sReplace, s, searchValue, replaceValue);
export const sSlice = <T extends string>(
	s: T,
	start?: number | undefined,
	end?: number | undefined,
): T => fnCall(l_sSlice, s, start, end);
export const sSplit = <T extends string>(
	s: T,
	separator:
		| string
		| RegExp
		| {
				[Symbol.split](
					string: string,
					limit?: number | undefined,
				): string[];
		  },
	limit?: number | undefined,
): T[] => fnCall(l_sSplit, s, separator, limit);

export const u8Alloc = (n: number) => new l_Uint8Array(n);

export const cGRV =
	l_cGRV &&
	(<T extends ArrayBufferView | null>(array: T): T =>
		fnCall(l_cGRV, l_crypto, array));
