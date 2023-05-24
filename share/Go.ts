export enum Cell {
  Empty,
  Black,
  White
}

export class Move {
  position: number;
  player: Cell;
  
  constructor(position: number, player: Cell) {
    this.position = position;
    this.player = player;
  }
}

export class Board {
  board: Cell[];

  constructor(board: Cell[]) {
    this.board = board;
  }

  serialise() {
    return this.board.join('');
  }

  static deserialise(str: string): Board {
    return new Board(str.split('').map(Number));
  }

  getNeighbours(position: number): number[] {
    let boardSize = Math.sqrt(this.board.length);
    let neighbours = [];
    if (position - boardSize >= 0 ) { // UP
      neighbours.push(position - boardSize);
    }
    if (position + boardSize < this.board.length) { // DOWN
      neighbours.push(position + boardSize);
    }
    if (position % boardSize > 0) { // LEFT
      neighbours.push(position - 1);
    }
    if (position % boardSize < boardSize - 1) { // RIGHT
      neighbours.push(position + 1);
    }
    return neighbours;
  }

  getGroup(position: number): number[] {
    let group = new Set<number>();
    let stack: number[] = [position];
    while (stack.length > 0)  {
      let p = stack.pop();
      group.add(p!);
      this.getNeighbours(p!)
        .filter(n => this.board[n] === this.board[p!])
        .filter(n => !group.has(n))
        .forEach(n => { stack.push(n); });
    }
    return Array.from(group);
  }

  getAdjacentEnemyGroups(position: number): number[][] {
    return this.getNeighbours(position)
      .filter(neighbour => this.board[neighbour] !== Cell.Empty)
      .filter(neighbour => this.board[neighbour] !== this.board[position])
      .map(neighbour => this.getGroup(neighbour));
  }

  countLiberties(group: number[]): number {
    return group
      .map(position => this.getNeighbours(position))
      .flat()
      .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
      .filter(position => this.board[position] === Cell.Empty)
      .length;
  }

  removeGroup(group: number[]) {
    group.forEach(position => { this.board[position] = Cell.Empty; });
  }

  updateBoard(move: Move): any {
    // console.log(this.board);
    // console.log("Cell.Empty = ", Cell.Empty, ";  board[position] = ", this.board[move.position]);
    if (this.board[move.position] !== Cell.Empty) {
      // console.log("Invalid move: piece already at position.");
      return null;
    }
    let nextBoard = new Board(this.board.slice());

    nextBoard.board[move.position] = move.player;
    let adjacentEnemyGroups = nextBoard.getAdjacentEnemyGroups(move.position);
    let adjacentGroupDied = false;
    let score = 0;
    // console.log("Neighbours of ", move.position, nextBoard.getNeighbours(move.position));
    adjacentEnemyGroups.forEach((group) => {
      // console.log("Adjacent enemy groups and liberties:", group, nextBoard.countLiberties(group));
      if (nextBoard.countLiberties(group) === 0) {
        adjacentGroupDied = true;
        score += group.length;
        nextBoard.removeGroup(group);
      }
    });
    if (!adjacentGroupDied) {
      if (nextBoard.countLiberties(nextBoard.getGroup(move.position)) === 0) {
        // console.log("Invalid move.");
        return null;
      }
    }
    return { "board": nextBoard, "score": score };
  }

  getTerritory(deadStones: number[]) {
    let finalBoard = new Board(this.board.slice());
    let territory = Array(finalBoard.board.length).fill(Cell.Empty);
    for (let position of deadStones) {
      finalBoard.board[position] = Cell.Empty;
    }
    let seen = new Set();
    for (let position = 0; position < finalBoard.board.length; position++) {
      if (!seen.has(position) && finalBoard.board[position] === Cell.Empty) {
        let group = finalBoard.getGroup(position);
        let enclosing = new Set(
          group
            .map(p => finalBoard.getNeighbours(p))
            .flat()
            .map(position => this.board[position])
            .filter(a => a !== Cell.Empty)
        );
        group.forEach(position => {
          seen.add(position);
          if (enclosing.size == 1) {
            territory[position] = enclosing.has(Cell.Black) ? Cell.Black : Cell.White;
          }
        });
      }
    }
    return territory;
  }
}
