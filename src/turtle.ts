'use strict';

import {
	V2,
	Path,
} from './base';

import {
    getUnitVector,
	vAdd,
    vScale,
} from './vectorMath';

import {
	chamferPoints,
} from './PathUtils';

export interface turtle {
	getPath: () => V2[];
	// jump: (v:V2) => turtle;
	north: (n:number) => turtle;
	south: (n:number) => turtle;
	east:  (n:number) => turtle;
	west:  (n:number) => turtle;
	// chamfer: (n:number) => turtle;
}

export class Turtle implements turtle {
	path: V2[];
	pen = {
		x: 0,
		y: 0,
	};
	direction: number = 90;
	pending_operation: null|{
		chamfer?: number,
	} = null;

	private get penAsV(): V2 { return [this.pen.x, this.pen.y]; }

	constructor(startingPoint: V2 = [0,0]) {
		this.path = [startingPoint];
		this.pen.x = startingPoint[0];
		this.pen.y = startingPoint[1];
	}

	// // Sets the turtle to an exact position without drawing a path
	// jump(v:V2) {
	// 	this.pen.x = v[0];
	// 	this.pen.y = v[1];
	// 	return this;
	// }
	// Moves the turtle in the positive Y direction
	north(n:number) {
		this.pen.y += n;
		this.direction = 90;
		this.stepTurtle();
		return this;
	}
	// Moves the turtle in the negative Y direction
	south(n:number) {
		this.pen.y -= n;
		this.stepTurtle();
		this.direction = 270;
		return this;
	}
	// Moves the turtle in the positive X direction
	east(n:number) {
		this.pen.x += n;
		this.stepTurtle();
		this.direction = 0;
		return this;
	}
	// Moves the turtle in the negative X direction
	west(n:number) {
		this.pen.x -= n;
		this.stepTurtle();
		this.direction = 180;
		return this;
	}
	turn(n:number) {
		this.direction += n;
		return this;
	}
	turnLeft(n:number) {
		this.direction += n;
		return this;
	}
	turnRight(n:number) {
		this.direction -= n;
		return this;
	}
	walk(n:number) {
		let newPen = vAdd(vScale(getUnitVector(this.direction), n), this.penAsV);
		this.pen.x = newPen[0]
		this.pen.y = newPen[1]
		this.path.push(newPen)
		return this;
	}
	chamfer(n:number) {
		this.pending_operation = {chamfer: n}
		return this;
	}

	stepTurtle() {
		let penPoint: V2 = [ this.pen.x, this.pen.y ];
		if (this.pending_operation?.chamfer) {
			let chamfer = this.pending_operation.chamfer;
			let midPoint = this.path.pop();
			let startPoint = this.path.pop();
			if (midPoint && startPoint) {
				let newPoints = chamferPoints([startPoint, midPoint, penPoint], chamfer);
				this.path.push(startPoint);
				this.path.push(...newPoints);
				this.path.push(penPoint);
				this.pending_operation = null;
			} else {
				console.warn("Too few points in turtle path to chamfer?");
			}
		} else {
			this.path.push(penPoint);
		}
	}

	/**
	 * Return the path walked by this turtle.
	 */
	getPath(): Path {
		return this.path;
	}

}
