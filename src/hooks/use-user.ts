import { useUser as useFirebaseUser } from '@/firebase';

export function useUser() {
  return useFirebaseUser();
}