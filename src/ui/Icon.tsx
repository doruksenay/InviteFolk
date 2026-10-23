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
  | 'table'
  | 'settings'
  | 'globe'
  | 'lock'
  | 'edit'
  | 'download'
  | 'image'
  | 'creditCard'
  | 'bell'
  | 'file'
  | 'print'
  | 'search'
  | 'star'
  | 'refresh'
  | 'external'
  | 'archive'
  | 'info'
  | 'alert'
  | 'link'
  | 'phone'
  | 'map'
  | 'question'
  | 'list'
  | 'message'
  | 'gift'
  | 'music'
  | 'play'
  | 'pause'
  | 'volume'
  | 'volumeOff'
  | 'qr'
  | 'scan'
  | 'userPlus'
  | 'megaphone'
  | 'camera'
  | 'sun'
  | 'cloud'
  | 'rain'
  | 'clock'
  | 'heart'
  | 'trophy'
  | 'shirt'
  | 'basket'
  | 'vote'
  | 'video'
  | 'child'
  | 'eyeOff'
  | 'envelope'
  | 'grid';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color = '#1F1B2E', strokeWidth = 1.7 }: Props) {
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
          case 'settings':
            return (
              <>
                <Circle cx={12} cy={12} r={3} {...p} />
                <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...p} />
              </>
            );
          case 'globe':
            return (
              <>
                <Circle cx={12} cy={12} r={9} {...p} />
                <Path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" {...p} />
              </>
            );
          case 'lock':
            return (
              <>
                <Rect x={4} y={10} width={16} height={11} rx={2.5} {...p} />
                <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} />
              </>
            );
          case 'edit':
            return <Path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" {...p} />;
          case 'download':
            return <Path d="M12 4v12M7 11l5 5 5-5M4 20h16" {...p} />;
          case 'image':
            return (
              <>
                <Rect x={3} y={4} width={18} height={16} rx={3} {...p} />
                <Circle cx={9} cy={10} r={2} {...p} />
                <Path d="M21 16l-5-5-9 9" {...p} />
              </>
            );
          case 'creditCard':
            return (
              <>
                <Rect x={2.5} y={5} width={19} height={14} rx={3} {...p} />
                <Path d="M2.5 10h19M7 15h3" {...p} />
              </>
            );
          case 'bell':
            return <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0" {...p} />;
          case 'file':
            return <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4" {...p} />;
          case 'print':
            return (
              <>
                <Path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" {...p} />
                <Rect x={7} y={14} width={10} height={7} rx={1} {...p} />
              </>
            );
          case 'search':
            return (
              <>
                <Circle cx={11} cy={11} r={7} {...p} />
                <Path d="M20 20l-4-4" {...p} />
              </>
            );
          case 'star':
            return <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" {...p} />;
          case 'refresh':
            return <Path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4" {...p} />;
          case 'external':
            return <Path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" {...p} />;
          case 'archive':
            return (
              <>
                <Rect x={3} y={4} width={18} height={5} rx={1.5} {...p} />
                <Path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" {...p} />
              </>
            );
          case 'info':
            return (
              <>
                <Circle cx={12} cy={12} r={9} {...p} />
                <Path d="M12 11v6M12 7.5v.5" {...p} />
              </>
            );
          case 'alert':
            return <Path d="M12 3l9.5 17h-19zM12 10v4M12 17.5v.5" {...p} />;
          case 'link':
            return <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" {...p} />;
          case 'phone':
            return <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" {...p} />;
          case 'map':
            return <Path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" {...p} />;
          case 'question':
            return (
              <>
                <Circle cx={12} cy={12} r={9} {...p} />
                <Path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.5" {...p} />
              </>
            );
          case 'list':
            return <Path d="M9 6h11M9 12h11M9 18h11M4 6h.5M4 12h.5M4 18h.5" {...p} />;
          case 'message':
            return <Path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1zM8 10h8M8 13.5h5" {...p} />;
          case 'gift':
            return (
              <>
                <Rect x={3} y={8} width={18} height={4} rx={1} {...p} />
                <Path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1.2C7 8 9 8 12 8zM12 8c1.5-3 5-3.5 5-1.2C17 8 15 8 12 8z" {...p} />
              </>
            );
          case 'music':
            return (
              <>
                <Path d="M9 18V5l11-2v13" {...p} />
                <Circle cx={6.5} cy={18} r={2.5} {...p} />
                <Circle cx={17.5} cy={16} r={2.5} {...p} />
              </>
            );
          case 'play':
            return <Path d="M7 4.5v15l12-7.5z" {...p} />;
          case 'pause':
            return <Path d="M8 5v14M16 5v14" {...p} />;
          case 'volume':
            return <Path d="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" {...p} />;
          case 'volumeOff':
            return <Path d="M4 9h4l5-4v14l-5-4H4zM17 9.5l5 5M22 9.5l-5 5" {...p} />;
          case 'qr':
            return (
              <>
                <Rect x={3} y={3} width={7} height={7} rx={1.5} {...p} />
                <Rect x={14} y={3} width={7} height={7} rx={1.5} {...p} />
                <Rect x={3} y={14} width={7} height={7} rx={1.5} {...p} />
                <Path d="M14 14h3v3M21 14v.5M14 21h.5M17.5 21H21v-3.5M6.5 6.5h0M17.5 6.5h0M6.5 17.5h0" {...p} />
              </>
            );
          case 'scan':
            return <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" {...p} />;
          case 'userPlus':
            return (
              <>
                <Circle cx={9} cy={8} r={4} {...p} />
                <Path d="M2 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" {...p} />
              </>
            );
          case 'megaphone':
            return <Path d="M3 10v4a1 1 0 0 0 1 1h3l9 5V4L7 9H4a1 1 0 0 0-1 1zM7 15l1.5 5h3L10 15.5M19 9.5a3 3 0 0 1 0 5" {...p} />;
          case 'camera':
            return (
              <>
                <Path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p} />
                <Circle cx={12} cy={13} r={4} {...p} />
              </>
            );
          case 'sun':
            return (
              <>
                <Circle cx={12} cy={12} r={4} {...p} />
                <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...p} />
              </>
            );
          case 'cloud':
            return <Path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" {...p} />;
          case 'rain':
            return <Path d="M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 15zM8 18l-1 3M12 18l-1 3M16 18l-1 3" {...p} />;
          case 'clock':
            return (
              <>
                <Circle cx={12} cy={12} r={9} {...p} />
                <Path d="M12 7v5l3 2" {...p} />
              </>
            );
          case 'heart':
            return <Path d="M12 20s-7.5-4.6-9-9.3C1.8 6.8 4.4 4 7.3 4c2 0 3.5 1.1 4.7 2.8C13.2 5.1 14.7 4 16.7 4c2.9 0 5.5 2.8 4.3 6.7-1.5 4.7-9 9.3-9 9.3z" {...p} />;
          case 'trophy':
            return <Path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4.5M16 6h3.5a3 3 0 0 1-3.5 4.5M12 13v4M8.5 20h7M10 17h4v3h-4z" {...p} />;
          case 'shirt':
            return <Path d="M8 3l4 2 4-2 5 3-2 4-2-1v12H7V9L5 10 3 6z" {...p} />;
          case 'basket':
            return <Path d="M3 10h18l-2 10H5zM7 10l3-6M17 10l-3-6M9 14v3M12 14v3M15 14v3" {...p} />;
          case 'vote':
            return <Path d="M4 13h16v7H4zM8 13V5h8v8M10 9l1.5 1.5L14.5 7" {...p} />;
          case 'video':
            return (
              <>
                <Rect x={3} y={6} width={13} height={12} rx={2.5} {...p} />
                <Path d="M16 10l5-3v10l-5-3" {...p} />
              </>
            );
          case 'child':
            return (
              <>
                <Circle cx={12} cy={6} r={3} {...p} />
                <Path d="M7 12l5-2 5 2M12 10v6M9 21l3-5 3 5" {...p} />
              </>
            );
          case 'eyeOff':
            return <Path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.5 7.6C3.7 9.4 2 12 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4.4-1.1M9.9 10a3 3 0 0 0 4.2 4.2" {...p} />;
          case 'envelope':
            return <Path d="M3 7l9 7 9-7M3 7v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7l-9-4z" {...p} />;
          case 'grid':
            return (
              <>
                <Rect x={3} y={3} width={7.5} height={7.5} rx={2} {...p} />
                <Rect x={13.5} y={3} width={7.5} height={7.5} rx={2} {...p} />
                <Rect x={3} y={13.5} width={7.5} height={7.5} rx={2} {...p} />
                <Rect x={13.5} y={13.5} width={7.5} height={7.5} rx={2} {...p} />
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
