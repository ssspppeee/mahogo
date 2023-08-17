export enum GameStage {
  Play,
  MarkDead,
  End
}

export enum Player {
  Black = 1, // for consistency with Cell where 0 is Empty
  White
}

export type ChatMessage = {
  message: string,
  sender: string
}
