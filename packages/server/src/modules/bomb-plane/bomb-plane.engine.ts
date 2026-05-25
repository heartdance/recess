import { Injectable } from '@nestjs/common';

// Plane shape relative offsets from head (direction = 'up')
// Head(0,0) + Wings(row1,5cells) + Body(row2,row3) + Tail(row4,3cells) = 11 cells
const PLANE_OFFSETS: Record<string, Array<{ dr: number; dc: number }>> = {
  up: [
    { dr: 0, dc: 0 },   // head
    { dr: 1, dc: -2 },  // left wing
    { dr: 1, dc: -1 },
    { dr: 1, dc: 0 },   // center wing
    { dr: 1, dc: 1 },
    { dr: 1, dc: 2 },   // right wing
    { dr: 2, dc: 0 },   // body
    { dr: 3, dc: 0 },   // body
    { dr: 4, dc: -1 },  // left tail
    { dr: 4, dc: 0 },   // center tail
    { dr: 4, dc: 1 },   // right tail
  ],
  down: [
    { dr: 0, dc: 0 },
    { dr: -1, dc: -2 },
    { dr: -1, dc: -1 },
    { dr: -1, dc: 0 },
    { dr: -1, dc: 1 },
    { dr: -1, dc: 2 },
    { dr: -2, dc: 0 },
    { dr: -3, dc: 0 },
    { dr: -4, dc: -1 },
    { dr: -4, dc: 0 },
    { dr: -4, dc: 1 },
  ],
  left: [
    { dr: 0, dc: 0 },
    { dr: -2, dc: -1 },
    { dr: -1, dc: -1 },
    { dr: 0, dc: -1 },
    { dr: 1, dc: -1 },
    { dr: 2, dc: -1 },
    { dr: 0, dc: -2 },
    { dr: 0, dc: -3 },
    { dr: -1, dc: -4 },
    { dr: 0, dc: -4 },
    { dr: 1, dc: -4 },
  ],
  right: [
    { dr: 0, dc: 0 },
    { dr: -2, dc: 1 },
    { dr: -1, dc: 1 },
    { dr: 0, dc: 1 },
    { dr: 1, dc: 1 },
    { dr: 2, dc: 1 },
    { dr: 0, dc: 2 },
    { dr: 0, dc: 3 },
    { dr: -1, dc: 4 },
    { dr: 0, dc: 4 },
    { dr: 1, dc: 4 },
  ],
};

export interface PlanePlacement {
  head: { row: number; col: number };
  direction: 'up' | 'down' | 'left' | 'right';
}

export type CellState = 'empty' | 'body' | 'head';
export type AttackResult = 'miss' | 'hit' | 'headshot';

@Injectable()
export class BombPlaneEngine {
  // Get absolute cell positions for a plane
  getPlaneCells(plane: PlanePlacement): Array<{ row: number; col: number }> {
    const offsets = PLANE_OFFSETS[plane.direction];
    return offsets.map((o) => ({
      row: plane.head.row + o.dr,
      col: plane.head.col + o.dc,
    }));
  }

  // Get head position of a plane
  getHeadPosition(plane: PlanePlacement): { row: number; col: number } {
    return { ...plane.head };
  }

  // Check if a placement is within bounds (0-9)
  isPlacementInBounds(plane: PlanePlacement): boolean {
    const cells = this.getPlaneCells(plane);
    return cells.every((c) => c.row >= 0 && c.row < 10 && c.col >= 0 && c.col < 10);
  }

  // Validate all planes: in bounds + no overlap
  validatePlacement(planes: PlanePlacement[]): { valid: boolean; error?: string } {
    if (planes.length !== 3) {
      return { valid: false, error: 'Must place exactly 3 planes' };
    }

    for (const plane of planes) {
      if (!this.isPlacementInBounds(plane)) {
        return { valid: false, error: 'Plane out of bounds' };
      }
    }

    const occupied = new Set<string>();
    for (const plane of planes) {
      const cells = this.getPlaneCells(plane);
      for (const cell of cells) {
        const key = `${cell.row},${cell.col}`;
        if (occupied.has(key)) {
          return { valid: false, error: 'Planes overlap' };
        }
        occupied.add(key);
      }
    }

    return { valid: true };
  }

  // Build a 10x10 board from plane placements
  buildBoard(planes: PlanePlacement[]): CellState[][] {
    const board: CellState[][] = Array.from({ length: 10 }, () =>
      Array<CellState>(10).fill('empty'),
    );

    for (const plane of planes) {
      const head = this.getHeadPosition(plane);
      board[head.row][head.col] = 'head';
      const cells = this.getPlaneCells(plane);
      for (const cell of cells) {
        if (cell.row === head.row && cell.col === head.col) continue;
        board[cell.row][cell.col] = 'body';
      }
    }

    return board;
  }

  // Execute attack on a board, return result
  attack(board: CellState[][], position: { row: number; col: number }): AttackResult {
    const cell = board[position.row][position.col];
    if (cell === 'head') return 'headshot';
    if (cell === 'body') return 'hit';
    return 'miss';
  }

  // Check if all heads are hit (heads found in attacks)
  checkGameOver(planes: PlanePlacement[], attacks: Array<{ position: { row: number; col: number } }>): boolean {
    const headsHit = new Set<string>();
    for (const attack of attacks) {
      for (const plane of planes) {
        const head = this.getHeadPosition(plane);
        if (attack.position.row === head.row && attack.position.col === head.col) {
          headsHit.add(`${head.row},${head.col}`);
        }
      }
    }
    return headsHit.size >= planes.length;
  }
}
