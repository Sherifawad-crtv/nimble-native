import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { t } from '../i18n';
import { Button, T, color } from '../ui';

interface State {
  error: Error | null;
}

/** A render error must never leave a blank screen: show what failed and a way out. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ScrollView style={{ backgroundColor: color.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <T variant="title">{t('crash.title')}</T>
        <T>{t('crash.body.account')}</T>
        <T variant="caption" tone="muted">
          {String(error.message || error)}
        </T>
        <Button onPress={() => this.setState({ error: null })}>{t('crash.reload')}</Button>
      </ScrollView>
    );
  }
}
