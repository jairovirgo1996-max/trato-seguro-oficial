import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom';
import { FirebaseProvider, useAuth } from './components/FirebaseProvider';
import { auth, db } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { 
  Plus, 
  ShieldCheck, 
  History, 
  User as UserIcon, 
  LogOut, 
  ArrowRight, 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ExternalLink,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  serverTimestamp, 
  orderBy,
  getDocs
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './components/FirebaseProvider';
import { cn } from './lib/utils';

// --- Types ---
interface Deal {
  id: string;
  sellerId: string;
  buyerId?: string;
  productName: string;
  productDescription: string;
  price: number;
  commission: number;
  commissionPayer: 'seller' | 'buyer' | 'split';
  status: 'PENDING_PAYMENT' | 'FUNDS_SECURED' | 'SHIPPED' | 'COMPLETED' | 'DISPUTED';
  paymentProofUrl?: string;
  shippingProofUrl?: string;
  createdAt: any;
  updatedAt: any;
}

interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  method: 'CCI' | 'YAPE' | 'PLIN';
  details: string;
  status: 'PENDING' | 'COMPLETED';
  createdAt: any;
}

// --- Helpers ---
const ADMIN_EMAIL = 'jairo.virgo1996@gmail.com';

const getStatusColor = (status: Deal['status']) => {
  switch (status) {
    case 'PENDING_PAYMENT': return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'FUNDS_SECURED': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
    case 'SHIPPED': return 'bg-purple-50 text-purple-700 border-purple-100';
    case 'COMPLETED': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'DISPUTED': return 'bg-rose-50 text-rose-700 border-rose-100';
    default: return 'bg-slate-50 text-slate-700 border-slate-100';
  }
};

const getStatusLabel = (status: Deal['status']) => {
  switch (status) {
    case 'PENDING_PAYMENT': return 'Esperando Pago';
    case 'FUNDS_SECURED': return 'Fondos Asegurados';
    case 'SHIPPED': return 'En Tránsito';
    case 'COMPLETED': return 'Completado';
    case 'DISPUTED': return 'En Disputa';
    default: return status;
  }
};

// --- Components ---

const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-800">TratoSeguro</span>
          <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded-full">Escrow</span>
        </Link>

        <div className="flex items-center gap-4">
          <a 
            href="https://wa.me/51969008815" 
            target="_blank" 
            rel="noreferrer"
            className="hidden md:flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all"
          >
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Soporte WhatsApp
          </a>
          {user ? (
            <>
              <Link to="/dashboard" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                Mis Tratos
              </Link>
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-semibold">{user.displayName}</span>
                <span className="text-[10px] text-emerald-600 font-bold uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verificado
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
              <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
            </>
          ) : (
            <button 
              onClick={handleLogin}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const Home = () => {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest mb-8 border border-indigo-100">
            <ShieldCheck className="w-4 h-4" />
            Árbitro Imparcial de Pagos
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-8 font-sans">
            Tus compras, <br /><span className="text-indigo-600">verdaderamente seguras.</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 leading-relaxed max-w-xl mx-auto font-medium">
            Retenemos el dinero hasta que el comprador confirma que todo está bien. Sin estafas, sin drama.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="bg-indigo-600 text-white px-10 py-5 rounded-2xl text-lg font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
            >
              Empezar Ahora <ArrowRight className="w-5 h-5" />
            </button>
            <Link 
              to="/#how-it-works"
              className="bg-white text-slate-900 px-10 py-5 rounded-2xl text-lg font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
            >
              ¿Cómo funciona?
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return <Navigate to="/dashboard" />;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);

  const [userProfile, setUserProfile] = useState<{ payoutMethod?: 'CCI' | 'YAPE' | 'PLIN', payoutDetails?: string } | null>(null);
  const [isEditingPayout, setIsEditingPayout] = useState(false);
  const [newPayoutMethod, setNewPayoutMethod] = useState<'CCI' | 'YAPE' | 'PLIN'>('CCI');
  const [newPayoutDetails, setNewPayoutDetails] = useState('');

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserProfile(data as any);
        setNewPayoutMethod(data.payoutMethod || 'CCI');
        setNewPayoutDetails(data.payoutDetails || '');
      }
    });

    const isAdmin = user.email === ADMIN_EMAIL;

    if (isAdmin) {
      const qAll = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
      const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
        setDeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal)));
      });
      return () => {
        unsubscribe();
        unsubscribeAll();
      };
    }

    // Query deals where user is seller or buyer
    const qSeller = query(collection(db, 'deals'), where('sellerId', '==', user.uid), orderBy('createdAt', 'desc'));
    const qBuyer = query(collection(db, 'deals'), where('buyerId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribeSeller = onSnapshot(qSeller, (snapshot) => {
      const sellerDeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
      setDeals(prev => {
        const others = prev.filter(d => d.sellerId !== user.uid);
        return [...sellerDeals, ...others].sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      });
    });

    const unsubscribeBuyer = onSnapshot(qBuyer, (snapshot) => {
      const buyerDeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
      setDeals(prev => {
        const others = prev.filter(d => d.buyerId !== user.uid);
        return [...buyerDeals, ...others].sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);
      });
    });

    return () => {
      unsubscribeSeller();
      unsubscribeBuyer();
    };
  }, [user]);

  const totalAmount = deals.reduce((acc, d) => {
    if (d.status === 'COMPLETED' && d.sellerId === user?.uid) return acc + d.price;
    return acc;
  }, 0);

  const pendingAmount = deals.reduce((acc, d) => {
    if (d.status !== 'COMPLETED' && d.sellerId === user?.uid) return acc + d.price;
    return acc;
  }, 0);

  const handleUpdatePayout = async () => {
    if (!user || !newPayoutDetails) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        payoutMethod: newPayoutMethod,
        payoutDetails: newPayoutDetails,
        updatedAt: serverTimestamp()
      });
      setIsEditingPayout(false);
      alert('Información de pago actualizada correctamente.');
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleWithdraw = async () => {
    if (!userProfile?.payoutMethod || !userProfile?.payoutDetails) {
      alert('Por favor, configura tu método de pago primero para poder retirar los fondos.');
      setIsEditingPayout(true);
      return;
    }
    if (totalAmount <= 0) {
      alert('No tienes saldo disponible para retirar actualmente.');
      return;
    }

    try {
      await addDoc(collection(db, 'withdrawals'), {
        userId: user.uid,
        amount: totalAmount,
        method: userProfile.payoutMethod,
        details: userProfile.payoutDetails,
        status: 'PENDING',
        createdAt: serverTimestamp()
      });
      
      // Simulación de notificación por correo
      console.log(`[SIMULACIÓN] Correo enviado a ${user.email}: "Tu solicitud de retiro de S/ ${totalAmount.toFixed(2)} vía ${userProfile.payoutMethod} está en proceso."`);
      
      alert(`Solicitud enviada. Te avisaremos por correo cuando el depósito esté listo.`);
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'withdrawals');
    }
  };

  const isAdmin = user?.email === ADMIN_EMAIL;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isAdmin ? 'Panel de Administración' : 'Dashboard'}
          </h2>
          <p className="text-slate-500 font-medium font-sans">
            {isAdmin ? 'Control total de la plataforma y comisiones.' : 'Panel de control de transacciones.'}
          </p>
        </div>
        {!isAdmin && (
          <Link 
            to="/create"
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" /> Nuevo Trato
          </Link>
        )}
      </div>

      {isAdmin ? (
        <AdminDashboard deals={deals} />
      ) : (
        <main className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-2 gap-6">
        {/* Bento Card: Balance */}
        <div className="md:col-span-4 bg-white rounded-4xl border border-slate-200 p-8 flex flex-col justify-between shadow-sm min-h-[280px]">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Saldo Disponible</span>
            <div className="p-2 bg-slate-50 rounded-xl">
              <Wallet className="w-5 h-5 text-slate-400" />
            </div>
          </div>
          <div className="flex flex-col mb-4">
            <span className="text-4xl font-black text-slate-900">S/ {totalAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
            <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Pendiente de liberación: S/ {pendingAmount.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Método de Pago</span>
              <button 
                onClick={() => setIsEditingPayout(!isEditingPayout)}
                className="text-[10px] font-bold text-indigo-600 hover:underline"
              >
                {(userProfile?.payoutMethod && userProfile?.payoutDetails) ? 'Cambiar' : 'Configurar'}
              </button>
            </div>
            {isEditingPayout ? (
              <div className="space-y-2">
                <select 
                  value={newPayoutMethod}
                  onChange={(e) => setNewPayoutMethod(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="CCI">CCI (Interbancaria)</option>
                  <option value="YAPE">Yape</option>
                  <option value="PLIN">Plin</option>
                </select>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder={newPayoutMethod === 'CCI' ? "20 dígitos..." : "Número de celular..."}
                    value={newPayoutDetails}
                    onChange={(e) => setNewPayoutDetails(e.target.value)}
                  />
                  <button 
                    onClick={handleUpdatePayout}
                    className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold"
                  >
                    Ok
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {userProfile?.payoutMethod && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black rounded uppercase">
                    {userProfile.payoutMethod}
                  </span>
                )}
                <p className="text-sm font-mono text-slate-600 truncate">
                  {userProfile?.payoutDetails || 'No configurada'}
                </p>
              </div>
            )}
          </div>

          <button 
            onClick={handleWithdraw}
            className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" /> Retirar Fondos
          </button>
        </div>

        {/* Bento Card: Main Deal or Status */}
        <div className="md:col-span-8 md:row-span-2 bg-white rounded-4xl border border-slate-200 p-8 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
             <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Mis Tratos Activos ({deals.length})</span>
             <Link to="/dashboard" className="text-xs font-bold text-indigo-600 hover:underline">Ver todos</Link>
          </div>
          
          <div className="space-y-4 overflow-y-auto max-h-[500px] pr-2">
            {deals.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
                <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-50 shadow-sm">
                  <Package className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-bold text-sm">No hay tratos registrados.</p>
              </div>
            ) : (
              deals.map((deal) => (
                <Link 
                  key={deal.id}
                  to={`/deal/${deal.id}`}
                  className="group bg-white p-6 rounded-3xl border border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                      <Package className="w-7 h-7 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{deal.productName}</h4>
                      <p className="text-xs font-bold text-slate-400">S/ {deal.price.toFixed(2)} • {deal.sellerId === user?.uid ? 'Venta' : 'Compra'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border", getStatusColor(deal.status))}>
                      {getStatusLabel(deal.status)}
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-200 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Bento Card: Support */}
        <div className="md:col-span-4 bg-emerald-50 rounded-4xl border border-emerald-100 p-8 flex items-center gap-5 shadow-sm">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h4 className="font-black text-emerald-900 text-sm">Soporte 24/7</h4>
            <p className="text-emerald-700/80 text-[11px] font-medium mt-1 leading-relaxed">Habla con un árbitro humano ahora si tienes problemas.</p>
          </div>
        </div>

        {/* Bento Card: KYC status */}
        <div className="md:col-span-4 bg-slate-900 rounded-4xl p-8 flex flex-col justify-between text-white border border-slate-800 shadow-sm min-h-[160px]">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-1">KYC Status</span>
              <span className="font-black text-lg">Usuario Pro</span>
            </div>
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full w-[85%] bg-emerald-500 rounded-full"></div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Identidad verificada exitosamente.</p>
          </div>
        </div>
      </main>
    )}
  </div>
);
};

const CreateDeal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productName: '',
    productDescription: '',
    price: '',
    commissionPayer: 'buyer' as 'seller' | 'buyer' | 'split'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const price = parseFloat(formData.price);
      const commission = price * 0.02; // 2% fee

      const dealData = {
        sellerId: user.uid,
        productName: formData.productName,
        productDescription: formData.productDescription,
        price,
        commission,
        commissionPayer: formData.commissionPayer,
        status: 'PENDING_PAYMENT',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'deals'), dealData);
      navigate(`/deal/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deals');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Crear Nuevo Trato</h2>
      <p className="text-slate-500 font-medium mb-10">Define los términos de la venta y genera un link de pago seguro.</p>

      <form onSubmit={handleSubmit} className="bg-white p-10 rounded-4xl border border-slate-200 shadow-sm space-y-8">
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">¿Qué estás vendiendo?</label>
          <input 
            type="text" 
            required
            className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium"
            placeholder="Ej: Laptop Lenovo Legion 5"
            value={formData.productName}
            onChange={e => setFormData(f => ({ ...f, productName: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Descripción (Opcional)</label>
          <textarea 
            className="w-full p-5 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none resize-none h-32 font-medium"
            placeholder="Detalles sobre el estado del producto..."
            value={formData.productDescription}
            onChange={e => setFormData(f => ({ ...f, productDescription: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Precio Acordado</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300">S/</span>
              <input 
                type="number" 
                required
                className="w-full p-5 pl-12 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white transition-all outline-none font-bold text-xl"
                placeholder="0.00"
                value={formData.price}
                onChange={e => setFormData(f => ({ ...f, price: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Comisión del Servicio (2%)</label>
            <div className="p-5 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-xl flex items-center justify-between">
              <span>S/ {(parseFloat(formData.price || '0') * 0.02).toFixed(2)}</span>
              <ShieldCheck className="w-6 h-6 opacity-30" />
            </div>
            {formData.price && (
              <div className="mt-3 p-4 bg-white border border-slate-100 rounded-xl space-y-2">
                <div className="flex justify-between text-[11px] font-medium text-slate-500">
                  <span>Comprador paga:</span>
                  <span className="font-bold text-slate-900">
                    S/ {(parseFloat(formData.price) + (formData.commissionPayer === 'buyer' ? parseFloat(formData.price) * 0.02 : formData.commissionPayer === 'split' ? parseFloat(formData.price) * 0.01 : 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-medium text-slate-500">
                  <span>Vendedor recibe:</span>
                  <span className="font-bold text-indigo-600">
                    S/ {(parseFloat(formData.price) - (formData.commissionPayer === 'seller' ? parseFloat(formData.price) * 0.02 : formData.commissionPayer === 'split' ? parseFloat(formData.price) * 0.01 : 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
           <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">¿Quién asume la comisión de seguridad?</label>
          <div className="grid grid-cols-3 gap-3">
            {(['buyer', 'seller', 'split'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormData(f => ({ ...f, commissionPayer: type }))}
                className={cn(
                  "p-4 rounded-2xl border-2 font-bold text-xs uppercase tracking-widest transition-all",
                  formData.commissionPayer === type 
                    ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100" 
                    : "bg-white border-slate-100 text-slate-400 hover:border-indigo-200"
                )}
              >
                {type === 'buyer' ? 'Comprador' : type === 'seller' ? 'Vendedor' : '50% / 50%'}
              </button>
            ))}
          </div>
        </div>

        <button 
          disabled={loading}
          className="w-full bg-slate-900 text-white py-5 rounded-2xl text-lg font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? 'Creando...' : 'Generar Link de Cobro Seguro'}
          <ArrowRight className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
};

const DealDetails = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  const [isUpdating, setIsUpdating] = useState(false);
  const [shippingFile, setShippingFile] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'deals', id), (doc) => {
      if (doc.exists()) {
        setDeal({ id: doc.id, ...doc.data() } as Deal);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  if (loading) return <div className="p-10 text-center">Cargando...</div>;
  if (!deal) return <div className="p-10 text-center">Trato no encontrado.</div>;

  const isSeller = user?.uid === deal.sellerId;
  const isBuyer = user?.uid === deal.buyerId;
  const shareUrl = `${window.location.origin}/pay/${deal.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Link copiado al portapapeles');
  };

  const updateStatus = async (status: Deal['status'], extraData: any = {}) => {
    if (!id) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'deals', id), { 
        status, 
        ...extraData,
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShipped = async () => {
    if (!shippingFile) {
      alert('Por favor selecciona una foto o video del comprobante de envío.');
      return;
    }
    // Simulation
    await updateStatus('SHIPPED', { shippingProofUrl: 'SIMULATED_URL' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Main Content Side */}
        <div className="md:col-span-8 space-y-8">
          <div className="bg-white p-10 rounded-4xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50/50 rounded-bl-full -mr-16 -mt-16" />
            
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest mb-4 border border-indigo-100">
                  <ShieldCheck className="w-3 h-3" /> Detalle del Trato
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">{deal.productName}</h1>
                <p className="text-slate-500 font-medium mt-3 leading-relaxed max-w-lg">{deal.productDescription}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">ID de Seguimiento: #TS-{deal.id.slice(0,8).toUpperCase()}</p>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-3xl shrink-0 text-center md:text-right min-w-[200px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Monto del Producto</p>
                <p className="text-4xl font-black">S/ {deal.price.toFixed(2)}</p>
                <div className="mt-4 pt-4 border-t border-slate-800 text-left">
                   <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Resumen Liquidación</p>
                   <div className="space-y-1.5">
                     <div className="flex justify-between text-[10px] items-center">
                        <span className="text-slate-400">Total Comprador:</span>
                        <span className="font-black text-indigo-400">
                          S/ {(deal.commissionPayer === 'buyer' ? deal.price + deal.commission : deal.commissionPayer === 'split' ? deal.price + deal.commission/2 : deal.price).toFixed(2)}
                        </span>
                     </div>
                     <div className="flex justify-between text-[10px] items-center">
                        <span className="text-slate-400">Neto Vendedor:</span>
                        <span className="font-black text-emerald-400">
                          S/ {(deal.commissionPayer === 'seller' ? deal.price - deal.commission : deal.commissionPayer === 'split' ? deal.price - deal.commission/2 : deal.price).toFixed(2)}
                        </span>
                     </div>
                   </div>
                </div>
              </div>
            </div>

            {deal.status === 'PENDING_PAYMENT' && isSeller && (
              <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-100">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <ExternalLink className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg">Comparte este link de cobro</h4>
                    <p className="text-indigo-100 text-xs opacity-80">El comprador podrá pagar de forma segura sin descargar la app.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                  <input readOnly value={shareUrl} className="flex-1 text-xs font-mono text-indigo-100 bg-transparent outline-none truncate" />
                  <button onClick={copyToClipboard} className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-xs font-black shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
                    <Copy className="w-4 h-4" /> Copiar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline Card */}
          <div className="bg-white p-10 rounded-4xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-10">
               <h3 className="font-black text-2xl text-slate-900 tracking-tight">Progreso del Trato</h3>
               <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border", getStatusColor(deal.status))}>
                   {getStatusLabel(deal.status)}
               </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-8 relative px-4">
              <div className="hidden md:block absolute left-14 right-14 top-9 h-0.5 bg-slate-100 -z-0" />
              
              <StepLarge 
                icon={<Wallet />} 
                title="Depósito" 
                completed={['FUNDS_SECURED', 'SHIPPED', 'COMPLETED'].includes(deal.status)}
                active={deal.status === 'PENDING_PAYMENT'}
              />

              <StepLarge 
                icon={<Truck />} 
                title="En Envío" 
                completed={['SHIPPED', 'COMPLETED'].includes(deal.status)}
                active={deal.status === 'FUNDS_SECURED'}
              />

              <StepLarge 
                icon={<CheckCircle2 />} 
                title="Recepción" 
                completed={deal.status === 'COMPLETED'}
                active={deal.status === 'SHIPPED'}
              />
              
              <StepLarge 
                icon={<ShieldCheck />} 
                title="Liberación" 
                completed={deal.status === 'COMPLETED'}
                active={false}
              />
            </div>

            <div className="mt-12 pt-8 border-t border-slate-50 flex flex-col items-center">
              {isSeller && deal.status === 'FUNDS_SECURED' && (
                <div className="w-full max-w-lg space-y-4">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Evidencia de Envío</h4>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-300 transition-all cursor-pointer relative group">
                      <input 
                        type="file" 
                        onChange={(e) => setShippingFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />
                      {shippingFile ? (
                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5" /> {shippingFile.name}
                        </div>
                      ) : (
                        <>
                          <Plus className="w-6 h-6 text-slate-300 mx-auto mb-1 group-hover:text-indigo-400" />
                          <p className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 uppercase tracking-widest">Subir Foto/Video del Envío</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button 
                    disabled={isUpdating}
                    onClick={handleShipped}
                    className="w-full bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {isUpdating ? 'Actualizando...' : (
                      <>
                        <Package className="w-6 h-6" /> Confirmar Envío
                      </>
                    )}
                  </button>
                </div>
              )}
              {isBuyer && deal.status === 'SHIPPED' && (
                <div className="w-full max-w-lg space-y-6 flex flex-col items-center">
                  {deal.shippingProofUrl && (
                    <div className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Evidencia enviada por el vendedor</p>
                      <button className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
                        <Truck className="w-4 h-4" /> Ver Comprobante de Envío
                      </button>
                    </div>
                  )}
                  <button 
                    disabled={isUpdating}
                    onClick={() => updateStatus('COMPLETED')}
                    className="w-full bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
                  >
                    <CheckCircle2 className="w-6 h-6" /> Recibido Conforme
                  </button>
                </div>
              )}
              {deal.status === 'COMPLETED' && (
                <div className="flex flex-col items-center gap-3 text-emerald-600">
                   <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8" />
                   </div>
                   <p className="font-black text-xl">Trato Finalizado con Éxito</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="md:col-span-4 space-y-6">
          <div className="bg-slate-900 text-white p-10 rounded-4xl shadow-xl border border-slate-800">
             <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                   <AlertCircle className="w-7 h-7" />
                </div>
                <div>
                   <h4 className="font-black text-lg">Estado</h4>
                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{getStatusLabel(deal.status)}</p>
                </div>
             </div>
             <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
                {deal.status === 'PENDING_PAYMENT' ? 'Esperando confirmación del pago en nuestra cuenta fiduciaria para activar el envío.' :
                deal.status === 'FUNDS_SECURED' ? 'Dinero verificado y bajo custodia. El vendedor puede proceder con el despacho.' :
                deal.status === 'SHIPPED' ? 'El producto está en tránsito hacia el destino final.' :
                'El dinero ha sido liberado al vendedor satisfactoriamente.'}
             </p>
             <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-700"
                  style={{ width: deal.status === 'PENDING_PAYMENT' ? '25%' : deal.status === 'FUNDS_SECURED' ? '50%' : deal.status === 'SHIPPED' ? '75%' : '100%' }}
                />
             </div>
          </div>

          <div className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm">
             <h5 className="font-black text-slate-900 mb-4 tracking-tight">Centro de Ayuda</h5>
             <div className="space-y-4">
                <button className="w-full p-4 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-between hover:bg-slate-100 transition-all">
                   ¿Cómo cancelar? <ArrowRight className="w-4 h-4 opacity-30" />
                </button>
                <button className="w-full p-4 rounded-2xl bg-rose-50 text-rose-600 text-xs font-bold flex items-center justify-between hover:bg-rose-100 transition-all">
                   Cuestionar / Disputar <AlertCircle className="w-4 h-4 opacity-30" />
                </button>
             </div>
          </div>

          <a 
            href={`https://wa.me/51969008815?text=Hola,%20necesito%20ayuda%20con%20el%20trato%20${deal.id}`}
            target="_blank"
            rel="noreferrer"
            className="group block"
          >
            <div className="bg-indigo-50 p-8 rounded-4xl border border-indigo-100 flex items-center gap-4 hover:bg-indigo-100 transition-all cursor-pointer">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
                  <ExternalLink className="w-6 h-6" />
               </div>
               <div>
                  <p className="font-black text-indigo-900 text-sm">Soporte Humano</p>
                  <div className="text-indigo-700/60 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    WhatsApp: 969008815
                  </div>
               </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

const StepLarge = ({ icon, title, completed, active }: any) => (
  <div className={cn("flex flex-col items-center gap-3 relative z-10", !completed && !active && "opacity-30")}>
    <div className={cn(
      "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md",
      completed ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200" : "bg-white border-2 border-slate-100 text-slate-300"
    )}>
      {completed ? <CheckCircle2 className="w-7 h-7" /> : React.cloneElement(icon, { className: "w-6 h-6" })}
    </div>
    <span className={cn("text-[10px] font-black uppercase tracking-widest text-center", active ? "text-indigo-700" : "text-slate-400")}>
      {title}
    </span>
  </div>
);

const Step = ({ icon, title, desc, completed, active, action }: any) => (
  <div className={cn("flex gap-6 relative transition-all", !completed && !active && "opacity-40 grayscale")}>
    <div className={cn(
      "w-12 h-12 rounded-full flex items-center justify-center shrink-0 z-10 transition-all shadow-md",
      completed ? "bg-green-600 text-white" : active ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-200" : "bg-white border-2 border-gray-100 text-gray-300"
    )}>
      {completed ? <CheckCircle2 className="w-6 h-6" /> : React.cloneElement(icon, { className: "w-5 h-5" })}
    </div>
    <div>
      <h4 className="font-bold text-gray-900">{title}</h4>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
      {action}
    </div>
  </div>
);

const PublicPay = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStep, setPaymentStep] = useState(1); // 1: Details, 2: Upload Proof
  const [opNumber, setOpNumber] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchDeal = async () => {
      const docSnap = await getDoc(doc(db, 'deals', id));
      if (docSnap.exists()) {
        setDeal({ id: docSnap.id, ...docSnap.data() } as Deal);
      }
      setLoading(false);
    };
    fetchDeal();
  }, [id]);

  const handleSimulatePayment = async () => {
    if (!user || !id || !opNumber) {
       if (!user) signInWithPopup(auth, new GoogleAuthProvider());
       return;
    }
    
    setIsUploading(true);
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));

    try {
      await updateDoc(doc(db, 'deals', id), {
        buyerId: user.uid,
        status: 'FUNDS_SECURED',
        paymentProofUrl: `OP-${opNumber}`,
        updatedAt: serverTimestamp(),
      });
      navigate(`/deal/${id}`);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="p-10 text-center">Cargando pago...</div>;
  if (!deal) return <div className="p-10 text-center">Trato no válido.</div>;
  if (deal.status !== 'PENDING_PAYMENT') return <Navigate to={`/deal/${id}`} />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full bg-white p-12 rounded-4xl border border-slate-200 shadow-2xl shadow-indigo-100/50 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
        
        <div className="w-24 h-24 rounded-4xl bg-indigo-50 flex items-center justify-center mx-auto mb-8 shadow-sm">
          <ShieldCheck className="w-12 h-12 text-indigo-600" />
        </div>
        
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest mb-6 border border-indigo-100">
            Checkout Seguro
        </div>
        
        <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">Pagar: {deal.productName}</h1>
        
        {paymentStep === 1 ? (
          <>
            <p className="text-slate-500 font-medium mb-10 max-w-sm mx-auto leading-relaxed">Transacción protegida por TratoSeguro. Tu dinero será retenido hasta que recibas conforme.</p>
            
            <div className="bg-slate-900 text-white p-8 rounded-3xl mb-10 flex flex-col items-center gap-2">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar (Incluye comisión si aplica)</p>
              <p className="text-5xl font-black">
                S/ {(deal.commissionPayer === 'buyer' 
                  ? deal.price + deal.commission 
                  : deal.commissionPayer === 'split' 
                    ? deal.price + (deal.commission / 2) 
                    : deal.price).toFixed(2)}
              </p>
              {deal.commissionPayer !== 'seller' && (
                <p className="text-[10px] text-indigo-400 font-bold uppercase">Incluye comisión del servicio</p>
              )}
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl mb-8 text-left">
              <h4 className="text-indigo-900 font-black text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4" /> Datos de Pago
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between group">
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Yape o Plin</p>
                    <p className="text-sm font-black text-indigo-900 tracking-tight">969 008 815</p>
                    <p className="text-[10px] font-medium text-indigo-600/70">A nombre de: Jairo Perez</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText('969008815'); alert('Copiado'); }} className="p-2 bg-white rounded-lg border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-px bg-indigo-100/50" />
                <div className="flex items-center justify-between group">
                  <div>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Cuenta BCP (Soles)</p>
                    <p className="text-sm font-black text-indigo-900 tracking-tight">36506446309070</p>
                    <p className="text-[10px] font-medium text-indigo-600/70">A nombre de: Jairo Perez</p>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText('36506446309070'); alert('Copiado'); }} className="p-2 bg-white rounded-lg border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => user ? setPaymentStep(2) : signInWithPopup(auth, new GoogleAuthProvider())}
              className="w-full bg-indigo-600 text-white py-6 rounded-3xl text-xl font-black hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              <Wallet className="w-7 h-7" /> 
              {user ? 'He realizado el pago' : 'Identificate para Pagar'}
            </button>
          </>
        ) : (
          <div className="text-left space-y-6">
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 mb-6">
              <h4 className="text-amber-900 font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Confirmar Transferencia
              </h4>
              <p className="text-amber-700 text-xs font-medium">Sube tu comprobante y el número de operación para validar tu depósito.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Número de Operación</label>
                <div className="group relative">
                  <AlertCircle className="w-4 h-4 text-slate-300 cursor-help" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                    Este es el código de seguimiento que aparece en tu voucher de Yape, Plin o banca móvil del banco.
                  </div>
                </div>
              </div>
              <input 
                type="text" 
                value={opNumber}
                onChange={(e) => setOpNumber(e.target.value)}
                className="w-full p-4 rounded-xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold"
                placeholder="Ej: 9844210"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Foto del Comprobante</label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-indigo-300 transition-all cursor-pointer bg-slate-50 relative overflow-hidden group">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" />
                <Plus className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-indigo-400" />
                <p className="text-xs font-bold text-slate-400 group-hover:text-indigo-500 uppercase tracking-widest">Seleccionar Archivo</p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setPaymentStep(1)}
                className="px-6 py-4 rounded-2xl border border-slate-200 font-bold text-slate-400 hover:bg-slate-50 transition-all"
              >
                Atrás
              </button>
              <button 
                disabled={!opNumber || isUploading}
                onClick={handleSimulatePayment}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl text-lg font-black hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {isUploading ? 'Procesando...' : 'Confirmar Pago'}
                {!isUploading && <CheckCircle2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
        
        <div className="mt-10 flex items-center justify-center gap-8 opacity-40 grayscale group-hover:grayscale-0 transition-all">
           <img src="https://upload.wikimedia.org/wikipedia/commons/d/d7/Visa_Logo.png" alt="Visa" className="h-4 object-contain" />
           <img src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg" alt="Mastercard" className="h-6 object-contain" />
           <img src="https://www.niubiz.com.pe/wp-content/uploads/2023/04/Niubiz-color.png" alt="Niubiz" className="h-5 object-contain" />
        </div>
      </motion.div>
      <p className="mt-8 text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" /> Procesado por TratoSeguro S.A.C.
      </p>
    </div>
  );
};

const AdminDashboard = ({ deals }: { deals: Deal[] }) => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Withdrawal)));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const totalCommissions = deals.reduce((acc, d) => {
    if (d.status === 'COMPLETED') return acc + d.commission;
    return acc;
  }, 0);

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');

  const completeWithdrawal = async (id: string) => {
    try {
      await updateDoc(doc(db, 'withdrawals', id), { status: 'COMPLETED' });
      alert('Retiro marcado como completado.');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <main className="grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-4 space-y-6">
        <div className="bg-indigo-600 text-white rounded-4xl p-8 flex flex-col justify-between shadow-xl shadow-indigo-100 min-h-[220px]">
          <div>
            <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-widest mb-2">Comisiones Totales Ganadas</p>
            <h3 className="text-5xl font-black">S/ {totalCommissions.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
            <p className="text-[10px] text-indigo-100 opacity-80 uppercase font-black tracking-widest">Tus Ganancias (2%)</p>
            <button 
              onClick={() => alert(`Simulación: Retiro de S/${totalCommissions.toFixed(2)} hacia tu cuenta Yape / BCP iniciado.`)}
              className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-md active:scale-95"
            >
              Retirar
            </button>
          </div>
        </div>

        <div className="bg-white rounded-4xl border border-slate-200 p-8 shadow-sm">
          <h4 className="font-black text-sm mb-4 tracking-tight uppercase text-slate-400">Tus Cuentas de Recaudo</h4>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Yape / Plin</p>
              <p className="text-sm font-bold text-slate-900">969 008 815</p>
              <p className="text-[10px] text-slate-500">Jairo Perez</p>
            </div>
            <div className="h-px bg-slate-100" />
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">BCP Soles</p>
              <p className="text-sm font-bold text-slate-900">36506446309070</p>
              <p className="text-[10px] text-slate-500">Jairo Perez</p>
            </div>
          </div>
        </div>
      </div>

      <div className="md:col-span-8 bg-white rounded-4xl border border-slate-200 p-8 shadow-sm">
        <h4 className="font-black text-xl mb-6 tracking-tight">Solicitudes de Retiro de Vendedores</h4>
        <div className="space-y-4">
          {loading ? (
            <p className="text-slate-400">Cargando solicitudes...</p>
          ) : pendingWithdrawals.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
              <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 font-bold text-sm">No hay retiros pendientes.</p>
            </div>
          ) : (
            pendingWithdrawals.map(w => (
              <div key={w.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino {w.method}</span>
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[8px] font-black rounded uppercase">
                      {w.method}
                    </span>
                  </div>
                  <p className="text-lg font-mono font-bold text-slate-900">{w.details}</p>
                  <p className="text-xs text-slate-500 mt-1">Monto a depositar: <span className="font-bold text-indigo-600">S/ {w.amount.toFixed(2)}</span></p>
                </div>
                <button 
                  onClick={() => completeWithdrawal(w.id)}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Confirmar Depósito
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
};

export default function App() {
  return (
    <Router>
      <FirebaseProvider>
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-indigo-100">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create" element={<CreateDeal />} />
            <Route path="/deal/:id" element={<DealDetails />} />
            <Route path="/pay/:id" element={<PublicPay />} />
          </Routes>
          
          <footer className="mt-20 border-t border-gray-100 py-10 px-4">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2 font-bold text-gray-400">
                <ShieldCheck className="w-5 h-5" />
                TratoSeguro &copy; 2026
              </div>
              <div className="flex gap-8 text-sm font-medium text-gray-400">
                <Link to="#" className="hover:text-indigo-600 transition-colors">Términos</Link>
                <Link to="#" className="hover:text-indigo-600 transition-colors">Privacidad</Link>
                <a href="https://wa.me/51969008815" target="_blank" rel="noreferrer" className="hover:text-emerald-600 transition-colors flex items-center gap-1">
                  Soporte WhatsApp
                </a>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Lima, Perú</span>
              </div>
            </div>
          </footer>

          {/* Floating WhatsApp Support Button */}
          <a 
            href="https://wa.me/51969008815" 
            target="_blank" 
            rel="noreferrer"
            className="fixed bottom-8 right-8 bg-emerald-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-[100] flex items-center justify-center group"
          >
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          </a>
        </div>
      </FirebaseProvider>
    </Router>
  );
}
