import React, { useState } from 'react';
import { UserCheck, Sparkles, AlertCircle, ArrowRight, ShieldCheck, Camera, Globe, Phone, FileText } from 'lucide-react';
import LocationSelector, { LocationData } from '../common/LocationSelector';
import AvatarUploadMenu from './AvatarUploadMenu';
import { dbService, LocalProfile } from '../../lib/supabase';
import OpenCommAnimatedLoader from '../common/OpenCommAnimatedLoader';

interface CompleteProfilePageProps {
  user: any;
  profile: LocalProfile | null;
  onCompleteSuccess: (updatedProfile: LocalProfile) => void;
  triggerToast?: (msg: string) => void;
}

export default function CompleteProfilePage({
  user,
  profile,
  onCompleteSuccess,
  triggerToast
}: CompleteProfilePageProps) {
  const defaultName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const [fullName, setFullName] = useState(defaultName);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  
  const [locationData, setLocationData] = useState<LocationData>({
    city: profile?.city || '',
    state: profile?.state || '',
    country: profile?.country || 'India',
    country_code: profile?.country_code || 'IN',
    state_code: profile?.state_code || '',
    district: profile?.district || '',
    latitude: profile?.latitude,
    longitude: profile?.longitude,
    is_valid: Boolean(profile?.country && profile?.latitude && profile?.longitude)
  });

  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language || 'English');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      const err = 'Full name is required to complete your profile.';
      setErrorMsg(err);
      if (triggerToast) triggerToast(err);
      return;
    }

    if (!locationData.country || !locationData.latitude || !locationData.longitude) {
      const err = 'Location with valid coordinates is required.';
      setErrorMsg(err);
      if (triggerToast) triggerToast(err);
      return;
    }

    const hasCity = Boolean(locationData.city && locationData.city.trim());
    const hasStateDistrict = Boolean(
      locationData.state && locationData.state.trim() && locationData.district && locationData.district.trim()
    );

    if (!hasCity && !hasStateDistrict) {
      const err = 'Please select a complete location (City or State + District).';
      setErrorMsg(err);
      if (triggerToast) triggerToast(err);
      return;
    }

    setIsSubmitting(true);

    try {
      const userId = user?.id || profile?.id;
      if (!userId) {
        throw new Error('Authentication session expired. Please sign in again.');
      }

      const updated = await dbService.updateProfile(userId, {
        full_name: trimmedName,
        city: locationData.city || '',
        state: locationData.state || '',
        country: locationData.country || 'India',
        country_code: locationData.country_code || 'IN',
        state_code: locationData.state_code || '',
        district: locationData.district || '',
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        preferred_language: preferredLanguage.trim() || 'English',
        bio: bio.trim() || undefined,
        onboarding_completed: true
      });

      if (!updated || updated.onboarding_completed !== true) {
        throw new Error('Database rejected profile completion. Please ensure all required fields are valid.');
      }

      if (triggerToast) triggerToast('Profile completed successfully!');
      onCompleteSuccess(updated);
    } catch (err: any) {
      console.error('[CompleteProfile] Submission error:', err);
      const msg = err.message || 'Failed to complete profile. Please try again.';
      setErrorMsg(msg);
      if (triggerToast) triggerToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1020] text-slate-900 dark:text-white flex items-center justify-center p-4 sm:p-6 text-left">
      <div className="w-full max-w-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#273449] rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 relative overflow-hidden">
        
        {/* Header Title */}
        <div className="space-y-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/10 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Core Profile Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white">
            Complete Your Basic Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Provide your basic account information to activate your OpenComm account.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl flex items-start space-x-3 text-red-700 dark:text-red-300 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Avatar Upload (Optional) & Full Name (Required) */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-4 bg-slate-50/60 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl">
            <div className="shrink-0 flex flex-col items-center space-y-1.5">
              <div className="relative group cursor-pointer" onClick={() => setIsAvatarMenuOpen(true)}>
                <img
                  src={avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/30 group-hover:opacity-80 transition-opacity"
                />
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <AvatarUploadMenu
                isOpen={isAvatarMenuOpen}
                onClose={() => setIsAvatarMenuOpen(false)}
                userId={user?.id || ''}
                onSuccess={(newUrl) => {
                  if (newUrl) setAvatarUrl(newUrl);
                  setIsAvatarMenuOpen(false);
                }}
                onError={(err) => {
                  if (triggerToast) triggerToast(err);
                }}
                currentAvatarUrl={avatarUrl}
              />
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Photo (Optional)
              </span>
            </div>

            <div className="w-full space-y-1">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full legal name"
                required
                className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-hidden"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                This name will be displayed on your account.
              </p>
            </div>
          </div>

          {/* Location Selector (REQUIRED) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Location <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Mandatory
              </span>
            </div>
            <LocationSelector
              value={locationData}
              onChange={(data) => setLocationData(data)}
              label="Your Primary Location"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              We use location to match relevant opportunities and local marketplace activity.
            </p>
          </div>

          {/* Optional Fields Section */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Optional Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Phone (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Phone Number</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden"
                />
              </div>

              {/* Language (Optional) */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Preferred Language</span>
                </label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden cursor-pointer"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Bengali">Bengali (বাংলা)</option>
                  <option value="Telugu">Telugu (తెలుగు)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                  <option value="Urdu">Urdu (اردو)</option>
                  <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                  <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                  <option value="Malayalam">Malayalam (മലയാളം)</option>
                  <option value="Punjabi">Punjabi (ਪੰਜਾਬੀ)</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                </select>
              </div>

            </div>

            {/* Short Bio (Optional) */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Short Bio</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell us a little bit about yourself or your organization..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden resize-none"
              />
            </div>

          </div>

          {/* Submit Action Button */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg cursor-pointer flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <OpenCommAnimatedLoader size="sm" />
              ) : (
                <>
                  <span>Complete Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
