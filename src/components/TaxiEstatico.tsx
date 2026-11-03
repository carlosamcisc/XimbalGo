import Svg, { Ellipse, G, Path, Rect } from "react-native-svg";

/** Fotograma vectorial de cliente-taxi.json, sin reproductor de animaciones. */
export default function TaxiEstatico({ tamanio = 96 }: { tamanio?: number }) {
  return (
    <Svg width={tamanio} height={tamanio} viewBox="0 0 160 160" accessible={false}>
      <G transform="translate(80 80)">
        <G fill="rgb(232,246,255)">
          <Ellipse cx={0} cy={0} rx={74} ry={74} />
        </G>
        <G fill="rgb(191,212,227)">
          <Ellipse cx={0} cy={52} rx={47} ry={4.5} />
        </G>
        <G fill="rgb(15,45,91)">
          <Rect x={-40} y={26.5} width={18} height={23} rx={6} />
          <Rect x={22} y={26.5} width={18} height={23} rx={6} />
        </G>
        <G fill="rgb(47,128,247)">
          <Rect x={-15} y={-54} width={30} height={12} rx={4} />
        </G>
        <G fill="rgb(255,255,255)">
          <Rect x={-10} y={-50} width={4} height={4} rx={1} />
          <Rect x={-2} y={-50} width={4} height={4} rx={1} />
          <Rect x={6} y={-50} width={4} height={4} rx={1} />
        </G>
        <G fill="rgb(52,97,141)">
          <Rect x={-29.5} y={-44} width={59} height={26} rx={11} />
        </G>
        <G fill="rgb(52,97,141)">
          <Rect x={-53.5} y={-11} width={13} height={10} rx={4} />
          <Rect x={40.5} y={-11} width={13} height={10} rx={4} />
        </G>
        <G fill="rgb(52,97,141)">
          <Rect x={-45.5} y={-11} width={91} height={50} rx={14} />
        </G>
        <G fill="rgb(232,246,255)">
          <Rect x={-24.5} y={-3.5} width={49} height={3} rx={2} />
        </G>
        <G fill="rgb(15,45,91)">
          <Rect x={-39} y={27} width={78} height={14} rx={6} />
        </G>
        <G fill="rgb(255,255,255)">
          <Rect x={-11} y={34} width={22} height={6} rx={2} />
        </G>
        <G fill="rgb(47,128,247)">
          <Ellipse cx={0} cy={9} rx={3} ry={3} />
        </G>
        <G fill="rgb(15,45,91)">
          <Rect x={-15} y={20.5} width={30} height={9} rx={4} />
        </G>
        <G fill="rgb(232,246,255)">
          <Rect x={-9} y={23.5} width={4} height={3} rx={1} />
          <Rect x={-2} y={23.5} width={4} height={3} rx={1} />
          <Rect x={5} y={23.5} width={4} height={3} rx={1} />
        </G>
        <G fill="rgb(47,128,247)">
          <Rect x={-38.5} y={4} width={19} height={14} rx={6} />
          <Rect x={19.5} y={4} width={19} height={14} rx={6} />
        </G>
        <G fill="rgb(255,255,255)">
          <Rect x={-35.5} y={7} width={13} height={8} rx={4} />
          <Rect x={22.5} y={7} width={13} height={8} rx={4} />
        </G>
        <G fill="rgb(15,45,91)">
          <Path d="M -34 -8 C -34 -12 -30 -37 -26 -37 C -26 -37 26 -37 26 -37 C 30 -37 34 -12 34 -8 C 34 -8 -34 -8 -34 -8 Z" />
        </G>
        <G fill="rgb(232,246,255)">
          <Path d="M -28 -12 C -28 -14 -23 -34 -21 -34 C -21 -34 21 -34 21 -34 C 23 -34 28 -14 28 -12 C 28 -12 -28 -12 -28 -12 Z" />
        </G>
        <G fill="rgb(255,255,255)">
          <Path d="M -24 -16 C -24 -16 -17 -32 -17 -32 C -17 -32 -10 -32 -10 -32 C -10 -32 -17 -16 -17 -16 C -17 -16 -24 -16 -24 -16 Z" />
        </G>
      </G>
    </Svg>
  );
}
