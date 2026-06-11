/**
 * ワールドのオブジェクト配置と文言の共有定義。
 * 描画(ThreeRendererAdapter)とインタラクション(domainのInteractable構築)の
 * 双方がここを参照することで座標のズレを防ぐ。
 */
export interface WorldObjectSpec {
  kind: 'tree' | 'rock' | 'crystal';
  x: number;
  z: number;
  /** rock: 半径 / crystal: 高さ */
  size?: number;
  /** crystal の発光色 */
  color?: number;
  name: string;
  /** 吹き出し表示のアンカー高さ [m] */
  anchorY: number;
  /** 接近時の吹き出し文 */
  bubble?: string;
  /** タップ時のコメント列 */
  dialogue?: string[];
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

export const DAY_OBJECTS: WorldObjectSpec[] = [
  { kind: 'tree', x: -8, z: -2, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: 9, z: -4, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: -12, z: 8, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: 13, z: 9, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: -5, z: 14, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: 6, z: 16, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: -15, z: -8, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'tree', x: 16, z: -10, name: '木', anchorY: 4.2, bubble: TREE_BUBBLE },
  { kind: 'rock', x: 4, z: 6, size: 0.7, name: '石', anchorY: 1.4, dialogue: ROCK_DIALOGUE },
  { kind: 'rock', x: -6, z: 5, size: 0.5, name: '石', anchorY: 1.1, dialogue: ROCK_DIALOGUE },
  { kind: 'rock', x: 10, z: 2, size: 0.9, name: '石', anchorY: 1.7, dialogue: ROCK_DIALOGUE },
  { kind: 'rock', x: -3, z: -12, size: 0.6, name: '石', anchorY: 1.2, dialogue: ROCK_DIALOGUE },
];

export const NIGHT_OBJECTS: WorldObjectSpec[] = [
  { kind: 'crystal', x: -7, z: -3, size: 1.6, color: 0x66ffee, name: 'クリスタル', anchorY: 2.2, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
  { kind: 'crystal', x: 8, z: -5, size: 2.2, color: 0xff66dd, name: 'クリスタル', anchorY: 2.8, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
  { kind: 'crystal', x: -11, z: 7, size: 1.8, color: 0x66aaff, name: 'クリスタル', anchorY: 2.4, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
  { kind: 'crystal', x: 12, z: 10, size: 1.4, color: 0xaaff66, name: 'クリスタル', anchorY: 2.0, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
  { kind: 'crystal', x: -4, z: 13, size: 2.0, color: 0xff9966, name: 'クリスタル', anchorY: 2.6, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
  { kind: 'crystal', x: 5, z: 17, size: 1.7, color: 0x66ffee, name: 'クリスタル', anchorY: 2.3, bubble: CRYSTAL_BUBBLE, dialogue: CRYSTAL_DIALOGUE },
];

/** ポータルの吹き出し(両ワールド共通の文言) */
export const PORTAL_BUBBLE = 'ポータルだ。くぐると別の世界へ行ける';
export const PORTAL_BUBBLE_ANCHOR_Y = 3.6;

export const BUBBLE_RANGE = 5;
export const INTERACT_RANGE = 3.5;
