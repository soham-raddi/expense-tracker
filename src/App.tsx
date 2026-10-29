import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getDb } from './data/db';
import { unparsedCount } from './data/repos/transactionsRepo';
import { onDataChanged } from './lib/events';
import { AppLock } from './ui/screens/AppLock';
import { TabBar, type TabItem } from './ui/components/TabBar';
import { GroupsScreen } from './ui/screens/GroupsScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { monthOf, type MonthRef } from './lib/format';
import { MonthsScreen } from './ui/screens/MonthsScreen';
import { RulesScreen } from './ui/screens/RulesScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { usePalette } from './ui/theme';
import { UnparsedScreen } from './ui/screens/UnparsedScreen';

type TabKey = 'home' | 'months' | 'unparsed' | 'settings';
type Overlay = 'groups' | 'rules' | null;

function Shell() {
  const c = usePalette();
  const [tab, setTab] = useState<TabKey>('home');
  const [unparsed, setUnparsed] = useState(0);
  const [month, setMonth] = useState<MonthRef>(() => monthOf(Date.now()));
  const [overlay, setOverlay] = useState<Overlay>(null);

  const loadBadge = useCallback(async () => {
    setUnparsed(await unparsedCount(await getDb()));
  }, []);

  useEffect(() => {
    loadBadge();
    return onDataChanged(loadBadge);
  }, [loadBadge]);

  const tabs: TabItem<TabKey>[] = [
    { key: 'home', label: 'Home', glyph: '⌂' },
    { key: 'months', label: 'Months', glyph: '▤' },
    { key: 'unparsed', label: 'Unparsed', glyph: '!', badge: unparsed },
    { key: 'settings', label: 'Settings', glyph: '⚙' },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.flex}>
        {overlay === 'groups' ? (
          <GroupsScreen onBack={() => setOverlay(null)} />
        ) : overlay === 'rules' ? (
          <RulesScreen onBack={() => setOverlay(null)} />
        ) : (
          <>
            {tab === 'home' && (
              <HomeScreen month={month} onMonthChange={setMonth} onOpenSettings={() => setTab('settings')} />
            )}
            {tab === 'months' && (
              <MonthsScreen
                onPickMonth={m => {
                  setMonth(m);
                  setTab('home');
                }}
              />
            )}
            {tab === 'unparsed' && <UnparsedScreen />}
            {tab === 'settings' && <SettingsScreen onOpen={setOverlay} />}
          </>
        )}
      </View>
      <TabBar
        tabs={tabs}
        active={tab}
        onChange={key => {
          setOverlay(null);
          setTab(key);
        }}
      />
    </View>
  );
}

function App() {
  const isDark = useColorScheme() === 'dark';
  const c = usePalette();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <AppLock>
          <Shell />
        </AppLock>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });

export default App;
