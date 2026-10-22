import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { IconName as EventIconName } from '@/core/event-types';

export type IconName =
  | EventIconName
  | 'check'
  | 'plus'
  | 'arrowRight'
  | 'arrowLeft'
  | 'close'
  | 'calendar'
  | 'pin'
  | 'send'
  | 'users'
  | 'upload'
  | 'copy'
  | 'whatsapp'
  | 'shield'
  | 'logout'
  | 'chart'
  | 'mail'
  | 'trash'
  | 'minus'
  | 'rotate'
  | 'wand'
  | 'eye'
  | 'layout'
  | 'table';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color = '#24212B', strokeWidth = 1.7 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(() => {
        switch (name) {
          case 'rings':
            return (
              <>
                <Circle cx={9} cy={14} r={5} {...p} />
                <Circle cx={15} cy={14} r={5} {...p} />
                <Path d="M10.5 4h3L12 6.5z" {...p} />
              </>
            );
          case 'ring':
            return (
              <>
                <Circle cx={12} cy={15} r={6} {...p} />
                <Path d="M9 4h6l2 3-5 3-5-3z" {...p} />
              </>
            );
          case 'lantern':
            return (
              <>
                <Path d="M12 3c2 3 3 4.5 3 6.5a3 3 0 0 1-6 0C9 7.5 10 6 12 3z" {...p} />
                <Rect x={7} y={14} width={10} height={7} rx={2} {...p} />
              </>
            );
          case 'cake':
            return (
              <>
                <Rect x={4} y={11} width={16} height={9} rx={2} {...p} />
                <Path d="M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 4 0M12 11V7" {...p} />
                <Path d="M12 3.5c.9 1 .9 1.8 0 2.6-.9-.8-.9-1.6 0-2.6z" {...p} />
              </>
            );
          case 'plate':
            return (
              <>
                <Circle cx={12} cy={12} r={6} {...p} />
                <Path d="M3 4v16M21 4c-2 2-2 6 0 7v9" {...p} />
              </>
            );
          case 'briefcase':
            return (
              <>
                <Rect x={3} y={7} width={18} height={13} rx={2.5} {...p} />
                <Path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" {...p} />
              </>
            );
          case 'ball':
            return (
              <>
                <Circle cx={12} cy={12} r={9} {...p} />
                <Path d="M12 8l3 2.2-1.1 3.6h-3.8L9 10.2z" {...p} />
              </>
            );
          case 'sparkle':
            return <Path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" {...p} />;
          case 'check':
            return <Path d="M5 12l5 5 9-10" {...p} />;
          case 'plus':
            return <Path d="M12 5v14M5 12h14" {...p} />;
          case 'arrowRight':
            return <Path d="M5 12h14M13 6l6 6-6 6" {...p} />;
          case 'arrowLeft':
            return <Path d="M15 18l-6-6 6-6" {...p} />;
          case 'close':
            return <Path d="M6 6l12 12M18 6L6 18" {...p} />;
          case 'calendar':
            return (
              <>
                <Rect x={3} y={5} width={18} height={16} rx={3} {...p} />
                <Path d="M3 10h18M8 3v4M16 3v4" {...p} />
              </>
            );
          case 'pin':
            return (
              <>
                <Path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" {...p} />
                <Circle cx={12} cy={10} r={2.5} {...p} />
              </>
            );
          case 'send':
            return <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" {...p} />;
          case 'users':
            return (
              <>
                <Circle cx={9} cy={8} r={4} {...p} />
                <Path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5" {...p} />
              </>
            );
          case 'upload':
            return <Path d="M12 16V4M7 9l5-5 5 5M4 20h16" {...p} />;
          case 'copy':
            return (
              <>
                <Rect x={9} y={9} width={12} height={12} rx={2.5} {...p} />
                <Path d="M5 15V5a2 2 0 0 1 2-2h8" {...p} />
              </>
            );
          case 'whatsapp':
            return <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" {...p} />;
          case 'shield':
            return <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" {...p} />;
          case 'logout':
            return <Path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" {...p} />;
          case 'chart':
            return <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...p} />;
          case 'trash':
            return <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" {...p} />;
          case 'minus':
            return <Path d="M5 12h14" {...p} />;
          case 'rotate':
            return <Path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" {...p} />;
          case 'wand':
            return <Path d="M4 20L15 9M13 4v3M17.5 6.5l-2 2M19 11h-3M8 3l.8 1.7L10.5 5.5 8.8 6.3 8 8l-.8-1.7L5.5 5.5l1.7-.8z" {...p} />;
          case 'eye':
            return (
              <>
                <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" {...p} />
                <Circle cx={12} cy={12} r={3} {...p} />
              </>
            );
          case 'layout':
            return (
              <>
                <Rect x={3} y={3} width={18} height={18} rx={3} {...p} />
                <Path d="M3 9h18M9 21V9" {...p} />
              </>
            );
          case 'table':
            return (
              <>
                <Circle cx={12} cy={12} r={5} {...p} />
                <Circle cx={12} cy={3.5} r={1.5} {...p} />
                <Circle cx={12} cy={20.5} r={1.5} {...p} />
                <Circle cx={3.5} cy={12} r={1.5} {...p} />
                <Circle cx={20.5} cy={12} r={1.5} {...p} />
              </>
            );
          case 'mail':
            return (
              <>
                <Rect x={3} y={5} width={18} height={14} rx={3} {...p} />
                <Path d="M3 7l9 6 9-6" {...p} />
              </>
            );
        }
      })()}
    </Svg>
  );
}
