// La Lunga Notte: la modalità roguelike. Si entra dalla scena "runStart".
import { RunStartScene } from "./RunStartScene";
import { RunMapScene } from "./RunMapScene";
import { RunBattleScene } from "./RunBattleScene";
import { RunStopScene } from "./RunStopScene";
import { RunEndScene } from "./RunEndScene";

export const RUN_SCENES = [RunStartScene, RunMapScene, RunBattleScene, RunStopScene, RunEndScene];
