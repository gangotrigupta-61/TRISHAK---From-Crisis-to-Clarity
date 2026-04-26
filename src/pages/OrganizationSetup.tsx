import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Hospital, 
  Hotel, 
  Utensils, 
  MapPin, 
  Building2, 
  ArrowRight, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Navigation
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { OrganizationType } from '../types';
import { cn } from '../lib/utils';

export default function OrganizationSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    type: '' as OrganizationType | '',
    name: '',
    orgId: '',
    address: '',
    lat: 0,
    lng: 0
  });

  const handleNext = () => {
    if (step === 1 && !formData.type) return;
    if (step === 2 && (!formData.name || !formData.orgId)) return;
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const detectLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            // Reverse geocoding using Nominatim (free)
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await response.json();
            setFormData(prev => ({
              ...prev,
              lat: latitude,
              lng: longitude,
              address: data.display_name || `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
            }));
          } catch (err) {
            setFormData(prev => ({
              ...prev,
              lat: latitude,
              lng: longitude,
              address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
            }));
          } finally {
            setLoading(false);
          }
        },
        () => {
          setLoading(false);
          setError('Could not detect location. Please enter manually.');
        }
      );
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);

    try {
      const orgRef = doc(db, 'organizations', formData.orgId);
      await setDoc(orgRef, {
        orgId: formData.orgId,
        name: formData.name,
        type: formData.type,
        location: {
          lat: formData.lat,
          lng: formData.lng,
          address: formData.address
        },
        adminId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update user profile with organizationId
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        organizationId: formData.orgId,
        updatedAt: serverTimestamp()
      });

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to setup organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'hospital', label: 'Hospital', icon: Hospital, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'hotel', label: 'Hotel', icon: Hotel, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'restaurant', label: 'Restaurant', icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center transition-colors">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-3xl shadow-xl shadow-blue-500/20 mb-6">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-text-primary mb-2 tracking-tight transition-colors">Setup Organization</h1>
          <p className="text-text-secondary font-medium transition-colors">Complete your organization profile to get started.</p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8 px-4 transition-colors">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500",
                step >= s ? "bg-blue-600" : "bg-bg-secondary border border-card-border"
              )}
            />
          ))}
        </div>

        <div className="bg-bg-secondary rounded-[2.5rem] p-8 shadow-2xl shadow-black/5 border border-card-border relative overflow-hidden transition-colors">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-text-primary mb-1 transition-colors">Organization Type</h2>
                  <p className="text-sm text-text-secondary font-medium transition-colors">What kind of organization are you managing?</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {types.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFormData({ ...formData, type: t.id as OrganizationType })}
                      className={cn(
                        "flex items-center gap-4 p-6 rounded-3xl border-2 transition-all text-left group",
                        formData.type === t.id 
                          ? "border-blue-600 bg-blue-600/5 shadow-lg shadow-blue-500/10" 
                          : "border-card-border bg-bg-primary/50 hover:border-text-secondary/30 hover:bg-bg-primary"
                      )}
                    >
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm", t.bg.replace('bg-', 'bg-opacity-20 bg-'))}>
                        <t.icon className={cn("w-7 h-7", t.color)} />
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-text-primary transition-colors">{t.label}</p>
                        <p className="text-xs text-text-secondary font-bold uppercase tracking-widest opacity-60">Select this type</p>
                      </div>
                      {formData.type === t.id && <CheckCircle className="w-6 h-6 text-blue-600" />}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  disabled={!formData.type}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-3xl shadow-xl transition-all flex items-center justify-center gap-2 group"
                >
                  CONTINUE <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-text-primary mb-1 transition-colors">Basic Details</h2>
                  <p className="text-sm text-text-secondary font-medium transition-colors">Enter your organization's identity.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-text-secondary uppercase tracking-widest px-1 opacity-60">Organization Name</label>
                    <input
                      type="text"
                      placeholder="e.g. City General Hospital"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-bg-primary border-2 border-card-border rounded-2xl p-4 font-bold focus:border-blue-600 focus:outline-none transition-all text-text-primary placeholder:text-text-secondary/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-text-secondary uppercase tracking-widest px-1 opacity-60">Organization ID</label>
                    <input
                      type="text"
                      placeholder="e.g. HOSP-001"
                      value={formData.orgId}
                      onChange={(e) => setFormData({ ...formData, orgId: e.target.value.toUpperCase() })}
                      className="w-full bg-bg-primary border-2 border-card-border rounded-2xl p-4 font-bold focus:border-blue-600 focus:outline-none transition-all text-text-primary placeholder:text-text-secondary/30"
                    />
                    <p className="text-[10px] text-text-secondary font-bold px-1 opacity-40 uppercase tracking-tight">This ID will be used for all future records.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 bg-bg-primary hover:bg-bg-secondary text-text-secondary font-black py-5 rounded-3xl transition-all border border-card-border"
                  >
                    BACK
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!formData.name || !formData.orgId}
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-3xl shadow-xl transition-all flex items-center justify-center gap-2 group"
                  >
                    CONTINUE <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-black text-text-primary mb-1 transition-colors">Set Location</h2>
                  <p className="text-sm text-text-secondary font-medium transition-colors">Where is your organization located?</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-bg-primary border-2 border-card-border rounded-[2rem] p-6 relative overflow-hidden min-h-[200px] flex flex-col items-center justify-center text-center transition-colors">
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                      <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-600 via-transparent to-transparent" />
                    </div>
                    
                    <MapPin className="w-12 h-12 text-blue-600 mb-4 animate-bounce" />
                    
                    {formData.lat !== 0 && (
                      <div className="w-full h-48 rounded-2xl overflow-hidden mb-4 border-2 border-card-border shadow-inner relative z-10">
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          title="Organization Location"
                          src={`https://maps.google.com/maps?q=${formData.lat},${formData.lng}&z=15&output=embed`}
                          className="invert-0 dark:invert dark:grayscale dark:brightness-75 transition-all duration-700"
                        />
                      </div>
                    )}

                    {formData.lat !== 0 ? (
                      <div className="space-y-2 relative z-10">
                        <p className="text-sm font-black text-text-primary transition-colors">Location Set</p>
                        <p className="text-xs text-text-secondary font-medium transition-colors">{formData.address}</p>
                        <button 
                          onClick={detectLocation}
                          className="text-xs font-black text-blue-600 hover:underline"
                        >
                          RE-DETECT LOCATION
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 relative z-10">
                        <p className="text-sm text-text-secondary font-medium px-8 transition-colors">Click below to detect your current location or enter address manually.</p>
                        <button 
                          onClick={detectLocation}
                          className="bg-bg-secondary border-2 border-card-border hover:border-blue-600 hover:text-blue-600 text-text-secondary font-black py-3 px-6 rounded-2xl transition-all flex items-center gap-2 mx-auto shadow-sm"
                        >
                          <Navigation className="w-4 h-4" /> DETECT LOCATION
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-text-secondary uppercase tracking-widest px-1 opacity-60">Full Address</label>
                    <textarea
                      placeholder="Enter the complete physical address..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-bg-primary border-2 border-card-border rounded-2xl p-4 font-bold focus:border-blue-600 focus:outline-none transition-all min-h-[100px] text-text-primary placeholder:text-text-secondary/30"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 transition-colors">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-xs font-bold">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 bg-bg-primary hover:bg-bg-secondary text-text-secondary font-black py-5 rounded-3xl transition-all border border-card-border"
                  >
                    BACK
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !formData.address}
                    className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>FINISH SETUP <CheckCircle className="w-5 h-5 transition-transform group-hover:scale-110" /></>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
