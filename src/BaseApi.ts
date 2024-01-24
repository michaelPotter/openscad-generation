'use strict';

export interface OpenSCADCode {
	getCode: () => string[];
}

export type V3 = [number, number, number];
export type V2 = [number, number];
export type Path = V2[];

export type vectorTransform<G extends V2|V3> = (v: V2|V3) => Geometry<G>
export type booleanTransform<G extends V2|V3> = (...g:Geometry<G>[]|Geometry<G>[][]) => Geometry<G>

export interface Geometry<G extends V2|V3> extends OpenSCADCode {
	getSize: () => V3;

	translate: vectorTransform<G>;
	rotate:    vectorTransform<G>;
	mirror:    vectorTransform<G>;
	scale:     vectorTransform<G>;

	union:        booleanTransform<G>;
	difference:   booleanTransform<G>;
	intersection: booleanTransform<G>;
	hull:         booleanTransform<G>;

	highlight : () => Geometry<G>;
	hash      : () => Geometry<G>; // Alias for highlight
	color     : (c: string) => Geometry<G>;

	up    : (n: number) => Geometry<G>;
	down  : (n: number) => Geometry<G>;
	left  : (n: number) => Geometry<G>;
	right : (n: number) => Geometry<G>;
	fwd   : (n: number) => Geometry<G>;
	back  : (n: number) => Geometry<G>;

	serialize: () => string;
}
