import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db 
} from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  serverTimestamp, 
  getDoc,
  collection,
  writeBatch
} from 'firebase/firestore';
import { 
  UserProfile, 
  subscribeToUserProfile, 
  InvestmentPlan,
  subscribeToPlans,
  buyPlan,
  PurchaseRecord,
  subscribeToHistory,
  requestDeposit,
  requestWithdrawal,
  subscribeToDeposits,
  subscribeToWithdrawals
} from './lib/firestoreService';
import { 
  Home, 
  History as HistoryIcon, 
  User as UserIcon, 
  Bell, 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  LogOut, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
    <motion.div 
      animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
      transition={{ repeat: Infinity, duration: 2 }}
      className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
    />
  </div>
);

const Auth = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
        
        // Generate custom Account ID: MK + 4 random digits
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const accountID = `MK${randomDigits}`;

        // Create initial user profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          accountID,
          name,
          email,
          walletBalance: 0,
          createdTime: serverTimestamp(),
          status: 'active'
        });
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen premium-gradient flex flex-col items-center justify-center p-6 bg-slate-100">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-900">Vantage Invest</h1>
          <p className="text-slate-500 mt-2">{isLogin ? 'Sign in to your account' : 'Create your free account'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Full Name</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Enter your full name"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Min 6 characters"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-600 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 text-blue-600 font-bold hover:underline"
            >
              {isLogin ? 'Sign up' : 'Login'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const PlanCard = ({ plan, onBuy }: { plan: InvestmentPlan; onBuy: (plan: InvestmentPlan) => void | Promise<void>; key?: any }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-2xl overflow-hidden plan-card-shadow border border-[#f1f5f9] flex flex-col p-4"
    >
      <div className="relative h-20 mb-3 overflow-hidden rounded-xl">
        <img 
          src={plan.image} 
          alt={plan.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent flex items-center justify-center">
           <span className="text-white font-bold text-xs">VIP {plan.id}</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <h3 className="text-xs font-bold text-[#1e293b] mb-2 line-clamp-1">{plan.name}</h3>
        <div className="space-y-1 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Daily</span>
            <span className="text-[10px] font-bold text-emerald-600">+₹{plan.daily}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Price</span>
            <span className="text-[10px] font-bold text-[#1e293b]">₹{plan.price}</span>
          </div>
        </div>
        <button 
          onClick={() => onBuy(plan)}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition shadow-sm active:scale-95"
        >
          Invest Now
        </button>
      </div>
    </motion.div>
  );
};

const HistoryCard = ({ purchase }: { purchase: PurchaseRecord; key?: any }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const calculateTime = () => {
      if (!purchase.expiryTime) return;
      const expiryDate = purchase.expiryTime.toDate ? purchase.expiryTime.toDate() : new Date(purchase.expiryTime);
      const now = new Date();
      const diff = expiryDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Completed');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [purchase.expiryTime]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-5 shadow-lg border border-slate-100 mb-4"
    >
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-800">{purchase.planName}</h3>
            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${timeLeft === 'Completed' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
              {timeLeft === 'Completed' ? 'Completed' : 'Active'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Invested: ₹{purchase.price}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Daily Income</p>
          <p className="text-sm font-bold text-emerald-600">₹{purchase.daily}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Revenue</p>
          <p className="text-sm font-bold text-slate-700">₹{purchase.daily * 52}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center text-blue-600">
          <Clock className="w-4 h-4 mr-2" />
          <span className="text-sm font-mono font-bold">{timeLeft}</span>
        </div>
        <p className="text-[10px] text-slate-400">Ends: {purchase.expiryTime?.toDate?.().toLocaleDateString() || 'N/A'}</p>
      </div>
    </motion.div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
        />
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[40px] p-8 z-[101] shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
              <LogOut className="w-5 h-5 transform rotate-90" />
            </button>
          </div>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile'>('home');
  const [loading, setLoading] = useState(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const transactions = useMemo(() => {
    return [...deposits, ...withdrawals].sort((a, b) => {
      const timeA = a.timestamp?.toDate?.().getTime() || 0;
      const timeB = b.timestamp?.toDate?.().getTime() || 0;
      return timeB - timeA;
    });
  }, [deposits, withdrawals]);

  useEffect(() => {
    if (user) {
      const unsubUser = subscribeToUserProfile(user.uid, setProfile);
      const unsubPlans = subscribeToPlans(setPlans);
      const unsubHistory = subscribeToHistory(user.uid, setPurchases);
      const unsubDeps = subscribeToDeposits(user.uid, setDeposits);
      const unsubWiths = subscribeToWithdrawals(user.uid, setWithdrawals);
      
      // Auto-seed plans if empty
      const checkAndSeed = async () => {
        const plansCheck = await getDoc(doc(db, 'plans', 'seed_marker'));
        if (!plansCheck.exists()) {
          const batch = writeBatch(db);
          const initialPlans = [
            { id: '0', name: 'Starter Trial', price: 100, daily: 10, revenue: 520, period: 52, image: 'https://picsum.photos/seed/trial/800/600' },
            { id: '1', name: 'Upgrade VIP 1', price: 500, daily: 50, revenue: 2600, period: 52, image: 'https://picsum.photos/seed/vip1/800/600' },
            { id: '2', name: 'Upgrade VIP 2', price: 2000, daily: 250, revenue: 13000, period: 52, image: 'https://picsum.photos/seed/vip2/800/600' },
            { id: '3', name: 'Upgrade VIP 3', price: 5000, daily: 700, revenue: 36400, period: 52, image: 'https://picsum.photos/seed/vip3/800/600' },
            { id: '4', name: 'Premium VIP 4', price: 10000, daily: 1500, revenue: 78000, period: 52, image: 'https://picsum.photos/seed/vip4/800/600' },
            { id: '5', name: 'Professional VIP 5', price: 25000, daily: 4000, revenue: 208000, period: 52, image: 'https://picsum.photos/seed/vip5/800/600' },
            { id: '6', name: 'Elite VIP 6', price: 50000, daily: 9000, revenue: 468000, period: 52, image: 'https://picsum.photos/seed/vip6/800/600' },
          ];
          initialPlans.forEach(p => {
            batch.set(doc(db, 'plans', p.id), p);
          });
          batch.set(doc(db, 'plans', 'seed_marker'), { seededAt: serverTimestamp() });
          await batch.commit();
        }
        setLoading(false);
      };
      checkAndSeed();

      return () => {
        unsubUser();
        unsubPlans();
        unsubHistory();
        unsubDeps();
        unsubWiths();
      };
    }
  }, [user]);

  const handleLogOut = () => {
    signOut(auth);
  };

  const handleBuy = async (plan: InvestmentPlan) => {
    if (!profile) return;
    try {
      if (profile.walletBalance < plan.price) {
        alert('Insufficient wallet balance. Please add money.');
        return;
      }
      if (confirm(`Buy ${plan.name} for ₹${plan.price}?`)) {
        await buyPlan(profile.uid, plan, profile.walletBalance);
        alert('Plan purchased successfully!');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return <Auth onAuthSuccess={() => {}} />;

  return (
    <div className="min-h-screen bg-[#e2e8f0] flex items-center justify-center p-4">
      <div className="w-full max-w-[375px] h-[667px] bg-white rounded-[48px] border-[12px] border-[#1e293b] shadow-2xl overflow-hidden relative flex flex-col">
        {/* Status Bar */}
        <div className="h-6 flex justify-between items-center px-6 pt-3 font-semibold text-[10px] text-[#1e293b] z-50">
          <span>9:41</span>
          <div className="flex gap-1 items-center">
            <span>5G</span>
            <div className="w-4 h-2 border border-slate-400 rounded-px flex items-center justify-start p-[1px]">
              <div className="w-full h-full bg-slate-900 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Top Header */}
        <div className="p-5 flex justify-between items-center bg-white z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-slate-500 shadow-sm">
              {profile?.name?.substring(0, 2).toUpperCase() || '??'}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">WELCOME BACK</p>
              <h2 className="text-sm font-bold text-[#1e293b]">{profile?.name || <div className="w-20 h-4 bg-slate-100 animate-pulse rounded" />}</h2>
            </div>
          </div>
          <button className="w-10 h-10 border border-[#f1f5f9] rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition">
            <Bell className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 hide-scrollbar">
          {activeTab === 'home' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              {/* Wallet Card */}
              <div className="premium-gradient rounded-3xl p-6 text-white shadow-xl wallet-card-shadow relative overflow-hidden mb-6">
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-5">
                    <div className="glass-pill px-3 py-1 rounded-full text-[10px] font-bold text-white/90">
                      Standard Account
                    </div>
                    <CreditCard className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Available Balance</span>
                    <h1 className="text-3xl font-bold mt-1 mb-5">
                      {profile ? `₹${profile.walletBalance.toLocaleString()}` : <div className="w-32 h-8 bg-white/20 animate-pulse rounded-lg mt-1" />}
                    </h1>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsDepositModalOpen(true)}
                        className="flex-1 py-2 bg-white/20 backdrop-blur-md rounded-xl font-bold text-[11px] text-white hover:bg-white/30 transition border border-white/20"
                      >
                        + Add Money
                      </button>
                      <button 
                        onClick={() => setIsWithdrawModalOpen(true)}
                        className="flex-1 py-2 bg-white/20 backdrop-blur-md rounded-xl font-bold text-[11px] text-white hover:bg-white/30 transition border border-white/20"
                      >
                        ↑ Withdraw
                      </button>
                    </div>
                  </div>
                </div>
                {/* Decorative circle */}
                <div className="absolute -top-16 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
              </div>

              {/* Plans Section */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[#1e293b]">Investment Plans</h3>
                  <span className="text-blue-600 text-[11px] font-bold uppercase tracking-wider">
                    View All
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pb-4">
                  {plans.length > 0 ? (
                    plans.map(plan => (
                      <PlanCard key={plan.id} plan={plan} onBuy={handleBuy} />
                    ))
                  ) : (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-slate-50 rounded-2xl h-32 animate-pulse border border-slate-100" />
                    ))
                  )}
                </div>

                {/* Market Update simulation from reference */}
                <div className="bg-[#f8fafc] rounded-2xl p-3 flex items-center gap-3 mt-4">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-red-600 transform" />
                  </div>
                  <div>
                    <div className="font-bold text-[12px] text-[#1e293b]">Market Update</div>
                    <div className="text-[10px] text-slate-500 lowercase">Crypto market is up by 2.4% today.</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <h3 className="text-sm font-bold text-[#1e293b] mb-4">Purchase History</h3>
              {purchases.length > 0 ? (
                purchases.map(p => <HistoryCard key={p.id} purchase={p} />)
              ) : (
                <div className="py-20 text-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HistoryIcon className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-600">No active investments</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Profile Header */}
              <div className="text-center mb-8 pt-4">
                <div className="relative inline-block mb-3">
                  <div className="w-24 h-24 rounded-[32px] bg-blue-50 flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                    {profile ? (
                      <UserIcon className="w-12 h-12 text-blue-600" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 animate-pulse" />
                    )}
                  </div>
                </div>
                {profile ? (
                  <>
                    <h2 className="text-lg font-bold text-[#1e293b]">{profile.name}</h2>
                    <div className="flex flex-col items-center mt-1 text-[10px] text-slate-400 space-y-1">
                       <div className="bg-slate-100 px-2 py-0.5 rounded-full font-mono font-bold text-slate-600">ID: {profile.accountID}</div>
                       <div className="flex items-center">
                         <Clock className="w-3 h-3 mr-1" />
                         Member since {profile.createdTime?.toDate?.().toLocaleDateString() || 'N/A'}
                       </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 mt-2">
                    <div className="w-32 h-4 bg-slate-100 rounded-full mx-auto animate-pulse" />
                    <div className="w-24 h-3 bg-slate-50 rounded-full mx-auto animate-pulse" />
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Assets</p>
                  <p className="text-lg font-bold text-slate-800">₹{(profile?.walletBalance || 0).toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Active Plans</p>
                  <p className="text-lg font-bold text-slate-800">{purchases.filter(p => p.status === 'active').length}</p>
                </div>
              </div>

              {/* Menu Sections */}
              <div className="space-y-2 mb-20">
                {[
                  { icon: ArrowUpRight, label: 'Withdrawal', color: 'text-red-600', bg: 'bg-red-50', onClick: () => setIsWithdrawModalOpen(true) },
                  { icon: Plus, label: 'Add Money', color: 'text-emerald-600', bg: 'bg-emerald-50', onClick: () => setIsDepositModalOpen(true) },
                  { icon: HistoryIcon, label: 'Transaction History', color: 'text-slate-600', bg: 'bg-slate-100', onClick: () => setIsTxModalOpen(true) },
                  { icon: LogOut, label: 'Logout', color: 'text-slate-600', bg: 'bg-slate-100', onClick: handleLogOut },
                ].map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={item.onClick}
                    className="w-full flex items-center p-3.5 bg-white rounded-2xl border border-[#f1f5f9] hover:bg-slate-50 transition shadow-sm"
                  >
                    <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center mr-3 shadow-inner`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="flex-1 text-left text-[13px] font-bold text-slate-700">{item.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="h-[72px] bg-white border-t border-[#f1f5f9] flex items-center justify-around pb-2">
          {[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'history', icon: TrendingUp, label: 'History' },
            { id: 'profile', icon: UserIcon, label: 'Profile' },
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center flex-1 py-2 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`}
            >
              <tab.icon className={`w-6 h-6 mb-1 ${activeTab === tab.id ? 'fill-blue-50' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Deposit Modal */}
      <Modal 
        isOpen={isDepositModalOpen} 
        onClose={() => setIsDepositModalOpen(false)} 
        title="Add Money"
      >
        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 text-center">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-4">Official Payment QR</p>
            <div className="w-48 h-48 bg-white rounded-3xl mx-auto shadow-inner flex items-center justify-center p-4">
              <img 
                src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=vantageinvest@bank" 
                alt="Payment QR" 
                className="w-full h-full"
              />
            </div>
            <div className="mt-6 flex items-center justify-center space-x-3 bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-sm font-bold text-slate-700">vantageinvest@bank</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('vantageinvest@bank');
                  alert('UPI ID Copied!');
                }}
                className="text-blue-600 bg-blue-50 p-1.5 rounded-lg"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const amount = Number((form.elements.namedItem('amount') as HTMLInputElement).value);
            const utr = (form.elements.namedItem('utr') as HTMLInputElement).value;
            if (profile && amount > 0) {
              await requestDeposit(profile.uid, amount, utr);
              alert('Deposit request submitted! Once verified, balance will update.');
              setIsDepositModalOpen(false);
            }
          }} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Amount to add (₹)</label>
              <input 
                name="amount"
                type="number" 
                required 
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition font-bold text-lg"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">UTR / Transaction Number</label>
              <input 
                name="utr"
                type="text" 
                required 
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition font-bold"
                placeholder="12 digit number"
              />
            </div>
            <p className="text-[10px] text-slate-400 text-center italic">Take a screenshot of payment and keep it safe for verification.</p>
            <button className="w-full py-4 bg-blue-600 text-white font-bold rounded-[24px] shadow-xl hover:bg-blue-700 transition active:scale-95">
              Submit Request
            </button>
          </form>
        </div>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal 
        isOpen={isWithdrawModalOpen} 
        onClose={() => setIsWithdrawModalOpen(false)} 
        title="Withdraw Money"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Available for withdrawal</p>
              <p className="text-2xl font-bold text-slate-800">₹{(profile?.walletBalance || 0).toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const amount = Number((form.elements.namedItem('amount') as HTMLInputElement).value);
            const upiId = (form.elements.namedItem('upi') as HTMLInputElement).value;
            if (profile && amount >= 100) {
              try {
                await requestWithdrawal(profile.uid, amount, upiId, profile.walletBalance);
                alert('Withdrawal request submitted! Processing takes 24-48 hours.');
                setIsWithdrawModalOpen(false);
              } catch (err: any) {
                alert(err.message);
              }
            } else {
              alert('Minimum withdrawal is ₹100');
            }
          }} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Withdrawal Amount (₹)</label>
              <input 
                name="amount"
                type="number" 
                required 
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition font-bold text-lg"
                placeholder="Min 100.00"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Recipient UPI ID</label>
              <input 
                name="upi"
                type="text" 
                required 
                className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 transition font-bold"
                placeholder="example@upi"
              />
            </div>
            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex items-start">
              <AlertCircle className="w-4 h-4 text-orange-600 mr-3 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-orange-700 leading-relaxed">Please double-check UPI ID. We are not responsible for funds sent to incorrect ID.</p>
            </div>
            <button className="w-full py-4 bg-slate-900 text-white font-bold rounded-[24px] shadow-xl hover:bg-black transition active:scale-95">
              Request Payout
            </button>
          </form>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title="Transaction History"
      >
        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((tx: any) => (
              <div key={tx.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'deposit' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {tx.type === 'deposit' ? <Plus className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-800 capitalize">{tx.type}</p>
                    <p className="text-[9px] text-slate-400 font-medium">{tx.timestamp?.toDate?.().toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {tx.type === 'deposit' ? '+' : '-'}₹{tx.amount}
                  </p>
                  <p className={`text-[8px] font-bold uppercase tracking-wider ${
                    tx.status === 'success' ? 'text-emerald-500' : 
                    tx.status === 'pending' ? 'text-orange-500' : 'text-red-500'
                  }`}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400">
              <HistoryIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No recent transactions</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
