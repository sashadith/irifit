import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Apple-Logo für den „Mit Apple fortfahren"-Button (Pendant zu GoogleLogo) */
export function AppleLogo({ size = 18 }: { readonly size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={colors.ink}>
      <Path d="M17.05 12.54c-.03-2.66 2.17-3.94 2.27-4-1.24-1.81-3.16-2.06-3.85-2.09-1.64-.17-3.2.96-4.03.96-.83 0-2.11-.94-3.47-.91-1.79.03-3.44 1.04-4.36 2.64-1.86 3.22-.48 7.99 1.33 10.6.88 1.28 1.94 2.71 3.32 2.66 1.33-.05 1.83-.86 3.44-.86 1.61 0 2.06.86 3.47.83 1.43-.02 2.34-1.3 3.22-2.59 1.01-1.48 1.43-2.92 1.46-3-.03-.01-2.8-1.07-2.83-4.24M14.4 4.63c.73-.89 1.23-2.12 1.09-3.35-1.06.04-2.34.7-3.1 1.59-.68.79-1.27 2.05-1.11 3.25 1.18.09 2.39-.6 3.12-1.49" />
    </Svg>
  );
}
