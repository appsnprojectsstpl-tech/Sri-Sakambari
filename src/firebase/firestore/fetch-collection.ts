import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  type Firestore,
  type QueryConstraint,
  type WhereFilterOp,
  type OrderByDirection
} from 'firebase/firestore';
import { convertTimestamps } from './utils';

type Constraint =
  | ['where', string, WhereFilterOp, any]
  | ['orderBy', string, OrderByDirection?]
  | ['limit', number]
  | ['limitToLast', number]
  | ['startAfter', ...any[]]
  | ['endBefore', ...any[]];

export async function fetchCollection<T>(
  firestore: Firestore,
  collectionName: string,
  constraints: Constraint[] = []
): Promise<T[]> {
  const colRef = collection(firestore, collectionName);

  const queryConstraints: QueryConstraint[] = constraints.map(constraint => {
      const [type, ...args] = constraint;
      switch(type) {
          case 'where':
              return where(args[0] as string, args[1] as WhereFilterOp, args[2]);
          case 'orderBy':
              return orderBy(args[0] as string, args[1] as OrderByDirection | undefined);
          case 'limit':
              return limit(args[0] as number);
          case 'limitToLast':
              return limitToLast(args[0] as number);
          case 'startAfter':
              return startAfter(...args);
          case 'endBefore':
              return endBefore(...args);
          default:
              throw new Error(`Unknown query constraint type: ${type}`);
      }
  });

  const q = query(colRef, ...queryConstraints);
  const snapshot = await getDocs(q);

  const data: T[] = [];
  snapshot.forEach(doc => {
    data.push({ id: doc.id, ...convertTimestamps(doc.data()) } as T);
  });
  return data;
}
