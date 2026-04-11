// For backward compatibility, export a combined Icons object
import { MediaIcons } from './icons/media-icons';
import { NavigationIcons } from './icons/navigation-icons';
import { UtilityIcons } from './icons/utility-icons';
import { DanmakuIcons } from './icons/danmaku-icons';

export const Icons = {
  ...MediaIcons,
  ...NavigationIcons,
  ...UtilityIcons,
  ...DanmakuIcons,
};
