const Go = require('./Go');

it("should deserialise", () => {
    const boardStr = "102000201";
    let board = Go.Board.deserialise(boardStr);
    expect(board.board).toStrictEqual(
        [
            Go.Cell.Black, Go.Cell.Empty, Go.Cell.White,
            Go.Cell.Empty, Go.Cell.Empty, Go.Cell.Empty,
            Go.Cell.White, Go.Cell.Empty, Go.Cell.Black
        ]
    );
})

it("should serialise", () => {
    const boardStr = "102000201";
    let board = Go.Board.deserialise(boardStr);
    expect(board.board).toStrictEqual(
        [
            Go.Cell.Black, Go.Cell.Empty, Go.Cell.White,
            Go.Cell.Empty, Go.Cell.Empty, Go.Cell.Empty,
            Go.Cell.White, Go.Cell.Empty, Go.Cell.Black
        ]
    );
    expect(board.serialise()).toStrictEqual(boardStr);
});