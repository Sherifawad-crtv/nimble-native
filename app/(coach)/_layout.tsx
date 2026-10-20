import type { ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useMe } from '../../src/app/auth';
import { t } from '../../src/i18n';
import { sessionService } from '../../src/services';
import { Icon, color, font } from '../../src/ui';

const tab = (icon: string) => ({ tabBarIcon: ({ color: c }: { color: ColorValue }) => <Icon name={icon} size={24} tint={String(c)} /> });

export default function CoachTabs() {
  const me = useMe();
  if (me.role !== 'coach') return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.line },
        tabBarLabelStyle: { fontFamily: font.sansSemi, fontSize: 11 },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="clients" options={{ title: t('nav.clients'), ...tab('users') }} />
      <Tabs.Screen name="library" options={{ title: t('nav.library'), ...tab('book') }} />
      <Tabs.Screen name="workouts" options={{ title: t('nav.workouts'), ...tab('dumbbell') }} />
      <Tabs.Screen name="assistant" options={{ title: t('nav.assistant'), href: sessionService.kind === 'account' ? undefined : null, ...tab('sparkle') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings'), ...tab('gear') }} />
    </Tabs>
  );
}
