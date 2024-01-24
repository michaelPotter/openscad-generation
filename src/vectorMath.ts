'use strict';

import {
	V2,
	V3,
} from './base';

// TODO move to another file? it's not really math
export function V2toString(v: V2): string {
	return `[${v[0]}, ${v[1]}]`;
}
export function V3toString(v: V3): string {
	return `[${v[0]}, ${v[1]}, ${v[2]}]`;
}
export function V2or3toString(v: V2|V3): string {
	return v.length == 2 ? V2toString(v) : V3toString(v);
}

/**
 * Return true if two vectors are equal.
 */
export function vEquals(v1: V2|V3, v2: V2|V3): boolean {
	return v1.length === v2.length &&
		v1[0] == v2[0] &&
		v1[1] == v2[1] &&
		v1[2] == v2[2]
}

/**
 * Return the delta vector between two vectors
 */
export function vDelta(v1: V2, v2: V2): V2;
export function vDelta(v1: V3, v2: V3): V3;
export function vDelta(v1: V2|V3, v2: V2|V3): V3;
export function vDelta(v1: V2|V3, v2: V2|V3): V2|V3 {
	if (v1.length == 2 && v2.length == 2) {
		return [v2[0] - v1[0], v2[1] - v1[1]];
	} else {
		return [v2[0] - v1[0], v2[1] - v1[1], (v2[2] ?? 0) - (v1[2] ?? 0)];
	}
}

/**
 * Adds two vectors.
 * Curryable, so a vector can be added to many vectors like so: vlist.map(vAdd(v))
 */
export function vAdd(v1: V2, v2: V2): V2;
export function vAdd(v1: V2, v2: V3): V3;
export function vAdd(v1: V3, v2: V2): V3;
export function vAdd(v1: V3, v2: V3): V3;
//
export function vAdd(v1: V2): <T extends V2|V3>(v:T) => T;
export function vAdd(v1: V3): (v:V2|V3) => V3;
// Impl
export function vAdd(v1: V2|V3, v2?: V2|V3): V2|V3|((v:V2|V3)=>V3)|(<T extends V2|V3>(v:T)=>T) {
	if (v2 == undefined) {
		return function vAddInner<T extends V2|V3>(v2: T): T {
			// @ts-ignore // 
			return vAdd(v1, v2);
		};
	} else if (v1.length == 2 && v2.length == 2) {
		return [v1[0] + v2[0], v1[1] + v2[1]];
	} else {
		return [v1[0] + v2[0], v1[1] + v2[1], (v1[2] ?? 0) + (v1[2] ?? 0)];
	}
}

/**
 * Multiplies two vectors.
 * Curryable, so a vector can be added to many vectors like so: vlist.map(vMult(v))
 */
export function vMult(v1: V2, v2: V2): V2;
export function vMult(v1: V2, v2: V3): V3;
export function vMult(v1: V3, v2: V2): V3;
export function vMult(v1: V3, v2: V3): V3;
//
export function vMult(v1: V2): <T extends V2|V3>(v:T) => T;
export function vMult(v1: V3): (v:V2|V3) => V3;
// Impl
export function vMult(v1: V2|V3, v2?: V2|V3): V2|V3|((v:V2|V3)=>V3)|(<T extends V2|V3>(v:T)=>T) {
	if (v2 == undefined) {
		return function vMultInner<T extends V2|V3>(v2: T): T {
			// @ts-ignore // 
			return vMult(v1, v2);
		};
	} else if (v1.length == 2 && v2.length == 2) {
		return [v1[0] * v2[0], v1[1] * v2[1]];
	} else {
		return [v1[0] * v2[0], v1[1] * v2[1], (v1[2] ?? 0) * (v1[2] ?? 0)];
	}
}

/**
 * Scale a vector by some amount.
 */
export function vScale(l:number, v: V3): V3;
export function vScale(l:number, v: V2): V2;
export function vScale(v: V3, l:number): V3;
export function vScale(v: V2, l:number): V2;
export function vScale(a: V2|V3|number, b:V2|V3|number): V2|V3 {
	let v: V2|V3;
	let l: number;
	if (typeof a == "number") {
		l = a;
		v = b as V2|V3;
	} else {
		l = b as number;
		v = a as V2|V3;
	}

	if (v.length == 2) {
		return [v[0] * l, v[1] * l];
	} else {
		return [v[0] * l, v[1] * l, v[2] * l];
	}
}

/**
 * Negate all components of a vector.
 */
export function vInverse(v: V2): V2;
export function vInverse(v: V3): V3;
export function vInverse(v: V2|V3): V2|V3 {
	if (v.length == 2) {
		return [-v[0], -v[1]];
	} else {
		return [-v[0], -v[1], -v[2]];
	}
}

/**
 * For fluent style vector math
 */
export class VectorChain {
	v: V2;
	constructor(v:V2) {
		this.v = v;
	}
	add(v:V2): VectorChain { return new VectorChain(vAdd(v, this.v)) ; }
	mult(v:V2): VectorChain { return new VectorChain(vMult(v, this.v)) ; }
	get(): V2 { return this.v; }
}
export function vectorChain(v:V2) { return new VectorChain(v); }

/*
 * Multiply two matrices
 */
export function matrixMultiply(matrix1: number[][], matrix2: number[][]) {
  // Check if the matrices can be multiplied
  if (matrix1[0].length !== matrix2.length) {
    throw new Error('Matrix dimensions are not compatible for multiplication');
  }

  // Create the result matrix with appropriate dimensions
  const result: number[][] = [];
  for (let i = 0; i < matrix1.length; i++) {
    result[i] = new Array(matrix2[0].length).fill(0);
  }

  // Perform matrix multiplication
  for (let i = 0; i < matrix1.length; i++) {
    for (let j = 0; j < matrix2[0].length; j++) {
      for (let k = 0; k < matrix2.length; k++) {
        result[i][j] += matrix1[i][k] * matrix2[k][j];
      }
    }
  }

  return result;
}

/**
 * Set the z component of a vector.
 * Given a v2, adds a 3rd component.
 * Given a V3, overwrites the existing z value.
 */
export function setZ(v: V2|V3, z: number): V3 {
	return [v[0], v[1], z];
}

/**
 * Returns a vector normal to the given vector.
 */
export function getNormalVector(v: V2): V2 {
	return [v[1], -v[0]];
}

/**
 * Returns a new vector pointing in the same direction, but with the given length.
 */
export function setVectorLength(v: V2, l: number): V2 {
	let ratio = l / getVectorLength(v);
	return [v[0] * ratio, v[1] * ratio];
}

/**
 * Returns the length of the given vector (pythagorean theorem)
 */
export function getVectorLength(v: V2): number {
	return Math.sqrt(Math.pow(v[1], 2) + Math.pow(v[0], 2));
}

/**
 * Returns the unit vector for a given angle (in degrees)
 */
export function getUnitVector(angle: number): V2 {
	let angleInRads = angle / 180 * Math.PI;
	return [Math.cos(angleInRads), Math.sin(angleInRads)];
}

/**
 * Returns the number of degrees of the angle from the x-axis to the given vector.
 * If one point is given, the vector is assumed to start from the origin.
 * If two points are given, the vector starts at point a and ends at point b.
 */
export function getVectorAngle(start: V2, end: V2): number;
export function getVectorAngle(v: V2): number;
export function getVectorAngle(a: V2, b?: V2): number {
	let start: V2, end: V2;
	if (b == undefined) {
		start = [0, 0], end = a;
	} else {
		start = a, end = b;
	}
	let delta = vDelta(start, end);
	let a2 = Math.atan2(delta[1], delta[0]) * 180 / Math.PI;
	return a2;
}
