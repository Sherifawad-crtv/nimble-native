import { Redirect } from 'expo-router';
import { useMe } from '../src/core/auth';

export default function Index() {
  const me = useMe();
  return <Redirect href={me.role === 'coach' ? '/(coach)/clients' : '/(client)/today'} />;
}
