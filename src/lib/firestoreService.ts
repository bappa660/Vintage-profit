import { 
  getDocs, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Unsubscribe
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface UserProfile {
  uid: string;
  accountID: string; // Added custom ID
  name: string;
  email: string;
  walletBalance: number;
  createdTime: any;
  status: 'active' | 'suspended';
}

export interface InvestmentPlan {
  id: string;
  name: string;
  image: string;
  price: number;
  daily: number;
  revenue: number;
  period: number;
}

export interface PurchaseRecord {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  price: number;
  daily: number;
  purchaseTime: any;
  expiryTime: any;
  status: 'active' | 'completed';
}

export interface TransactionRecord {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  status: 'pending' | 'success' | 'rejected';
  timestamp: any;
  details?: string;
  utrNumber?: string;
  upiId?: string;
}

// User Services
export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const subscribeToUserProfile = (uid: string, callback: (user: UserProfile | null) => void): Unsubscribe => {
  const path = `users/${uid}`;
  return onSnapshot(doc(db, 'users', uid), (docSnap) => {
    callback(docSnap.exists() ? (docSnap.data() as UserProfile) : null);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

// Plan Services
export const getPlans = async (): Promise<InvestmentPlan[]> => {
  const path = 'plans';
  try {
    const querySnapshot = await getDocs(collection(db, 'plans'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvestmentPlan));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const subscribeToPlans = (callback: (plans: InvestmentPlan[]) => void): Unsubscribe => {
  const path = 'plans';
  return onSnapshot(collection(db, 'plans'), (snapshot) => {
    const plans = snapshot.docs
      .filter(doc => doc.id !== 'seed_marker')
      .map(doc => ({ id: doc.id, ...doc.data() } as InvestmentPlan));
    callback(plans);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

// Purchase Services
export const buyPlan = async (userId: string, plan: InvestmentPlan, currentBalance: number) => {
  if (currentBalance < plan.price) throw new Error('Insufficient balance');

  const purchasePath = 'purchases';
  const userPath = `users/${userId}`;
  
  try {
    const purchaseDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(purchaseDate.getDate() + plan.period);

    const batch = writeBatch(db);
    const purchaseRef = doc(collection(db, 'purchases'));

    // 1. Create purchase record
    batch.set(purchaseRef, {
      userId,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      daily: plan.daily,
      purchaseTime: serverTimestamp(),
      expiryTime: Timestamp.fromDate(expiryDate),
      status: 'active'
    });

    // 2. Deduct balance
    batch.update(doc(db, 'users', userId), {
      walletBalance: currentBalance - plan.price
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, purchasePath);
  }
};

export const subscribeToHistory = (userId: string, callback: (purchases: PurchaseRecord[]) => void): Unsubscribe => {
  const path = 'purchases';
  const q = query(
    collection(db, 'purchases'), 
    where('userId', '==', userId), 
    orderBy('purchaseTime', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRecord)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

// Money Services
export const requestDeposit = async (userId: string, amount: number, utrNumber: string) => {
  const path = 'deposits';
  try {
    await addDoc(collection(db, 'deposits'), {
      userId,
      amount,
      utrNumber,
      timestamp: serverTimestamp(),
      status: 'pending'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const requestWithdrawal = async (userId: string, amount: number, upiId: string, currentBalance: number) => {
  if (currentBalance < amount) throw new Error('Insufficient balance');
  
  const path = 'withdrawals';
  try {
    const batch = writeBatch(db);
    const withdrawalRef = doc(collection(db, 'withdrawals'));

    // 1. Create withdrawal record
    batch.set(withdrawalRef, {
      userId,
      amount,
      upiId,
      timestamp: serverTimestamp(),
      status: 'pending'
    });
    
    // 2. Deduct balance (locking it for pending withdrawal)
    batch.update(doc(db, 'users', userId), {
      walletBalance: currentBalance - amount
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const subscribeToDeposits = (userId: string, callback: (tx: any[]) => void): Unsubscribe => {
  const path = 'deposits';
  const q = query(
    collection(db, 'deposits'), 
    where('userId', '==', userId), 
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, type: 'deposit', ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const subscribeToWithdrawals = (userId: string, callback: (tx: any[]) => void): Unsubscribe => {
  const path = 'withdrawals';
  const q = query(
    collection(db, 'withdrawals'), 
    where('userId', '==', userId), 
    orderBy('timestamp', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, type: 'withdrawal', ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};
