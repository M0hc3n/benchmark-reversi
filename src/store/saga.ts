import type { PayloadAction } from "@reduxjs/toolkit";
import type { Effect } from "redux-saga/effects";
import type { AIJudgeScore, Board, Coords, PointScore } from "./types";
import { Array, Number } from "effect";
import { RESET as ATOM_RESET } from "jotai/utils";
import { all, call, delay, takeEvery } from "redux-saga/effects";
import { upperFirst } from "scule";
import invariant from "tiny-invariant";
import Together from "together-ai";
import { saveStep } from "~/atoms/actions";
import {
  aiVersionAtom,
  boardAtom,
  candidateAtom,
  gameMessageAtom,
  gameStateAtom,
  logAtom,
  messagesAtom,
  playerAtom,
  scoreAtom,
  switchCountAtom,
  usersAtom,
} from "~/atoms/game";
import { store } from "~/atoms/store";
import { historyAtom, overlayAtom } from "~/atoms/ui";
import { togetherAPICall } from "~/lib/ai/together";
import { DEFAULT_USER } from "~/lib/consts";
// import { together } from "~/lib/together.ai";
import {
  BLACK,
  DEFAULT_BOARD,
  ENDED,
  IDLE,
  PLAYING,
  REBOOT,
  RESET,
  SWITCH_PLAYER,
  USER_PLACE_CHESS,
  WHITE,
} from "./consts";
import { judgeScores } from "./lib/ai";
import {
  clearBoardCandidate,
  placeAndFlip,
  placeBoardCandidate,
} from "./lib/board";
import {
  getBestPoint,
  getCandidate,
  getOpposite,
  getPlayer,
  isPlaceable,
} from "./lib/chess-utils";
import { UserType } from "./types";

export function* reboot(): Generator<Effect, void, void> {
  store.set(gameStateAtom, IDLE);
  store.set(overlayAtom, "");
  store.set(gameMessageAtom, "");
  store.set(logAtom, []);
  store.set(boardAtom, ATOM_RESET);
  store.set(usersAtom, DEFAULT_USER);
  store.set(playerAtom, null);
  store.set(switchCountAtom, 0);
  store.set(messagesAtom, []);
}

export function* reset({
  payload,
}: PayloadAction<string>): Generator<Effect, void, void> {
  yield call(reboot);
  if (payload != null) {
    store.set(usersAtom, {
      ...DEFAULT_USER,
      [payload]: UserType.AI,
    });
  }
  store.set(playerAtom, BLACK);
  store.set(boardAtom, DEFAULT_BOARD);
  yield call(placeCandidate);
  store.set(gameStateAtom, PLAYING);
  if (payload === BLACK) {
    yield call(aiJudgeScore);
    yield call(switchPlayer);
  }
}

function* switchPlayer() {
  const users = store.get(usersAtom);
  const switchCount = store.get(switchCountAtom);
  const player = store.get(playerAtom);
  if (switchCount > 2) {
    yield call(gameSet);
    return;
  }

  yield call(clearCandidate);

  const nextPlayer = getOpposite(player);
  store.set(playerAtom, nextPlayer);

  yield call(placeCandidate);
  const candidate: number = store.get(candidateAtom);
  if (candidate === 0) {
    store.set(gameMessageAtom, `No move, turn to ${getPlayer(player)}`);
    store.set(switchCountAtom, Number.increment);
    yield call(switchPlayer);
  } else {
    if (switchCount === 0) {
      store.set(gameMessageAtom, "");
    }
    store.set(switchCountAtom, 0);
    if (users[nextPlayer] === UserType.AI) {
      yield call(aiJudgeScore);
      yield call(switchPlayer);
    }
  }
}

function* gameSet() {
  const users = store.get(usersAtom);
  const score = store.get(scoreAtom);
  const bothAI = users[BLACK] === UserType.AI && users[WHITE] === UserType.AI;
  const hasAI = users[BLACK] === UserType.AI || users[WHITE] === UserType.AI;
  store.set(gameMessageAtom, "Game set");
  store.set(gameStateAtom, ENDED);
  if (score.black === score.white) {
    store.set(overlayAtom, "Draw");
    if (hasAI) {
      store.set(historyAtom, (history) => {
        history.draw += 1;
      });
    }
    return;
  }
  const winner = score.black > score.white ? BLACK : WHITE;
  if (hasAI && !bothAI) {
    if (users[winner] === UserType.AI) {
      store.set(overlayAtom, "You Lose");
      store.set(historyAtom, (history) => {
        history.lose += 1;
      });
    } else {
      store.set(overlayAtom, "You Win");
      store.set(historyAtom, (history) => {
        history.win += 1;
      });
    }
  } else {
    store.set(overlayAtom, `${upperFirst(getPlayer(winner))} Win`);
  }
}

function* clearCandidate() {
  store.set(boardAtom, (board: Board) => {
    return clearBoardCandidate(board);
  });
}

function* placeCandidate() {
  const player = store.get(playerAtom);
  const board = store.get(boardAtom);
  const { board: nextBoard, count } = placeBoardCandidate({ board, player });
  store.set(boardAtom, nextBoard as Board);
  store.set(candidateAtom, count);
}

function getBoardState(board: Board) {
  return board.map((row) => row.join(" ")).join("\n");
}

function* getCoordsUsingLLM() {
  const board = store.get(boardAtom);
  const boardState = getBoardState(board);
  const messages = store.get(messagesAtom);

  const systemMessage = {
    role: "system",
    content:
      'we are going to play orthello. Assume that we are playing at a board were you represent B and I represent W. Suppose that the board is a matrix of 8*8 (indexes are 0-7). Now suppose the board is at its initial configuration, you get to make the first move. Return only x and y in this format "x y" with no extra additions or comments',
  };

  const currentMove = {
    role: "user",
    content: `Current board state:\n${boardState}\nMake your move (respond only with x y coordinates):`,
  };

  const allMessages = [systemMessage, ...messages];

  console.log(allMessages);

  try {
    const data = yield call(togetherAPICall, allMessages);
    // Store both the user's move and AI's response
    store.set(messagesAtom, (messages) => [
      ...messages,
      // currentMove,
      data.choices[0].message,
    ]);
    return data;
  } catch (error) {
    console.error("Error getting LLM response:", error);
    return null;
  }
}

function* aiJudgeScore() {
  const board = store.get(boardAtom);
  const player = store.get(playerAtom);
  const version = store.get(aiVersionAtom);

  try {
    const aiResponse = yield call(getCoordsUsingLLM);
    console.log("AI Response:", aiResponse);

    const [row, col] = aiResponse.choices[0].message.content.split(" ");

    // just skip this
    // const ai = getOpposite(player);
    // const scores = computeScores(board, version, player, ai);
    // const { row, col } = getBestPoint(scores);

    console.log(row, col);

    store.set(logAtom, (logs) => {
      logs.push({
        player,
        pos: `(${row}, ${col})`,
      });
    });
    const nextBoard = placeAndFlip({ board, row, col, player });
    store.set(boardAtom, nextBoard as Board);
    yield delay(3000);
  } catch (error) {
    console.error("Error in AI judge:", error);
  }
}

function computeScores(
  board: Board,
  version: string,
  player: string,
  ai: string
) {
  const scores: PointScore[] = [];
  const judge: AIJudgeScore = judgeScores[version];
  invariant(judge, "version invalid");
  const chess = getCandidate(player);
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (board[r][c] === chess) {
        const score = judge(board, ai, r, c);
        scores.push({
          row: r,
          col: c,
          score,
        });
      }
    }
  }
  invariant(
    Array.isNonEmptyArray(scores),
    "Invalid State: no candidates point"
  );
  return scores;
}

function* userPlaceChess({ payload: { col, row } }: PayloadAction<Coords>) {
  const player = store.get(playerAtom);
  const board = store.get(boardAtom);
  if (!isPlaceable(board, player, row, col)) {
    // Not allow place on exist chess or not candidate

    return;
  }

  saveStep();

  store.set(logAtom, (log) => {
    log.push({
      player,
      pos: `(${row}, ${col})`,
    });
  });

  store.set(messagesAtom, (messages) => [
    ...messages,
    {
      role: "user",
      content: `Move played: ${row} ${col}`,
    },
  ]);

  const nextBoard = placeAndFlip({ board, row, col, player });
  store.set(boardAtom, nextBoard as Board);

  yield call(switchPlayer);
}

export function* root(): Generator<Effect, void, void> {
  yield all([
    takeEvery(REBOOT, reboot),
    takeEvery(RESET, reset),
    takeEvery(USER_PLACE_CHESS, userPlaceChess),
    takeEvery(SWITCH_PLAYER, switchPlayer),
  ]);
}
