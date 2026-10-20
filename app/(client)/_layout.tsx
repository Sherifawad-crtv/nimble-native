import type { ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useMe } from '../../src/core/auth';
import { t } from '../../src/i18n';
import { Icon, color, font } from '../../src/ui';

const tab = (icon: string) => ({ tabBarIcon: ({ color: c }: { color: ColorValue }) => <Icon name={icon} size={24} tint={String(c)} /> });

export default function ClientTabs() {
  const me = useMe();
  if (me.role !== 'client') return <Redirect href="/" />;
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
      <Tabs.Screen name="today" options={{ title: t('nav.today'), ...tab('home') }} />
      <Tabs.Screen name="calendar" options={{ title: t('nav.calendar'), ...tab('calendar') }} />
      <Tabs.Screen name="progress" options={{ title: t('nav.progress'), ...tab('trophy') }} />
      <Tabs.Screen name="settings" options={{ title: t('nav.settings'), ...tab('user') }} />
    </Tabs>
  );
}
