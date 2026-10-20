import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { t } from '../i18n';
import type { ServiceError } from '../services';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Skeleton } from './Skeleton';

interface Props<T> {
  query: UseQueryResult<T, ServiceError>;
  skeleton?: 'list' | 'card' | 'chart' | 'detail';
  rows?: number;
  isEmpty?: (data: T) => boolean;
  empty?: { icon?: string; title: string; body?: string; action?: string; onAction?: () => void } | ReactNode;
  children: (data: T) => ReactNode;
}

const isConfig = (e: unknown): e is { title: string } => typeof e === 'object' && e !== null && 'title' in e && typeof (e as { title: unknown }).title === 'string';

/** Every data-backed region goes through here, so loading, empty and error states are never forgotten. */
export function DataBoundary<T>({ query, skeleton = 'list', rows, isEmpty, empty, children }: Props<T>) {
  if (query.isPending) return <Skeleton variant={skeleton} rows={rows} />;
  if (query.isError) {
    const gone = query.error.code === 'not_found' || query.error.code === 'forbidden';
    return <ErrorState title={gone ? t('error.unavailable.title') : t('error.generic.title')} body={query.error.message || t('error.generic.body')} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  const blank = isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0;
  if (blank && empty) return isConfig(empty) ? <EmptyState {...empty} /> : <>{empty}</>;
  return <>{children(data)}</>;
}
