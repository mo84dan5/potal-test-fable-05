/**
 * ワールドのオブジェクト配置・ポータル接続・文言の共有定義。
 * 描画(ThreeRendererAdapter)とドメイン構築(main.ts)の双方がここを参照することで
 * 座標・接続のズレを防ぐ。
 *
 * ワールド接続グラフ:
 *   雪の世界 ⇄ 昼の世界 ⇄ 夜の世界 ⇄ 黄昏の遺跡
 */
export interface WorldObjectSpec {
  kind: 'tree' | 'rock' | 'crystal' | 'ice' | 'pillar';
  x: number;
  z: number;
  /** rock: 半径 / crystal・ice: 高さ / pillar: 高さ */
  size?: number;
  /** crystal の発光色 */
  color?: number;
  name: string;
  /** 吹き出し表示のアンカー高さ [m] */
  anchorY: number;
  /** 衝突半径 [m](XZ平面の円柱コライダー) */
  collisionRadius: number;
  /** 接近時の吹き出し文 */
  bubble?: string;
  /** タップ時のコメント列 */
  dialogue?: string[];
}

export interface PortalSpec {
  /** 全ワールドで一意なポータルID */
  id: string;
  x: number;
  z: number;
  /** 面の向き(Y軸まわり、ラジアン) */
  yaw: number;
  targetWorldId: string;
  targetPortalId: string;
  /** 枠の発光色 */
  frameColor: number;
}

export interface NpcSpec {
  /** スポーン位置(足元) */
  x: number;
  z: number;
  name: string;
  /** 服の色 */
  color: number;
  /** 徘徊半径 [m] */
  wanderRadius: number;
  bubble: string;
  /** タップ時の世界の説明 */
  dialogue: string[];
}

export interface WorldDef {
  id: string;
  name: string;
  objects: WorldObjectSpec[];
  portals: PortalSpec[];
  npc?: NpcSpec;
}

const TREE_BUBBLE = 'これは木です';
const ROCK_DIALOGUE = [
  'これは石だ。',
  'ごつごつしていて、ずっしり重そうだ。',
  '……特に何も起こらなかった。',
];
const CRYSTAL_BUBBLE = 'これはクリスタルです';
const CRYSTAL_DIALOGUE = [
  'これはクリスタルだ。',
  'ほのかに光って、さわると少しあたたかい。',
  '夜の世界のあかりになっているらしい。',
];
const ICE_BUBBLE = 'これは氷柱です';
const ICE_DIALOGUE = [
  'これは氷だ。',
  'ひんやりと冷たい。',
  '奥で何かが光った…気のせいだろうか。',
];
const PILLAR_BUBBLE = 'これは古代の柱です';
const PILLAR_DIALOGUE = [
  '古い石柱だ。',
  '風化していて文字は読めない。',
  '遠い昔、ここには都があったのかもしれない。',
];

export const WORLD_DEFS: WorldDef[] = [
  {
    id: 'day',
    name: '昼の世界',
    objects: [
      { kind: 'tree', x: -8, z: -2, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'tree', x: 9, z: -4, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'tree', x: -12, z: 8, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'tree', x: 13, z: 9, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'tree', x: -5, z: 14, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'tree', x: 6, z: 16, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'tree', x: -15, z: -8, name: '木', anchorY: 4.2, collisionRadius: 0.5, bubble: TREE_BUBBLE },
      { kind: 'rock', x: 4, z: 6, size: 0.7, name: '石', anchorY: 1.4, collisionRadius: 0.75, dialogue: ROCK_DIALOGUE },
      { kind: 'rock', x: -6, z: 5, size: 0.5, name: '石', anchorY: 1.1, collisionRadius: 0.55, dialogue: ROCK_DIALOGUE },
      { kind: 'rock', x: 10, z: 2, size: 0.9, name: '石', anchorY: 1.7, collisionRadius: 0.95, dialogue: ROCK_DIALOGUE },
      { kind: 'rock', x: -3, z: -12, size: 0.6, name: '石', anchorY: 1.2, collisionRadius: 0.65, dialogue: ROCK_DIALOGUE },
    ],
    portals: [
      { id: 'day-night', x: 0, z: -6, yaw: 0, targetWorldId: 'night', targetPortalId: 'night-day', frameColor: 0x7df9ff },
      { id: 'day-snow', x: 12, z: 2, yaw: -Math.PI / 2, targetWorldId: 'snow', targetPortalId: 'snow-day', frameColor: 0x9adcff },
    ],
    npc: {
      x: 4, z: -1, name: '案内人', color: 0xe06a3c, wanderRadius: 5,
      bubble: 'こんにちは!',
      dialogue: [
        'やあ、旅人さん。ここは「昼の世界」。いつもおだやかな光に包まれているんだ。',
        '木や石にも近づいてみるといい。何か教えてくれるかもしれないよ。',
        '光る門はポータル。正面の門は「夜の世界」へ、右手の門は「雪の世界」へつながっている。',
      ],
    },
  },
  {
    id: 'night',
    name: '夜の世界',
    objects: [
      { kind: 'crystal', x: -7, z: -3, size: 1.6, color: 0x66ffee, name: 'クリスタル', anchorY: 2.2, collisionRadius: 0.55, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
      { kind: 'crystal', x: 8, z: -5, size: 2.2, color: 0xff66dd, name: 'クリスタル', anchorY: 2.8, collisionRadius: 0.55, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
      { kind: 'crystal', x: -11, z: 7, size: 1.8, color: 0x66aaff, name: 'クリスタル', anchorY: 2.4, collisionRadius: 0.55, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
      { kind: 'crystal', x: 12, z: 10, size: 1.4, color: 0xaaff66, name: 'クリスタル', anchorY: 2.0, collisionRadius: 0.55, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
      { kind: 'crystal', x: -4, z: 13, size: 2.0, color: 0xff9966, name: 'クリスタル', anchorY: 2.6, collisionRadius: 0.55, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
      { kind: 'crystal', x: 5, z: 17, size: 1.7, color: 0x66ffee, name: 'クリスタル', anchorY: 2.3, collisionRadius: 0.55, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
    ],
    portals: [
      { id: 'night-day', x: 0, z: -6, yaw: 0, targetWorldId: 'day', targetPortalId: 'day-night', frameColor: 0xffc04d },
      { id: 'night-ruins', x: -12, z: 2, yaw: Math.PI / 2, targetWorldId: 'ruins', targetPortalId: 'ruins-night', frameColor: 0xffa477 },
    ],
    npc: {
      x: -4, z: -1, name: '案内人', color: 0x7d5fd3, wanderRadius: 5,
      bubble: 'こんばんは!',
      dialogue: [
        'ようこそ「夜の世界」へ。ここでは星とクリスタルが道を照らしてくれる。',
        'クリスタルに触れてみるといい。ほんのり温かいんだ。',
        '正面の門は「昼の世界」へ。左手の門の先は「黄昏の遺跡」、不思議な場所だよ。',
      ],
    },
  },
  {
    id: 'snow',
    name: '雪の世界',
    objects: [
      { kind: 'ice', x: -6, z: -1, size: 2.4, name: '氷柱', anchorY: 2.8, collisionRadius: 0.55, bubble: ICE_BUBBLE, dialogue: ICE_DIALOGUE },
      { kind: 'ice', x: 7, z: -4, size: 3.0, name: '氷柱', anchorY: 3.4, collisionRadius: 0.55, bubble: ICE_BUBBLE, dialogue: ICE_DIALOGUE },
      { kind: 'ice', x: -10, z: 9, size: 2.0, name: '氷柱', anchorY: 2.4, collisionRadius: 0.55, bubble: ICE_BUBBLE, dialogue: ICE_DIALOGUE },
      { kind: 'ice', x: 9, z: 12, size: 2.6, name: '氷柱', anchorY: 3.0, collisionRadius: 0.55, bubble: ICE_BUBBLE, dialogue: ICE_DIALOGUE },
      { kind: 'ice', x: 3, z: 18, size: 2.2, name: '氷柱', anchorY: 2.6, collisionRadius: 0.55, bubble: ICE_BUBBLE, dialogue: ICE_DIALOGUE },
    ],
    portals: [
      { id: 'snow-day', x: 0, z: -6, yaw: 0, targetWorldId: 'day', targetPortalId: 'day-snow', frameColor: 0xffc04d },
    ],
    npc: {
      x: 4, z: 3, name: '案内人', color: 0x3f7fbf, wanderRadius: 5,
      bubble: 'さむいねえ!',
      dialogue: [
        'ここは「雪の世界」。一年中、静かな雪に覆われているんだ。',
        '氷柱の奥に何かが見える、なんて噂もある。確かめてみるかい?',
        '門をくぐれば「昼の世界」へ戻れるよ。',
      ],
    },
  },
  {
    id: 'ruins',
    name: '黄昏の遺跡',
    objects: [
      { kind: 'pillar', x: -7, z: -2, size: 3.4, name: '柱', anchorY: 3.8, collisionRadius: 0.65, bubble: PILLAR_BUBBLE, dialogue: PILLAR_DIALOGUE },
      { kind: 'pillar', x: 8, z: -3, size: 2.2, name: '柱', anchorY: 2.6, collisionRadius: 0.65, bubble: PILLAR_BUBBLE, dialogue: PILLAR_DIALOGUE },
      { kind: 'pillar', x: -11, z: 8, size: 3.4, name: '柱', anchorY: 3.8, collisionRadius: 0.65, bubble: PILLAR_BUBBLE, dialogue: PILLAR_DIALOGUE },
      { kind: 'pillar', x: 12, z: 9, size: 1.6, name: '柱', anchorY: 2.0, collisionRadius: 0.65, bubble: PILLAR_BUBBLE, dialogue: PILLAR_DIALOGUE },
      { kind: 'pillar', x: -4, z: 14, size: 2.8, name: '柱', anchorY: 3.2, collisionRadius: 0.65, bubble: PILLAR_BUBBLE, dialogue: PILLAR_DIALOGUE },
      { kind: 'pillar', x: 5, z: 16, size: 3.4, name: '柱', anchorY: 3.8, collisionRadius: 0.65, bubble: PILLAR_BUBBLE, dialogue: PILLAR_DIALOGUE },
    ],
    portals: [
      { id: 'ruins-night', x: 0, z: -6, yaw: 0, targetWorldId: 'night', targetPortalId: 'night-ruins', frameColor: 0x7df9ff },
    ],
    npc: {
      x: -5, z: 3, name: '案内人', color: 0xb3863e, wanderRadius: 5,
      bubble: 'ようこそ!',
      dialogue: [
        'ここは「黄昏の遺跡」。沈まない夕日が照らす、古い都の跡さ。',
        '柱の文字はもう誰にも読めない。遠い昔の言葉なんだ。',
        '門の先は「夜の世界」。気をつけて行くんだよ。',
      ],
    },
  },
];

/** ポータルの吹き出しのアンカー高さ */
export const PORTAL_BUBBLE_ANCHOR_Y = 3.6;

export const BUBBLE_RANGE = 5;
export const INTERACT_RANGE = 3.5;

/** ポータル枠の柱の衝突半径 [m](面はコライダーなしで通過可能) */
export const PORTAL_PILLAR_RADIUS = 0.25;

export const PORTAL_HALF_WIDTH = 1.4;
export const PORTAL_HEIGHT = 3;
