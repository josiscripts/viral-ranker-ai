import React, { useState } from 'react';
import { 
  User, 
  Sparkles, 
  Check, 
  Edit3, 
  Flame, 
  Youtube, 
  Instagram, 
  Eye, 
  Award, 
  Sliders, 
  Palette, 
  CheckCircle2, 
  Camera, 
  Smartphone,
  ChevronRight,
  TrendingUp,
  Clock,
  Video,
  FileVideo,
  Save,
  CheckSquare,
  Languages
} from 'lucide-react';
import { UserProfile } from './types';
import { translations } from './translations';

// Pre-configured avatar choices for futuristic creators
const AVATAR_OPTIONS = [
  { id: 'neon_hustler', name: 'Neon Hustler', emoji: '⚡', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-500/10' },
  { id: 'retro_gamer', name: 'Retro Gamer', emoji: '👾', color: 'from-purple-500 to-pink-500', bg: 'bg-purple-500/10' },
  { id: 'synthwave_girl', name: 'Synthwave DJ', emoji: '🎧', color: 'from-rose-500 to-orange-500', bg: 'bg-rose-500/10' },
  { id: 'ai_virtuoso', name: 'AI Director', emoji: '🤖', color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500/10' }
];

const ACCENT_COLOR_PALETTE = [
  { name: 'Cyber Cyan', value: 'text-cyan-400', hex: '#22d3ee', bg: 'bg-cyan-500' },
  { name: 'Electric Violet', value: 'text-violet-400', hex: '#a78bfa', bg: 'bg-violet-500' },
  { name: 'Neon Green', value: 'text-green-400', hex: '#4ade80', bg: 'bg-green-500' },
  { name: 'Hot Pink', value: 'text-pink-400', hex: '#f472b6', bg: 'bg-pink-500' },
  { name: 'Solar Orange', value: 'text-orange-400', hex: '#fb923c', bg: 'bg-orange-500' }
];

const STYLE_PRESET_OPTIONS = [
  { id: 'BLUE_BOX', name: 'Blue Box' },
  { id: 'RANDOM_COLOR', name: 'Random Color' },
  { id: 'GLOW', name: 'Glow Preset' },
  { id: 'RETRO', name: 'Retro Yellow' },
  { id: 'QUICK', name: 'Quick Red' },
  { id: 'MINIMAL', name: 'Minimal White' },
];

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  isDarkMode: boolean;
  projectsCount: number;
  lang: 'en' | 'es';
  onLanguageChange: (lang: 'en' | 'es') => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
  profile, 
  onUpdateProfile, 
  isDarkMode, 
  projectsCount, 
  lang, 
  onLanguageChange 
}) => {
  const t = translations[lang];
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(profile.name);
  const [tempHandle, setTempHandle] = useState(profile.handle);
  const [tempBio, setTempBio] = useState(profile.bio);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const handleSaveProfile = () => {
    onUpdateProfile({
      name: tempName || 'Anonymous Creator',
      handle: tempHandle.startsWith('@') ? tempHandle : `@${tempHandle || 'creator'}`,
      bio: tempBio,
    });
    setIsEditing(false);
  };

  const selectedAvatar = AVATAR_OPTIONS.find(a => a.id === profile.avatarUrl) || AVATAR_OPTIONS[0];

  return (
    <div className="flex-1 p-6 lg:p-10 space-y-10 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
      
      {/* Header section */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-500">
          <Award size={14} />
          <span>{t.creatorHub}</span>
        </div>
        <h1 className={`text-4xl lg:text-5xl font-black tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {lang === 'es' ? <>Espacio del <span className="text-blue-500">Creador</span></> : <>Creator <span className="text-blue-500">Workspace</span></>}
        </h1>
        <p className={`text-sm lg:text-base font-semibold ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
          {t.creatorWorkspaceDesc}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Creator Identity Card & Avatar Choice */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Identity Bento Card */}
          <div className={`p-8 rounded-[40px] border relative overflow-hidden transition-all duration-300 ${isDarkMode ? 'bg-[#111] border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[80px] -z-10 bg-gradient-to-br ${selectedAvatar.color} opacity-25`}></div>
            
            <div className="flex flex-col items-center text-center space-y-6">
              
              {/* Profile Image with Glow and Hover */}
              <div className="relative group">
                <div className={`w-28 h-28 rounded-[36px] bg-gradient-to-br ${selectedAvatar.color} p-1 shadow-2xl transition-transform duration-300 group-hover:scale-105`}>
                  <div className={`w-full h-full rounded-[32px] ${isDarkMode ? 'bg-neutral-900' : 'bg-gray-100'} flex items-center justify-center text-5xl relative`}>
                    <span>{selectedAvatar.emoji}</span>
                  </div>
                </div>
                
                {/* Edit avatar button overlays */}
                <button 
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className={`absolute -bottom-2 -right-2 p-2.5 rounded-2xl shadow-xl transition-all border ${isDarkMode ? 'bg-[#1a1a1a] hover:bg-[#222] border-white/10 text-white' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'}`}
                  title="Change creator avatar style"
                >
                  <Camera size={16} />
                </button>
              </div>

              {/* Avatar Selector Modal-like inline dropdown */}
              {showAvatarPicker && (
                <div className={`w-full p-4 rounded-3xl border animate-in zoom-in-95 duration-200 space-y-3 ${isDarkMode ? 'bg-neutral-900 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.selectAvatarVibe}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {AVATAR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          onUpdateProfile({ avatarUrl: opt.id });
                          setShowAvatarPicker(false);
                        }}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${profile.avatarUrl === opt.id ? 'border-blue-500 bg-blue-500/10' : (isDarkMode ? 'border-white/5 bg-[#151515] hover:bg-white/5' : 'border-gray-200 bg-white hover:bg-gray-100')}`}
                      >
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className="text-[9px] font-black uppercase tracking-tight text-center">{opt.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Identity Form (Reading vs Editing) */}
              {!isEditing ? (
                <div className="space-y-4 w-full">
                  <div className="space-y-1">
                    <h2 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{profile.name}</h2>
                    <p className="text-sm font-bold text-blue-500 tracking-tight">{profile.handle}</p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{profile.email}</p>
                  </div>
                  
                  <p className={`text-xs leading-relaxed font-semibold px-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    "{profile.bio || 'This creator hasn\'t written a bio yet.'}"
                  </p>

                  <div className="pt-4">
                    <button 
                      onClick={() => {
                        setTempName(profile.name);
                        setTempHandle(profile.handle);
                        setTempBio(profile.bio);
                        setIsEditing(true);
                      }}
                      className={`w-full py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 border-white/5 text-white' : 'bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-800'}`}
                    >
                      <Edit3 size={14} /> {t.editIdentity}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-left w-full">
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t.displayName}</label>
                    <input 
                      type="text" 
                      value={tempName} 
                      onChange={e => setTempName(e.target.value)}
                      className={`w-full border rounded-2xl px-4 py-3.5 text-xs font-bold transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'}`}
                      placeholder="e.g. Alex Rivera"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t.creatorHandle}</label>
                    <input 
                      type="text" 
                      value={tempHandle} 
                      onChange={e => setTempHandle(e.target.value)}
                      className={`w-full border rounded-2xl px-4 py-3.5 text-xs font-bold transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'}`}
                      placeholder="e.g. @your_handle"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t.creatorBio}</label>
                    <textarea 
                      value={tempBio} 
                      onChange={e => setTempBio(e.target.value)}
                      rows={3}
                      className={`w-full border rounded-2xl px-4 py-3 text-xs font-bold transition-colors resize-none ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-white focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500'}`}
                      placeholder="Write your viral creator bio..."
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center border ${isDarkMode ? 'border-white/5 hover:bg-white/5 text-gray-400' : 'border-gray-200 hover:bg-gray-100 text-gray-600'}`}
                    >
                      {t.cancel}
                    </button>
                    <button 
                      onClick={handleSaveProfile}
                      className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <Save size={12} /> {t.save}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Gamified Creator Achievements */}
          <div className={`p-8 rounded-[40px] border transition-all duration-300 ${isDarkMode ? 'bg-[#111] border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'}`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              <Award className="text-yellow-500 animate-bounce" size={16} /> {t.creatorMilestones}
            </h3>
            
            <div className="space-y-6">
              {/* Achievement 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.goingViral}</span>
                  <span className="text-blue-500 font-bold">1.2M / 1.0M</span>
                </div>
                <div className="h-2 w-full bg-blue-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: '100%' }}></div>
                </div>
                <span className="text-[10px] font-bold text-gray-500">{t.milestoneUnlocked}</span>
              </div>

              {/* Achievement 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.rankerExpert}</span>
                  <span className="text-violet-500 font-bold">{projectsCount} / 5</span>
                </div>
                <div className="h-2 w-full bg-violet-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-pink-400 rounded-full" style={{ width: `${Math.min((projectsCount / 5) * 100, 100)}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-gray-500">{t.createFiveProjects}</span>
              </div>

              {/* Achievement 3: Videos Created */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.videosCreated}</span>
                  <span className="text-amber-500 font-bold">{projectsCount}</span>
                </div>
                <div className="h-2 w-full bg-amber-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full" style={{ width: `${Math.min((projectsCount / 10) * 100, 100)}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-gray-500">{t.videosCreatedDesc}</span>
              </div>

              {/* Achievement 3 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.aiOverlord}</span>
                  <span className="text-green-500 font-bold">{profile.stats.aiGenerations} / 50</span>
                </div>
                <div className="h-2 w-full bg-green-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" style={{ width: `${(profile.stats.aiGenerations / 50) * 100}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-gray-500">{t.useAiScript}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Columns: Performance Metrics & Brand Preferences */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Creator Metrics Bento Box */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <MetricCard 
              icon={<FileVideo className="text-blue-500" size={24} />} 
              title={t.activeConcepts} 
              value={projectsCount} 
              desc={t.totalDraftBoards} 
              isDarkMode={isDarkMode} 
            />
            
            <MetricCard 
              icon={<Flame className="text-red-500" size={24} />} 
              title={t.clipsSaved} 
              value={profile.stats.exportedClips} 
              desc={t.readyForViral} 
              isDarkMode={isDarkMode} 
            />

            <MetricCard 
              icon={<Sparkles className="text-yellow-500 animate-pulse" size={24} />} 
              title={t.aiPrompts} 
              value={profile.stats.aiGenerations} 
              desc={t.geminiRankingCalls} 
              isDarkMode={isDarkMode} 
            />

            <MetricCard 
              icon={<Eye className="text-cyan-500" size={24} />} 
              title={t.estViewReach} 
              value={profile.stats.viewsGained} 
              desc={t.acrossChannels} 
              isDarkMode={isDarkMode} 
            />

          </div>

          {/* Preferences Bento Panel */}
          <div className={`p-8 rounded-[40px] border transition-all duration-300 ${isDarkMode ? 'bg-[#111] border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'}`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-8 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              <Sliders className="text-blue-500" size={16} /> {t.targetPlatform}
            </h3>

            <div className="space-y-8">
              
              {/* Preference: Language Selector */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.language}</label>
                  <span className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1">
                    <Languages size={10} /> {lang === 'es' ? 'Español' : 'English'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => onLanguageChange('en')}
                    className={`py-4 px-6 rounded-2xl border flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-tight transition-all active:scale-95 ${lang === 'en' ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-lg' : (isDarkMode ? 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100')}`}
                  >
                    <span>🇺🇸 {t.english}</span>
                    {lang === 'en' && <CheckCircle2 size={12} className="ml-auto text-blue-500" />}
                  </button>
                  <button
                    onClick={() => onLanguageChange('es')}
                    className={`py-4 px-6 rounded-2xl border flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-tight transition-all active:scale-95 ${lang === 'es' ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-lg' : (isDarkMode ? 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100')}`}
                  >
                    <span>🇪🇸 {t.spanish}</span>
                    {lang === 'es' && <CheckCircle2 size={12} className="ml-auto text-blue-500" />}
                  </button>
                </div>
              </div>

              {/* Preference: Default Target Platform */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.defaultViralTarget}</label>
                  <span className="text-[10px] font-black text-blue-500 uppercase">{t.optimizesLayouts}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'TikTok' as const, name: 'TikTok', icon: <Smartphone size={16} />, color: 'hover:border-neutral-500 hover:text-black hover:bg-neutral-500/10' },
                    { id: 'Reels' as const, name: 'Reels', icon: <Instagram size={16} />, color: 'hover:border-pink-500 hover:text-pink-500 hover:bg-pink-500/10' },
                    { id: 'Shorts' as const, name: 'Shorts', icon: <Youtube size={16} />, color: 'hover:border-red-500 hover:text-red-500 hover:bg-red-500/10' }
                  ].map((p) => {
                    const isSelected = profile.defaultPlatform === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => onUpdateProfile({ defaultPlatform: p.id })}
                        className={`py-4 px-6 rounded-2xl border flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-tight transition-all active:scale-95 ${isSelected ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-lg' : (isDarkMode ? 'border-white/5 bg-white/5 text-gray-400 ' + p.color : 'border-gray-200 bg-gray-50 text-gray-700 ' + p.color)}`}
                      >
                        {p.icon}
                        <span>{p.name}</span>
                        {isSelected && <CheckCircle2 size={12} className="ml-auto text-blue-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preference: Default Caption Font Style */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.defaultSubtitlePreset}</label>
                  <span className="text-[10px] font-black text-gray-500 uppercase">{t.presetStylingApplied}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {STYLE_PRESET_OPTIONS.map((style) => {
                    const isSelected = profile.defaultCaptionStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => onUpdateProfile({ defaultCaptionStyle: style.id })}
                        className={`p-3.5 rounded-2xl border text-[10px] font-black uppercase text-center tracking-wider transition-all active:scale-95 ${isSelected ? 'border-blue-500 bg-blue-500/10 text-blue-500' : (isDarkMode ? 'border-white/5 bg-white/5 text-gray-400 hover:bg-white/10' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100')}`}
                      >
                        {style.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preference: Brand Theme & Accent Color Palette */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{t.brandPaletteAccent}</label>
                  <span className="text-[10px] font-black text-gray-500 uppercase">{t.customDashboardColors}</span>
                </div>
                
                <div className="flex flex-wrap gap-4 p-4 rounded-2xl border transition-colors bg-opacity-30 backdrop-blur-md items-center justify-between ${isDarkMode ? 'bg-[#151515] border-white/5' : 'bg-gray-50 border-gray-200'}">
                  <div className="flex gap-3">
                    {ACCENT_COLOR_PALETTE.map((color) => {
                      const isSelected = profile.accentColor === color.value;
                      return (
                        <button
                          key={color.name}
                          onClick={() => onUpdateProfile({ accentColor: color.value })}
                          className={`w-10 h-10 rounded-xl transition-all relative border-2 ${color.bg} ${isSelected ? 'scale-110 border-blue-500 ring-2 ring-blue-500/30' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'}`}
                          title={color.name}
                        >
                          {isSelected && <Check size={18} className="absolute inset-0 m-auto text-white" />}
                        </button>
                      );
                    })}
                  </div>
                  <span className={`text-[10px] font-mono tracking-widest uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                    {t.activeColor}: <span className="text-blue-500 font-bold">{ACCENT_COLOR_PALETTE.find(c => c.value === profile.accentColor)?.name || 'Custom'}</span>
                  </span>
                </div>
              </div>

              {/* Preferences: Toggles (Uppercase Captions) */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className={`text-xs font-black uppercase tracking-wider transition-colors ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.autoUppercaseSubtitles}</span>
                    <p className={`text-[10px] font-medium leading-normal ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t.autoUppercaseDesc}</p>
                  </div>
                  <button 
                    onClick={() => onUpdateProfile({ autoUppercase: !profile.autoUppercase })} 
                    className={`w-12 h-7 rounded-full relative transition-all ${profile.autoUppercase ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : (isDarkMode ? 'bg-gray-800' : 'bg-gray-200')}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${profile.autoUppercase ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Creator Cheat Sheet */}
          <div className={`p-8 rounded-[40px] border transition-all duration-300 ${isDarkMode ? 'bg-[#111] border-white/5 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'}`}>
            <h3 className={`text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              <CheckSquare className="text-emerald-500" size={16} /> {t.viralChecklist}
            </h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">
              {t.viralChecklistDesc}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CheckListItem text={t.checklistHook} checked />
              <CheckListItem text={t.checklistPrimary} checked />
              <CheckListItem text={t.checklistShort} checked />
              <CheckListItem text={t.checklistSurprise} checked />
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

const MetricCard: React.FC<{ icon: React.ReactNode; title: string; value: string | number; desc: string; isDarkMode: boolean }> = ({ icon, title, value, desc, isDarkMode }) => (
  <div className={`p-6 rounded-[32px] border flex flex-col justify-between space-y-4 shadow-sm hover:scale-[1.02] transition-all ${isDarkMode ? 'bg-[#111] border-white/5 hover:border-blue-500/20' : 'bg-white border-gray-100 hover:shadow-lg'}`}>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>{icon}</div>
    <div className="space-y-1">
      <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{title}</span>
      <h4 className={`text-3xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{value}</h4>
    </div>
    <p className="text-[10px] font-semibold text-gray-500 leading-none">{desc}</p>
  </div>
);

const CheckListItem: React.FC<{ text: string; checked?: boolean }> = ({ text, checked }) => (
  <div className="flex items-center gap-3">
    <CheckCircle2 size={16} className={checked ? 'text-emerald-500' : 'text-gray-500'} />
    <span className="text-xs font-bold text-gray-400">{text}</span>
  </div>
);

export default ProfileView;
