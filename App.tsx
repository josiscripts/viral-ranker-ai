
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { 
  Home, 
  Library, 
  PlayCircle, 
  PauseCircle,
  User, 
  Plus, 
  ChevronRight, 
  Trash2, 
  Edit2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Scissors, 
  Settings, 
  Download, 
  Link as LinkIcon, 
  Video as VideoIcon, 
  Type as TypeIcon, 
  ExternalLink, 
  AlertCircle, 
  ChevronLeft, 
  ChevronDown, 
  Smile, 
  Bold, 
  Italic, 
  AlignLeft, 
  RotateCcw, 
  RotateCw, 
  FastForward, 
  Rewind, 
  Play, 
  Loader2, 
  Move, 
  CheckCircle2, 
  Film, 
  Ban, 
  Maximize2, 
  GripVertical, 
  Undo2, 
  Redo2, 
  Languages, 
  Sun, 
  Moon, 
  FolderOpen, 
  PlusCircle, 
  Clock, 
  MoreVertical, 
  LayoutDashboard, 
  Zap, 
  Layers, 
  X,
  Type as TypeIconComponent
} from 'lucide-react';
import { Clip, Project, UserProfile, ExportErrorInfo, ExportStep, ExportValidationIssue, ExportRequest } from './types';
import { generateRankingScript } from './services/geminiService';
import {
  ApiNetworkError,
  ApiResponseError,
  apiUrl,
  resolveMediaUrl,
  downloadVideoFromUrl,
  uploadVideoFile,
  createExportJob,
  getExportJobStatus,
  uploadOverlay
} from './services/apiClient';
import { renderOverlayPng } from './services/overlayRenderer';
import ProfileView from './ProfileView';
import { translations } from './translations';
import TrimTimeline from './TrimTimeline';
import { renumberClips, moveClip, clampTrim, initialTrim } from './utils/clips';
import { PREVIEW_STAGE, DEFAULT_TITLE_POSITION, DEFAULT_CLIP_TITLE_POSITION, clampPosition, migratePosition } from './utils/titleLayout';

const getClipLayoutConfig = (clipCount: number) => {
  if (clipCount <= 4) {
    return {
      spacing: 'space-y-8',
      rankFontSize: 'text-5xl',
      titleFontSize: 'text-[12px]',
      topPosition: 'top-[20%]',
      containerGap: 'gap-5'
    };
  } else if (clipCount <= 6) {
    return {
      spacing: 'space-y-6',
      rankFontSize: 'text-4xl',
      titleFontSize: 'text-[11px]',
      topPosition: 'top-[28%]',
      containerGap: 'gap-4'
    };
  } else if (clipCount <= 8) {
    return {
      spacing: 'space-y-4',
      rankFontSize: 'text-3xl',
      titleFontSize: 'text-[10px]',
      topPosition: 'top-[32%]',
      containerGap: 'gap-3'
    };
  } else {
    return {
      spacing: 'space-y-2',
      rankFontSize: 'text-2xl',
      titleFontSize: 'text-[9px]',
      topPosition: 'top-[36%]',
      containerGap: 'gap-2'
    };
  }
};

const calculateMinimumHeight = (clipCount: number): number => {
  if (clipCount === 0) return 20;
  const layoutConfig = getClipLayoutConfig(clipCount);
  const fontSizeMap: Record<string, number> = {
    'text-5xl': 64,
    'text-4xl': 48,
    'text-3xl': 30,
    'text-2xl': 24
  };
  const spacingMap: Record<string, number> = {
    'space-y-8': 32,
    'space-y-6': 24,
    'space-y-4': 16,
    'space-y-2': 8
  };
  const fontSize = fontSizeMap[layoutConfig.rankFontSize] || 24;
  const spacing = spacingMap[layoutConfig.spacing] || 8;
  const itemHeight = fontSize + spacing;
  const totalHeight = itemHeight * clipCount;
  const percentageNeeded = Math.ceil((totalHeight / 560) * 100);
  return Math.min(Math.max(percentageNeeded, 20), 100);
};

const STYLE_PRESETS = [
  { id: 'NONE', name: 'None', classes: 'text-white font-medium', accentColor: 'text-white', shadow: '' },
  { id: 'CUSTOM', name: 'Custom', classes: 'text-white font-bold uppercase', accentColor: 'text-blue-400', shadow: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' },
  { id: 'RANDOM_COLOR', name: 'Random Color', classes: 'text-green-400 font-black italic uppercase', accentColor: 'text-yellow-400', shadow: 'drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]' },
  { id: 'QUICK', name: 'QUICK', classes: 'text-white font-black italic uppercase tracking-tighter', accentColor: 'text-red-500', shadow: 'drop-shadow-[3px_3px_0px_rgba(0,0,0,1)]' },
  { id: 'BLUE_BOX', name: 'Blue Box', classes: 'text-white font-black uppercase bg-blue-600 px-3 py-1 rounded-sm shadow-xl', accentColor: 'text-white', shadow: '' },
  { id: 'GLOW', name: 'Glow', classes: 'text-white font-bold uppercase', accentColor: 'text-cyan-400', shadow: 'drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' },
  { id: 'RETRO', name: 'Retro', classes: 'text-yellow-400 font-mono font-black uppercase', accentColor: 'text-white', shadow: 'drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]' },
  { id: 'MINIMAL', name: 'Minimal', classes: 'text-white font-light lowercase', accentColor: 'text-gray-400', shadow: '' },
  { id: 'ALERT', name: 'Alert', classes: 'text-white font-black uppercase bg-red-600 px-2 py-0.5 rounded-sm', accentColor: 'text-black bg-white', shadow: 'shadow-xl' },
];

const createNewProject = (id: string): Project => ({
  id,
  title: 'NEW VIRAL RANKING',
  clips: [],
  background: '#000000',
  videoHeight: 70,
  captionStyle: 'BLUE_BOX',
  enableTitleDrag: false,
  titleStroke: 2,
  titlePosition: DEFAULT_TITLE_POSITION,
  highlightedIndices: []
});

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_1',
    title: 'RANKING LEGENDARY\nBASKETBALL MOMENTS',
    clips: [{ id: 'clip_1', url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', startTime: 0, endTime: 8, rank: 1, title: 'Bro fell too hard', titleStyleId: 'BLUE_BOX' }],
    background: '#000000',
    videoHeight: 70,
    captionStyle: 'RANDOM_COLOR',
    enableTitleDrag: false,
    titleStroke: 2,
    titlePosition: DEFAULT_TITLE_POSITION,
    highlightedIndices: [1]
  }
];

// Clips created before assetId existed only store the served URL (/api/files/<name>)
const getClipAssetId = (clip: Clip): string | undefined => {
  if (clip.assetId) return clip.assetId;
  try {
    const { pathname } = new URL(clip.url, window.location.origin);
    const prefix = '/api/files/';
    return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : undefined;
  } catch (e) {
    return undefined;
  }
};

// Projects saved before P1-07 stored absolute backend URLs
// (http://localhost:3001/api/files/<name>). Keep only the relative path and the
// asset id, so the project works whatever address the backend has.
const LEGACY_MEDIA_URL = /^https?:\/\/(?:localhost|127\.0\.0\.1):3001(\/api\/files\/[^?#]+)$/;

const migrateLegacyClip = (clip: Clip): Clip => {
  // Title positions used to be pixel offsets that depended on the window size (E-04)
  const positioned = clip.clipTitlePosition === undefined
    ? clip
    : { ...clip, clipTitlePosition: migratePosition(clip.clipTitlePosition, DEFAULT_CLIP_TITLE_POSITION) };
  const match = typeof clip.url === 'string' ? clip.url.match(LEGACY_MEDIA_URL) : null;
  if (!match) return positioned;
  const migrated = { ...positioned, url: match[1] };
  return { ...migrated, assetId: clip.assetId || getClipAssetId(migrated) };
};

// Also renumbers ranks: older versions could save duplicated ranks (E-12)
const migrateLegacyProjects = (projects: Project[]): Project[] =>
  projects.map(project => ({
    ...project,
    titlePosition: migratePosition(project.titlePosition, DEFAULT_TITLE_POSITION),
    ...(Array.isArray(project.clips) ? { clips: renumberClips(project.clips.map(migrateLegacyClip)) } : {})
  }));

// Clips the server would reject, checked before anything is sent
const getExportIssues = (clips: Clip[]): ExportValidationIssue[] =>
  clips.flatMap((clip, index): ExportValidationIssue[] => {
    if (!getClipAssetId(clip)) return [{ clipNumber: index + 1, reason: 'missingVideo' }];
    const validTrim = Number.isFinite(clip.startTime) && Number.isFinite(clip.endTime)
      && clip.startTime >= 0 && clip.startTime < clip.endTime;
    return validTrim ? [] : [{ clipNumber: index + 1, reason: 'invalidTrim' }];
  });

// Carries the kind of failure from the export flow to the error banner
class ExportFailure extends Error {
  info: ExportErrorInfo;

  constructor(info: ExportErrorInfo) {
    super(info.message || info.kind);
    this.info = info;
  }
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Creator',
  email: '',
  handle: '@creator',
  bio: 'Creating high-impact viral content with AI rankers. Transforming simple concepts into viral hooks.',
  avatarUrl: 'neon_hustler',
  defaultPlatform: 'TikTok',
  defaultCaptionStyle: 'BLUE_BOX',
  accentColor: 'text-cyan-400',
  autoUppercase: true,
  stats: {
    totalVideos: 1,
    exportedClips: 12,
    aiGenerations: 45,
    viewsGained: '1.2M'
  }
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('viral_ranker_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // An empty list would leave the editor without an active project
        if (Array.isArray(parsed) && parsed.length > 0) return migrateLegacyProjects(parsed);
      } catch (e) {
        console.error('Failed to parse projects from localStorage', e);
      }
    }
    return INITIAL_PROJECTS;
  });

  useEffect(() => {
    localStorage.setItem('viral_ranker_projects', JSON.stringify(projects));
  }, [projects]);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectTitle, setEditProjectTitle] = useState('');

  const handleDeleteProject = (projectId: string) => {
    if (!window.confirm(lang === 'es' ? '¿Estás seguro de que deseas eliminar este proyecto?' : 'Are you sure you want to delete this project?')) {
      return;
    }
    const remaining = projects.filter(p => p.id !== projectId);
    // Never leave the app without projects: the editor always needs an active one
    if (remaining.length === 0) {
      const replacement = createNewProject(`proj_${Date.now()}`);
      setProjects([replacement]);
      setActiveProjectId(replacement.id);
      return;
    }
    setProjects(remaining);
    if (activeProjectId === projectId) {
      setActiveProjectId(remaining[0].id);
    }
  };

  const handleSaveProjectTitle = (projectId: string) => {
    if (!editProjectTitle.trim()) return;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, title: editProjectTitle.trim() } : p));
    setEditingProjectId(null);
  };

  const [lang, setLang] = useState<'en' | 'es'>(() => {
    const saved = localStorage.getItem('viral_ranker_lang');
    return (saved === 'es' || saved === 'en') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('viral_ranker_lang', lang);
  }, [lang]);

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('viral_ranker_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load profile from localStorage', e);
      }
    }
    return DEFAULT_PROFILE;
  });

  useEffect(() => {
    localStorage.setItem('viral_ranker_profile', JSON.stringify(profile));
  }, [profile]);

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const saved = localStorage.getItem('viral_ranker_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed[0].id;
      } catch (e) {}
    }
    return INITIAL_PROJECTS[0].id;
  });
  const [activeTab, setActiveTab] = useState('home'); 
  const [isGenerating, setIsGenerating] = useState(false);
  // Per clip, so several uploads/downloads can run at the same time
  const [uploadingClipIds, setUploadingClipIds] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [downloadingClipIds, setDownloadingClipIds] = useState<Record<string, boolean>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportJobId, setExportJobId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<ExportErrorInfo | null>(null);
  const [exportStep, setExportStep] = useState<ExportStep | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [isPlaying, setIsPlaying] = useState(true);
  // Playback position inside the active clip's trim, 0..1
  const [previewProgress, setPreviewProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showCaptions, setShowCaptions] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('viral_ranker_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('viral_ranker_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const titleElementRef = useRef<HTMLDivElement>(null);
  const clipTitleElementRef = useRef<HTMLDivElement>(null);
  const [isDraggingClipTitle, setIsDraggingClipTitle] = useState(false);
  // Canvas width / stage width: the overlay is laid out on PREVIEW_STAGE and scaled to the canvas
  const [previewScale, setPreviewScale] = useState(1);
  const previewObserverRef = useRef<ResizeObserver | null>(null);
  const setPreviewContainer = useCallback((node: HTMLDivElement | null) => {
    previewContainerRef.current = node;
    previewObserverRef.current?.disconnect();
    previewObserverRef.current = null;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setPreviewScale(entry.contentRect.width / PREVIEW_STAGE.width));
    observer.observe(node);
    previewObserverRef.current = observer;
  }, []);
  const [clipTitleDragStart, setClipTitleDragStart] = useState<{ x: number, y: number } | null>(null);

  const t = translations[lang];

  const project = useMemo(() =>
    projects.find(p => p.id === activeProjectId) || projects[0],
    [projects, activeProjectId]
  );

  useEffect(() => {
    const minHeight = calculateMinimumHeight(project.clips.length);
    if (project.videoHeight < minHeight) {
      updateCurrentProject({ videoHeight: minHeight });
    }
  }, [project.clips.length, project.id]);

  const currentStyle = STYLE_PRESETS.find(s => s.id === project.captionStyle) || STYLE_PRESETS[0];
  const activeClipIndex = useMemo(() => project.clips.findIndex(c => c.id === activeClipId), [project.clips, activeClipId]);
  const activeClip = useMemo(() => project.clips[activeClipIndex] || project.clips[0], [project.clips, activeClipIndex]);

  // The active clip belongs to the open project: select its first clip on every switch
  useEffect(() => {
    setActiveClipId(project.clips[0]?.id ?? null);
  }, [project.id]);

  useEffect(() => {
    const handleGlobalClick = () => setMenuOpenId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (!videoRef.current || !activeClip?.url) return;

    const video = videoRef.current;
    const currentTime = video.currentTime;
    const isOutOfRange = currentTime < activeClip.startTime || currentTime > activeClip.endTime;

    if (isOutOfRange) {
      const newTime = currentTime < activeClip.startTime ? activeClip.startTime : activeClip.endTime;
      video.currentTime = newTime;
      video.pause();
    }
  }, [activeClip?.startTime, activeClip?.endTime, activeClip?.url]);

  // The preview loops over [startTime, endTime], like the exported clip
  const handlePreviewTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!activeClip) return;
    const video = e.currentTarget;
    const length = activeClip.endTime - activeClip.startTime;
    if (video.currentTime >= activeClip.endTime || video.currentTime < activeClip.startTime - 0.25) {
      video.currentTime = activeClip.startTime;
    }
    setPreviewProgress(length > 0 ? Math.min(1, Math.max(0, (video.currentTime - activeClip.startTime) / length)) : 0);
  };

  const handlePreviewRestart = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!activeClip) return;
    const video = e.currentTarget;
    video.currentTime = activeClip.startTime;
    if (e.type === 'ended' && isPlaying) video.play().catch(() => setIsPlaying(false));
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const updateCurrentProject = (updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p));
  };

  // Updates one clip on top of the latest state. Async results (upload, download)
  // use the project and clip they started on, so edits made meanwhile, or a switch
  // to another project, are never overwritten.
  const updateClipInProject = (projectId: string, clipId: string, updates: Partial<Clip>) => {
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, clips: p.clips.map(c => c.id === clipId ? { ...c, ...updates } : c) }
      : p));
  };

  const setClipFlag = (setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>, clipId: string, value: boolean) => {
    setFlags(prev => {
      const next = { ...prev };
      if (value) next[clipId] = true;
      else delete next[clipId];
      return next;
    });
  };

  const handleUpdateClip = (id: string, updates: Partial<Clip>) => {
    updateClipInProject(project.id, id, updates);
  };

  const handleDownloadUrl = async (clipId: string, url: string) => {
    const projectId = project.id;
    setClipFlag(setDownloadingClipIds, clipId, true);
    setDownloadErrors(prev => ({ ...prev, [clipId]: '' }));

    try {
      if (!url || !url.trim()) {
        throw new Error('URL cannot be empty');
      }

      console.log(`[DOWNLOAD] Iniciando descarga de ${url}`);
      const { videoUrl, duration, platform, filename } = await downloadVideoFromUrl(url.trim());

      updateClipInProject(projectId, clipId, { url: videoUrl, assetId: filename, sourceUrl: url.trim(), duration, ...initialTrim(duration) });
      console.log(`[DOWNLOAD] Clip ${clipId} actualizado exitosamente desde ${platform}. URL: ${videoUrl}`);
    } catch (err) {
      const errorMsg = (err instanceof Error && err.message) || 'Download failed';
      setDownloadErrors(prev => ({ ...prev, [clipId]: errorMsg }));
      console.error(`[DOWNLOAD] Download error for clip ${clipId}:`, errorMsg);
    } finally {
      setClipFlag(setDownloadingClipIds, clipId, false);
    }
  };

  const handleFileUpload = async (clipId: string, file: File) => {
    const projectId = project.id;
    setClipFlag(setUploadingClipIds, clipId, true);
    setUploadErrors(prev => ({ ...prev, [clipId]: '' }));

    try {
      if (file.type !== 'video/mp4') {
        throw new Error('Only .mp4 files are allowed');
      }

      console.log(`[UPLOAD] Iniciando upload de ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      const { videoUrl, duration, filename } = await uploadVideoFile(file);

      updateClipInProject(projectId, clipId, { url: videoUrl, assetId: filename, duration, ...initialTrim(duration) });
      console.log(`[UPLOAD] Clip actualizado exitosamente. URL: ${videoUrl}`);
    } catch (err) {
      const errorMsg = (err instanceof Error && err.message) || 'Upload failed';
      setUploadErrors(prev => ({ ...prev, [clipId]: errorMsg }));
      console.error(`[UPLOAD] Upload error for clip ${clipId}:`, errorMsg);
    } finally {
      setClipFlag(setUploadingClipIds, clipId, false);
    }
  };

  const handleCreateNewProject = () => {
    const newId = `proj_${Date.now()}`;
    const newProject = createNewProject(newId);
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newId);
    setActiveTab('editor');
  };

  const formatExportStep = (step: ExportStep) => {
    switch (step.key) {
      case 'renderingOverlays':
        return t.exportStepOverlays.replace('{n}', String(step.clip ?? '')).replace('{total}', String(step.total ?? ''));
      case 'processingClip':
        return t.exportStepClip.replace('{n}', String(step.clip ?? '')).replace('{total}', String(step.total ?? ''));
      case 'concatenating':
        return t.exportStepConcat;
      case 'cleaningUp':
        return t.exportStepCleanup;
      case 'completed':
        return t.exportStepDone;
      default:
        return t.exportStepQueued;
    }
  };

  const getExportErrorLines = (error: ExportErrorInfo): string[] => {
    switch (error.kind) {
      case 'noClips':
        return [t.exportErrorNoClips];
      case 'validation':
        return [t.exportErrorValidation, ...(error.issues || []).map(issue =>
          (issue.reason === 'missingVideo' ? t.exportErrorMissingVideo : t.exportErrorInvalidTrim).replace('{n}', String(issue.clipNumber))
        )];
      case 'network':
        return [t.exportErrorNetwork];
      case 'timeout':
        return [t.exportErrorTimeout];
      case 'render':
        return [t.exportErrorRender];
      default:
        return error.message ? [t.exportErrorServer, error.message] : [t.exportErrorServer];
    }
  };

  // The rank list animates the active clip for 500 ms; the layer is taken after it settles
  const OVERLAY_SETTLE_MS = 600;

  // P1-04: the design layer of each clip is rendered from the live preview (the
  // preview switches to every clip in turn), so the video shows what the user sees.
  const renderClipOverlays = async (clips: Clip[]): Promise<Record<string, string>> => {
    const canvas = previewContainerRef.current;
    if (!canvas) return {};
    const previousClipId = activeClipId;
    const overlayIds: Record<string, string> = {};
    try {
      for (let i = 0; i < clips.length; i++) {
        setExportStep({ key: 'renderingOverlays', clip: i + 1, total: clips.length });
        setActiveClipId(clips[i].id);
        await new Promise(resolve => setTimeout(resolve, OVERLAY_SETTLE_MS));
        let png: Blob;
        try {
          png = await renderOverlayPng(canvas);
        } catch (error) {
          console.error('[EXPORT] Design layer rendering failed:', error);
          throw new ExportFailure({ kind: 'render' });
        }
        overlayIds[clips[i].id] = (await uploadOverlay(png)).overlayId;
      }
    } finally {
      setActiveClipId(previousClipId);
    }
    return overlayIds;
  };

  const handleExport = async () => {
    setExportError(null);
    if (project.clips.length === 0) {
      setExportError({ kind: 'noClips' });
      return;
    }
    const issues = getExportIssues(project.clips);
    if (issues.length > 0) {
      setExportError({ kind: 'validation', issues });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportStep({ key: 'queued' });

    try {
      // Prepare export request with all project data
      const exportRequest: ExportRequest = {
        projectId: project.id,
        title: project.title,
        titlePosition: project.titlePosition,
        titleStroke: project.titleStroke,
        // Old or hand-edited projects may hold values the server rejects
        background: /^#[0-9A-Fa-f]{6}$/.test(project.background) ? project.background : '#000000',
        videoHeight: Number.isFinite(project.videoHeight) ? Math.min(100, Math.max(10, project.videoHeight)) : 100,
        clips: project.clips.map((clip: Clip) => ({
          id: clip.id,
          assetId: getClipAssetId(clip),
          startTime: clip.startTime,
          endTime: clip.endTime,
          rank: clip.rank,
          title: clip.title,
          titleStyle: { color: '#FFFFFF' },
          clipTitlePosition: clip.clipTitlePosition
        }))
      };

      console.log('DEBUG: Exporting with data:', {
        projectId: exportRequest.projectId,
        title: exportRequest.title,
        titlePosition: exportRequest.titlePosition,
        titleStroke: exportRequest.titleStroke,
        clipsCount: exportRequest.clips.length,
        clips: exportRequest.clips.map(c => ({
          id: c.id,
          assetId: c.assetId,
          startTime: c.startTime,
          endTime: c.endTime,
          rank: c.rank,
          title: c.title
        }))
      });

      // Step 1: Design layer of every clip, then the job
      const overlayIds = await renderClipOverlays(project.clips);
      exportRequest.clips.forEach(clip => { clip.overlayId = overlayIds[clip.id]; });
      setExportStep({ key: 'queued' });
      const { jobId } = await createExportJob(exportRequest);
      setExportJobId(jobId);

      // Step 2: Poll for job status every 500ms (max 600 attempts = 5 minutes)
      const MAX_POLLS = 600;
      for (let poll = 0; ; poll++) {
        if (poll >= MAX_POLLS) throw new ExportFailure({ kind: 'timeout' });
        await new Promise(resolve => setTimeout(resolve, 500));

        let status;
        try {
          status = await getExportJobStatus(jobId, 5000);
        } catch (e) {
          // A slow status response is retried on the next poll
          if (e instanceof DOMException && e.name === 'TimeoutError') continue;
          throw e;
        }
        setExportProgress(status.progress);
        if (status.step) setExportStep(status.step);

        if (status.status === 'error') {
          throw new ExportFailure({ kind: 'server', message: status.error || undefined });
        }
        if (status.status === 'completed' && status.downloadUrl) {
          // Download the file
          const link = document.createElement('a');
          link.href = apiUrl(status.downloadUrl);
          link.download = `${project.title.replace(/\n/g, '_').toLowerCase()}_export.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          break;
        }
      }

      // Success - keep progress bar visible for a moment
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        setExportStep(null);
        setExportJobId(null);
      }, 1500);

    } catch (error) {
      if (error instanceof ExportFailure) setExportError(error.info);
      else if (error instanceof ApiNetworkError) setExportError({ kind: 'network' });
      else if (error instanceof ApiResponseError) setExportError({ kind: 'server', message: error.message });
      else setExportError({ kind: 'server', message: error instanceof Error ? error.message : undefined });
      setIsExporting(false);
      setExportProgress(0);
      setExportStep(null);
      setExportJobId(null);
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (!project.enableTitleDrag) return;
    setIsDragging(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });
  };

  const handleClipTitleDragStart = (e: React.MouseEvent) => {
    if (!project.enableTitleDrag) return;
    e.preventDefault();
    setIsDraggingClipTitle(true);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setClipTitleDragStart({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && previewContainerRef.current && titleElementRef.current) {
        const containerRect = previewContainerRef.current.getBoundingClientRect();
        const titleRect = titleElementRef.current.getBoundingClientRect();
        const titlePosition = clampPosition({
          fx: (e.clientX - dragOffset.x - containerRect.left) / containerRect.width,
          fy: (e.clientY - dragOffset.y - containerRect.top) / containerRect.height
        }, titleRect.width / 2 / containerRect.width, titleRect.height / 2 / containerRect.height);
        updateCurrentProject({ titlePosition });
      }
    };
    const handleGlobalMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    const handleClipTitleMouseMove = (e: MouseEvent) => {
      if (isDraggingClipTitle && previewContainerRef.current && clipTitleElementRef.current && activeClipId) {
        const containerRect = previewContainerRef.current.getBoundingClientRect();
        const clipTitleRect = clipTitleElementRef.current.getBoundingClientRect();
        const clipTitlePosition = clampPosition({
          fx: (e.clientX - (clipTitleDragStart?.x || 0) - containerRect.left) / containerRect.width,
          fy: (e.clientY - (clipTitleDragStart?.y || 0) - containerRect.top) / containerRect.height
        }, clipTitleRect.width / 2 / containerRect.width, clipTitleRect.height / 2 / containerRect.height);
        updateClipInProject(project.id, activeClipId, { clipTitlePosition });
      }
    };
    const handleClipTitleMouseUp = () => setIsDraggingClipTitle(false);
    if (isDraggingClipTitle) {
      window.addEventListener('mousemove', handleClipTitleMouseMove);
      window.addEventListener('mouseup', handleClipTitleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleClipTitleMouseMove);
      window.removeEventListener('mouseup', handleClipTitleMouseUp);
    };
  }, [isDraggingClipTitle, clipTitleDragStart, activeClipId, project.id]);

  const toggleHighlight = (index: number) => {
    const newIndices = project.highlightedIndices.includes(index)
      ? project.highlightedIndices.filter(i => i !== index)
      : [...project.highlightedIndices, index];
    updateCurrentProject({ highlightedIndices: newIndices });
  };

  const renderViralTitle = () => {
    if (!project.title || !showCaptions) return null;
    const lines = project.title.split('\n');
    let absoluteWordIndex = 0;
    const titleContent = lines.map((line, lIdx) => (
      <div key={lIdx} className="flex flex-wrap justify-center gap-x-2">
        {line.split(' ').map((word, wIdx) => {
          const currentIndex = absoluteWordIndex++;
          const isHighlighted = project.highlightedIndices.includes(currentIndex);
          return (
            <span 
              key={wIdx} 
              onClick={(e) => { e.stopPropagation(); toggleHighlight(currentIndex); }}
              className={`cursor-pointer transition-colors ${isHighlighted ? currentStyle.accentColor : ""}`}
            >
              {word}
            </span>
          );
        })}
      </div>
    ));

    return (
      <div
        ref={titleElementRef}
        onMouseDown={handleDragStart}
        className={`absolute w-max pointer-events-auto ${currentStyle.shadow} ${project.enableTitleDrag ? 'cursor-move' : ''}`}
        style={{
          left: project.titlePosition.fx * PREVIEW_STAGE.width,
          top: project.titlePosition.fy * PREVIEW_STAGE.height,
          maxWidth: PREVIEW_STAGE.width,
          transform: 'translate(-50%, -50%)',
          zIndex: 60
        }}
      >
        <div 
          className={`absolute inset-0 translate-x-[1px] translate-y-[1px] opacity-70 blur-[1px] ${currentStyle.classes}`}
          style={{ WebkitTextStroke: `${project.titleStroke + 1}px #000`, color: 'black' }}
        >
          {titleContent}
        </div>
        <div 
          className={`relative ${currentStyle.classes}`}
          style={{ WebkitTextStroke: `${project.titleStroke}px ${strokeColor}` }}
        >
          {titleContent}
        </div>
      </div>
    );
  };

  const renderClipTitle = () => {
    if (!activeClip || !activeClip.title || !showCaptions) return null;
    const titleStyle = STYLE_PRESETS.find(s => s.id === (activeClip.titleStyleId || 'BLUE_BOX')) || currentStyle;
    const clipTitleContent = activeClip.title;

    return (
      <span className={`${titleStyle.shadow} ${titleStyle.classes}`} style={{ WebkitTextStroke: `1px #000` }}>
        {clipTitleContent}
      </span>
    );
  };

  return (
    <div className={`flex h-screen transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] text-gray-200' : 'bg-[#f8f9fa] text-gray-900'}`}>
      {/* Exporting Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-10">
          <div className="max-w-md w-full text-center space-y-10">
            <Film size={64} className="text-blue-500 mx-auto animate-pulse" />
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter">{t.exportingBtn}</h2>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(37,99,235,0.2)]">
              <div className="h-full bg-blue-600 transition-all duration-300 shadow-[0_0_15px_rgba(37,99,235,0.8)]" style={{ width: `${exportProgress}%` }}></div>
            </div>
            <p className="text-sm font-bold text-gray-400 tracking-tight">
              {exportStep ? formatExportStep(exportStep) : t.exportStepQueued} · {Math.round(exportProgress)}%
            </p>
          </div>
        </div>
      )}

      {/* Export error banner */}
      {exportError && !isExporting && (
        <div role="alert" className={`fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-[calc(100%-2rem)] max-w-lg rounded-[24px] border p-6 shadow-2xl ${isDarkMode ? 'bg-[#1a1a1a] border-red-500/30' : 'bg-white border-red-200'}`}>
          <div className="flex items-start gap-4">
            <AlertCircle size={24} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.exportErrorTitle}</h3>
              {getExportErrorLines(exportError).map((line, index) => (
                <p key={index} className={`text-sm font-medium break-words ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{line}</p>
              ))}
            </div>
            <button onClick={() => setExportError(null)} aria-label={t.exportDismiss} title={t.exportDismiss} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}>
              <X size={18} />
            </button>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleExport} className="px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-xs font-black inline-flex items-center gap-2 shadow-xl hover:scale-105 active:scale-95 transition-all">
              <RotateCcw size={14} /> {t.exportRetry}
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`w-20 lg:w-64 border-r flex flex-col items-center py-6 px-4 z-10 transition-colors duration-500 ${isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-gray-200 shadow-xl'}`}>
        <div className="flex items-center gap-2 mb-10">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-white' : 'bg-gray-900'}`}>
            <VideoIcon className={`w-6 h-6 ${isDarkMode ? 'text-black' : 'text-white'}`} />
          </div>
          <span className={`hidden lg:block text-xl font-bold tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>VIRAL</span>
        </div>
        <nav className="flex flex-col gap-4 w-full">
          <SidebarItem icon={<Home size={22} />} label={t.home} active={activeTab === 'home'} onClick={() => setActiveTab('home')} isDarkMode={isDarkMode} />
          <SidebarItem icon={<FolderOpen size={22} />} label={lang === 'es' ? 'Proyectos' : 'Projects'} active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} isDarkMode={isDarkMode} />
          <SidebarItem icon={<Scissors size={22} />} label={t.library} active={activeTab === 'editor'} onClick={() => setActiveTab('editor')} isDarkMode={isDarkMode} />
          <SidebarItem icon={<User size={22} />} label={t.profile} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} isDarkMode={isDarkMode} />
        </nav>

        {/* Global Theme Toggle Section */}
        <div className={`mt-auto w-full pt-6 border-t flex flex-col items-center justify-center ${isDarkMode ? 'border-white/5' : 'border-gray-200'}`}>
          {/* Mobile Single Button Toggle (Visible on smaller than lg screens) */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className={`lg:hidden p-3 rounded-2xl transition-all shadow-md ${isDarkMode ? 'bg-white/5 text-yellow-400 hover:bg-white/10' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'}`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Night Mode'}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Desktop Dual-pill Switcher (Visible on lg screens) */}
          <div className={`hidden lg:flex p-1.5 rounded-2xl w-full items-center relative select-none ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
            <button 
              onClick={() => setIsDarkMode(false)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${!isDarkMode ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Sun size={14} />
              <span>{t.light}</span>
            </button>
            <button 
              onClick={() => setIsDarkMode(true)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${isDarkMode ? 'bg-[#121212] text-yellow-400 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Moon size={14} />
              <span>{t.night}</span>
            </button>
          </div>
        </div>

        {/* Language Selection Bar */}
        <div className={`w-full pt-4 mt-4 border-t border-dashed flex flex-col items-center gap-2 ${isDarkMode ? 'border-white/5' : 'border-gray-200'}`}>
          {/* Mobile switcher icon */}
          <button
            onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            className={`lg:hidden p-3 rounded-2xl transition-all shadow-md ${isDarkMode ? 'bg-white/5 text-blue-400 hover:bg-white/10' : 'bg-gray-100 text-blue-600 hover:bg-gray-200'}`}
            title={lang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
          >
            <span className="text-sm font-bold">{lang === 'en' ? '🇺🇸' : '🇪🇸'}</span>
          </button>

          {/* Desktop dual toggle */}
          <div className={`hidden lg:flex p-1.5 rounded-2xl w-full items-center relative select-none ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
            <button 
              onClick={() => setLang('en')}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <span>🇺🇸</span>
              <span>EN</span>
            </button>
            <button 
              onClick={() => setLang('es')}
              className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${lang === 'es' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span>🇪🇸</span>
              <span>ES</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto flex flex-col lg:flex-row relative">
        
        {activeTab === 'home' ? (
          /* Home Toolbox View */
          <div className="flex-1 p-10 space-y-12 max-w-7xl mx-auto w-full animate-in fade-in duration-700">
            <header className="flex flex-col gap-2">
              <h1 className={`text-5xl font-black tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {lang === 'es' ? <>Bienvenido, <span className="text-blue-500">Creador</span></> : <>Welcome back, <span className="text-blue-500">Creator</span></>}
              </h1>
              <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {lang === 'es' ? 'Elige tu próxima herramienta viral' : 'Choose your next viral tool'}
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <ToolCard icon={<ArrowUp size={32} className="text-blue-500" />} title={lang === 'es' ? "Editor de Ránkings" : "Ranking Editor"} description={lang === 'es' ? "La herramienta definitiva para crear videos virales de listas top. Edita estilos, rangos y más." : "The ultimate tool to create viral top-list videos. Edit styles, ranks, and more."} onClick={() => setActiveTab('projects')} badge={lang === 'es' ? "Popular" : "Popular"} isDarkMode={isDarkMode} />
              <ToolCard icon={<Zap size={32} className="text-yellow-500" />} title={lang === 'es' ? "Exportación Rápida" : "Quick Export"} description={lang === 'es' ? "Acelera el proceso de renderizado para TikTok y Reels con optimizaciones preestablecidas." : "Fast-track your rendering process for TikTok and Reels with preset optimizations."} onClick={() => {}} isDarkMode={isDarkMode} />
              <ToolCard icon={<Scissors size={32} className="text-purple-500" />} title={lang === 'es' ? "Editor de Video" : "Video Editor"} description={lang === 'es' ? "Agrega ganchos, cambia fuentes, ajusta tiempos y genera guiones con Inteligencia Artificial." : "Add hooks, change fonts, adjust timings, and generate scripts with Artificial Intelligence."} onClick={() => setActiveTab('editor')} isDarkMode={isDarkMode} />
            </div>
          </div>
        ) : activeTab === 'projects' ? (
          /* Projects Dashboard */
          <div className="flex-1 p-10 space-y-10 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-left-4 duration-500">
            <header className="flex items-center justify-between">
              <div>
                <h1 className={`text-4xl font-black tracking-tighter uppercase ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{lang === 'es' ? 'Mis Clasificaciones' : 'My Rankings'}</h1>
                <p className={`text-sm mt-2 font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{lang === 'es' ? 'Administra y crea tus conceptos de video viral' : 'Manage and create your viral video concepts'}</p>
              </div>
              <button onClick={handleCreateNewProject} className="px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black text-sm flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all">
                <PlusCircle size={20} /> {lang === 'es' ? 'CREAR NUEVO VIDEO' : 'CREATE NEW VIDEO'}
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setActiveProjectId(p.id); setActiveTab('editor'); }} className={`group relative rounded-[32px] border p-6 cursor-pointer transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-[#111] border-white/5 hover:bg-[#161616]' : 'bg-white border-gray-100 hover:shadow-2xl'}`}>
                  
                  {/* Hover Actions overlay */}
                  {editingProjectId !== p.id && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProjectId(p.id);
                          setEditProjectTitle(p.title);
                        }}
                        className={`p-2 rounded-xl transition-all shadow-lg ${isDarkMode ? 'bg-[#1a1a1a] text-gray-300 hover:text-white hover:bg-[#252525] border border-white/5' : 'bg-white text-gray-600 hover:text-black hover:bg-gray-50 border border-gray-100'}`}
                        title={lang === 'es' ? 'Editar Nombre' : 'Rename Project'}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(p.id);
                        }}
                        className={`p-2 rounded-xl transition-all shadow-lg ${isDarkMode ? 'bg-[#1a1a1a] text-red-400 hover:text-red-500 hover:bg-red-500/10 border border-white/5' : 'bg-white text-red-500 hover:text-red-600 hover:bg-red-50 border border-gray-100'}`}
                        title={lang === 'es' ? 'Eliminar Proyecto' : 'Delete Project'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  <div className={`aspect-video rounded-2xl mb-6 overflow-hidden relative flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}>
                    {p.clips[0]?.url ? <video src={resolveMediaUrl(p.clips[0].url)} className="w-full h-full object-cover opacity-60" /> : <Film size={40} className={isDarkMode ? 'text-white/5' : 'text-gray-200'} />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                      <span className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2"><Play size={12} fill="white"/> {lang === 'es' ? 'Continuar Editando' : 'Continue Editing'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {editingProjectId === p.id ? (
                      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                        <textarea
                          value={editProjectTitle}
                          onChange={(e) => setEditProjectTitle(e.target.value)}
                          className={`w-full p-3 text-sm font-bold uppercase border rounded-2xl focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors ${isDarkMode ? 'bg-[#151515] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                          rows={2}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSaveProjectTitle(p.id);
                            } else if (e.key === 'Escape') {
                              setEditingProjectId(null);
                            }
                          }}
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => setEditingProjectId(null)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${isDarkMode ? 'border-white/5 hover:bg-white/5 text-gray-400' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}
                          >
                            {lang === 'es' ? 'Cancelar' : 'Cancel'}
                          </button>
                          <button
                            onClick={() => handleSaveProjectTitle(p.id)}
                            className="px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
                          >
                            {lang === 'es' ? 'Guardar' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className={`text-lg font-black uppercase tracking-tight line-clamp-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{p.title}</h3>
                        <div className="flex items-center justify-between">
                          <div className={`flex items-center gap-2 text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                            <Clock size={12} />
                            <span>{p.clips.length} {lang === 'es' ? 'Clips Cargados' : 'Clips Loaded'}</span>
                          </div>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${isDarkMode ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{lang === 'es' ? 'Ránking' : 'Ranking'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={handleCreateNewProject} className={`flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed aspect-video transition-all ${isDarkMode ? 'border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 text-gray-700 hover:text-blue-400' : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 text-gray-400 hover:text-blue-500'}`}>
                <Plus size={40} strokeWidth={3} />
                <span className="mt-4 text-xs font-black uppercase tracking-widest">{lang === 'es' ? 'Agregar Concepto' : 'Add Concept'}</span>
              </button>
            </div>
          </div>
        ) : activeTab === 'profile' ? (
          /* Profile View */
          <ProfileView 
            profile={profile}
            onUpdateProfile={(updates) => setProfile(prev => ({ ...prev, ...updates }))}
            isDarkMode={isDarkMode}
            projectsCount={projects.length}
            lang={lang}
            onLanguageChange={setLang}
          />
        ) : (
          /* Editor View */
          <>
            <div className="flex-1 p-6 lg:p-10 z-10 space-y-8 max-w-5xl animate-in fade-in duration-300">
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveTab('projects')} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}>
                    <ChevronLeft size={24} className="text-blue-500" />
                  </button>
                  <h1 className={`text-2xl font-black tracking-tight transition-colors ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{t.editorTitle}</h1>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className={`p-3 rounded-2xl transition-all shadow-lg ${isDarkMode ? 'bg-white/5 text-yellow-400 hover:bg-white/10' : 'bg-white text-blue-600 hover:bg-gray-100'}`}>
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                  <button onClick={handleExport} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl text-sm font-black flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all">
                    <Download size={18} /> {lang === 'es' ? 'EXPORTAR' : 'EXPORT'}
                  </button>
                </div>
              </header>

              <section className={`space-y-6 p-8 rounded-[32px] border shadow-2xl transition-all duration-500 ${isDarkMode ? 'bg-[#111]/60 border-white/5' : 'bg-white border-gray-100 shadow-xl'}`}>
                {/* Title Editor Box */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{t.rankingTitleLabel}</label>
                  </div>

                  <div className={`flex items-center gap-1 p-2 rounded-t-xl border-x border-t transition-colors ${isDarkMode ? 'bg-[#151515] border-white/5 shadow-lg' : 'bg-gray-50 border-gray-200'}`}>
                    <ToolbarButton icon={<Smile size={20} />} isDarkMode={isDarkMode} />
                    <div className={`w-px h-6 mx-2 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                    <ToolbarDropdown label={<span className={`text-xs font-black ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>A</span>} isDarkMode={isDarkMode} />
                    <ToolbarButton icon={<span className="text-xl font-black text-blue-500">B</span>} active className={isDarkMode ? 'bg-blue-600/10 border border-blue-600/20' : 'bg-blue-50 border border-blue-200'} isDarkMode={isDarkMode} />
                    <ToolbarButton icon={<Italic size={20} />} isDarkMode={isDarkMode} />
                    <ToolbarDropdown icon={<TypeIcon size={20} />} isDarkMode={isDarkMode} />
                    <ToolbarDropdown icon={<TypeIcon size={20} className="text-blue-400" />} isDarkMode={isDarkMode} />
                    <ToolbarDropdown label={<span className="text-xs font-black text-blue-500">AI</span>} isDarkMode={isDarkMode} />
                    <div className={`w-px h-6 mx-2 ${isDarkMode ? 'bg-white/10' : 'bg-gray-200'}`}></div>
                    <ToolbarDropdown icon={<AlignLeft size={20} />} isDarkMode={isDarkMode} />
                    <ToolbarButton icon={<Undo2 size={20} />} isDarkMode={isDarkMode} />
                    <ToolbarButton icon={<Redo2 size={20} />} isDarkMode={isDarkMode} />
                  </div>

                  <div className={`border p-6 rounded-b-xl shadow-inner transition-all duration-500 overflow-hidden relative ${isDarkMode ? 'bg-[#0c0c0c] border-white/5' : 'bg-white border-gray-200'}`}>
                    <textarea
                      value={project.title}
                      onChange={(e) => updateCurrentProject({ title: e.target.value })}
                      maxLength={32}
                      className={`w-full bg-transparent border-none text-3xl focus:ring-0 resize-none min-h-[160px] uppercase tracking-tighter transition-all duration-300 relative z-10 ${currentStyle.classes} ${currentStyle.shadow} ${isDarkMode ? 'placeholder:text-gray-800' : 'placeholder:text-gray-400'}`}
                      style={{ WebkitTextStroke: `${project.titleStroke}px ${strokeColor}`, lineHeight: '1.1' }}
                      placeholder={t.rankingTitlePlaceholder}
                    />
                    <div className={`absolute inset-0 p-6 pointer-events-none opacity-20 blur-[1px] text-3xl uppercase tracking-tighter ${currentStyle.classes}`} style={{ WebkitTextStroke: `${project.titleStroke + 1}px #000`, lineHeight: '1.1' }}>{project.title}</div>
                    <div className={`text-right text-xs font-black tracking-widest mt-3 relative z-10 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                      {project.title.length}/32
                    </div>
                  </div>
                </div>

                {/* Layout Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <ToggleRow label={lang === 'es' ? "Habilitar Arrastre de Título" : "Enable Title Drag"} checked={project.enableTitleDrag} onChange={(v) => updateCurrentProject({ enableTitleDrag: v })} isDarkMode={isDarkMode} />
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{lang === 'es' ? "Grosor de Contorno" : "Title Stroke Width"}</label>
                        <span className="text-[10px] font-black text-blue-500">{project.titleStroke}px</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <input type="range" min="0" max="8" step="1" value={project.titleStroke} onChange={(e) => updateCurrentProject({ titleStroke: parseInt(e.target.value) })} className={`flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-blue-600 ${isDarkMode ? 'bg-white/5' : 'bg-gray-200'}`} />
                        <div className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-gray-50 border-gray-200 shadow-sm'}`}>
                          <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{lang === 'es' ? "Altura de Diseño de Video" : "Video Layout Height"}</label>
                        <span className="text-[10px] font-black text-blue-500">{project.videoHeight}%</span>
                      </div>
                      {(() => {
                        const minHeight = calculateMinimumHeight(project.clips.length);
                        const isBelowMinimum = project.videoHeight < minHeight;
                        return (
                          <>
                            <input
                              type="range"
                              min="40"
                              max="100"
                              value={project.videoHeight}
                              onChange={(e) => updateCurrentProject({ videoHeight: parseInt(e.target.value) })}
                              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${isBelowMinimum ? 'accent-red-600' : 'accent-blue-600'} ${isDarkMode ? 'bg-white/5' : 'bg-gray-200'}`}
                            />
                            <div className={`text-[9px] font-bold flex items-center justify-between ${isBelowMinimum ? 'text-red-500' : isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>
                              <span>{lang === 'es' ? `Mínimo requerido: ${minHeight}% (${project.clips.length} clips)` : `Minimum required: ${minHeight}% (${project.clips.length} clips)`}</span>
                              {isBelowMinimum && <span>⚠️ {lang === 'es' ? 'Fuera de marco' : 'Out of frame'}</span>}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className={`text-xs font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>
                        <div className="w-2 h-2 rounded-full border border-gray-300" style={{backgroundColor: project.background}}></div>
                        {lang === 'es' ? "Fondo de Lienzo" : "Canvas Background"}
                      </label>
                      <div className={`flex items-center gap-4 p-3 rounded-2xl border shadow-inner transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-gray-50 border-gray-200'}`}>
                        <input type="color" value={project.background} onChange={(e) => updateCurrentProject({ background: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                        <span className={`text-sm font-mono tracking-wider uppercase transition-colors ${isDarkMode ? 'text-gray-500' : 'text-gray-700'}`}>{project.background}</span>
                      </div>
                    </div>
                    <ToggleRow label={lang === 'es' ? "Subtítulos Dinámicos" : "Dynamic Captions"} checked={showCaptions} onChange={setShowCaptions} isDarkMode={isDarkMode} />
                  </div>
                </div>

                {/* Subtitle Template Section - Relocated above ranking moments */}
                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{lang === 'es' ? "Plantilla de Subtítulo (Título Principal)" : "Subtitle Template (Main Title)"}</label>
                    <span className="text-[10px] font-black text-blue-500 uppercase">{lang === 'es' ? "Solo Afecta al Título de Arriba" : "Only Affects Top Title"}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                    {STYLE_PRESETS.map((style) => (
                      <button 
                        key={style.id}
                        onClick={() => updateCurrentProject({ captionStyle: style.id })}
                        className={`aspect-video rounded-2xl border flex flex-col items-center justify-center p-4 transition-all hover:scale-[1.03] active:scale-95 overflow-hidden ${project.captionStyle === style.id ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10' : (isDarkMode ? 'border-white/5 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-gray-50 hover:bg-white hover:shadow-md')}`}
                      >
                        {style.id === 'NONE' ? <Ban className={`mb-2 ${isDarkMode ? 'text-gray-700' : 'text-gray-400'}`} /> : <span className={`${style.classes} text-[10px] mb-2 truncate max-w-full leading-none`}>{style.name}</span>}
                        <span className={`text-[7px] font-black uppercase tracking-widest mt-auto transition-colors ${isDarkMode ? 'text-gray-600' : 'text-gray-600'}`}>{style.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center justify-between gap-4 flex-1">
                    <h3 className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{lang === 'es' ? "MOMENTOS DE CLASIFICACIÓN" : "RANKING MOMENTS"}</h3>
                    <span className={`text-[9px] font-bold ${isDarkMode ? 'text-gray-600' : 'text-gray-500'}`}>{project.clips.length}/10</span>
                  </div>
                  <button
                    onClick={() => {
                      const nextRank = project.clips.length + 1;
                      const newClip: Clip = { id: `clip_${Date.now()}`, url: '', startTime: 0, endTime: 5, rank: nextRank, title: `Rank #${nextRank} Item`, titleStyleId: 'BLUE_BOX' };
                      updateCurrentProject({ clips: renumberClips([...project.clips, newClip]) });
                      setActiveClipId(newClip.id);
                    }}
                    disabled={project.clips.length >= 10}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all flex-shrink-0 ${
                      project.clips.length >= 10
                        ? isDarkMode ? 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50' : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        : isDarkMode ? 'bg-white/5 text-blue-400 hover:bg-white/10' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <Plus size={14} /> {lang === 'es' ? "Agregar Clip" : "Add Clip"}
                  </button>
                </div>
                <div className={`flex-1 overflow-y-auto space-y-6 pr-4 max-h-[calc(100vh-300px)] ${isDarkMode ? 'scrollbar-dark' : 'scrollbar-light'}`}>
                  {project.clips.map((clip, index) => (
                  <ClipCard
                    key={clip.id} clip={clip} index={index} active={activeClipId === clip.id}
                    onClick={() => setActiveClipId(clip.id)}
                    onUpdate={handleUpdateClip}
                    onMove={(id, offset) => updateCurrentProject({ clips: moveClip(project.clips, id, offset) })}
                    isFirst={index === 0}
                    isLast={index === project.clips.length - 1}
                    onRemove={(id) => {
                      const updated = renumberClips(project.clips.filter(c => c.id !== id));
                      updateCurrentProject({ clips: updated });
                      if (activeClipId === id) setActiveClipId(updated[0]?.id || null);
                    }}
                    isProcessing={false}
                    isDarkMode={isDarkMode}
                    menuOpenId={menuOpenId}
                    onOpenMenu={setMenuOpenId}
                    lang={lang}
                    onFileUpload={handleFileUpload}
                    isUploading={Boolean(uploadingClipIds[clip.id])}
                    uploadError={uploadErrors}
                    onDownloadUrl={handleDownloadUrl}
                    isDownloading={Boolean(downloadingClipIds[clip.id])}
                    downloadError={downloadErrors}
                  />
                ))}
                </div>
              </section>
            </div>

            {/* Video Preview Container */}
            <div className="w-full lg:w-[540px] p-10 lg:sticky lg:top-0 h-fit z-20 flex flex-col items-center gap-4">
              {/* Preview Visual */}
              <div className="relative rounded-[52px] overflow-hidden border-[14px] border-[#1a1a1a] shadow-[0_0_120px_rgba(0,0,0,0.8)] w-full select-none flex-shrink-0">
              <div ref={setPreviewContainer} className="relative w-full aspect-[9/16] overflow-hidden flex flex-col items-center justify-center" style={{ backgroundColor: project.background }}>
                <div className="w-full overflow-hidden flex items-center justify-center transition-all duration-300 relative z-40 shadow-2xl" style={{ height: `${project.videoHeight}%` }}>
                  {activeClip?.url ? <div className="w-full h-full relative"><video ref={videoRef} key={activeClip.url} src={resolveMediaUrl(activeClip.url)} autoPlay playsInline className="w-full h-full object-cover" onLoadedMetadata={handlePreviewRestart} onTimeUpdate={handlePreviewTimeUpdate} onEnded={handlePreviewRestart} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /><div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30"></div></div> : <div className="w-full h-full flex items-center justify-center bg-[#111]"><Film size={48} className="text-gray-900 animate-pulse" /></div>}
                </div>
                {/* Overlay stage: laid out at PREVIEW_STAGE size, scaled to the canvas */}
                <div className="absolute top-0 left-0 z-50 pointer-events-none origin-top-left" style={{ width: PREVIEW_STAGE.width, height: PREVIEW_STAGE.height, transform: `scale(${previewScale})` }}>
                  {renderViralTitle()}
                  {activeClip && activeClip.title && (
                    <div
                      ref={clipTitleElementRef}
                      onMouseDown={handleClipTitleDragStart}
                      className={`absolute w-max px-4 py-2 rounded-sm tracking-tighter pointer-events-auto cursor-move ${isDraggingClipTitle ? 'select-none' : ''}`}
                      style={{
                        left: (activeClip.clipTitlePosition ?? DEFAULT_CLIP_TITLE_POSITION).fx * PREVIEW_STAGE.width,
                        top: (activeClip.clipTitlePosition ?? DEFAULT_CLIP_TITLE_POSITION).fy * PREVIEW_STAGE.height,
                        maxWidth: PREVIEW_STAGE.width,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {renderClipTitle()}
                    </div>
                  )}
                {(() => {
                  const layoutConfig = getClipLayoutConfig(project.clips.length);
                  const fontSizeMap: Record<string, number> = { 'text-5xl': 64, 'text-4xl': 48, 'text-3xl': 30, 'text-2xl': 24 };
                  const spacingMap: Record<string, number> = { 'space-y-8': 32, 'space-y-6': 24, 'space-y-4': 16, 'space-y-2': 8 };
                  const fontSize = fontSizeMap[layoutConfig.rankFontSize] || 24;
                  const spacing = spacingMap[layoutConfig.spacing] || 8;
                  const scaleFactor = (project.videoHeight / 100);
                  return (
                    <div className={`absolute left-10 top-[15%] pointer-events-none z-50 overflow-hidden transition-all duration-300`} style={{ maxHeight: `${140 * scaleFactor}px` }}>
                      <div className={`flex flex-col transition-all duration-300`} style={{ gap: `${spacing * scaleFactor}px` }}>
                        {project.clips.map((c, i) => {
                          const rankStyle = STYLE_PRESETS.find(s => s.id === (c.rankStyleId || 'BLUE_BOX')) || currentStyle;
                          const titleStyle = STYLE_PRESETS.find(s => s.id === (c.titleStyleId || 'BLUE_BOX')) || currentStyle;
                          const isItemActive = activeClipId === c.id;
                          return (
                            <div key={c.id} className={`flex items-center transition-all duration-500 ${isItemActive ? 'scale-125 opacity-100' : 'opacity-20 scale-90'}`} style={{ gap: `${5 * scaleFactor}px` }}>
                              <span className={`font-black italic ${rankStyle.classes} ${rankStyle.shadow}`} style={{ fontSize: `${fontSize * scaleFactor}px`, WebkitTextStroke: isItemActive ? '1px black' : '0' }}>{c.rank}.</span>
                              {isItemActive && <div className={`px-4 py-1.5 rounded-sm shadow-2xl tracking-tighter truncate max-w-[140px] ${titleStyle.classes} ${titleStyle.shadow} ${titleStyle.id === 'ALERT' || titleStyle.id === 'BLUE_BOX' ? '' : 'bg-black/20 backdrop-blur-md border border-white/5'} ${c.titleItalic ? 'italic' : ''}`} style={{ fontSize: `${(fontSize * 0.35) * scaleFactor}px` }}>{c.title}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                </div>
              </div>
              </div>

              {/* Control Panel - OUTSIDE Preview */}
              <div className={`w-full rounded-2xl p-4 shadow-xl ${isDarkMode ? 'bg-[#0c0c0c] border border-white/5' : 'bg-gray-100 border border-gray-200'}`}>
                <div className={`rounded-2xl p-3 flex flex-col gap-3 ${isDarkMode ? 'bg-black/60 backdrop-blur-3xl border border-white/10' : 'bg-white/60 backdrop-blur-xl border border-gray-300'}`}>
                  <div className="flex items-center justify-between px-4">
                    <button onClick={() => { const prevIdx = (activeClipIndex - 1 + project.clips.length) % project.clips.length; if (project.clips[prevIdx]) setActiveClipId(project.clips[prevIdx].id); }} className="text-white/40 hover:text-white transition-all"><ChevronLeft size={24} /></button>
                    <button onClick={handleTogglePlay} className="p-3 bg-white text-black rounded-full shadow-lg hover:scale-110 active:scale-90 transition-all">{isPlaying ? <PauseCircle size={24} fill="black" /> : <PlayCircle size={24} fill="black" />}</button>
                    <button onClick={() => { const nextIdx = (activeClipIndex + 1) % project.clips.length; if (project.clips[nextIdx]) setActiveClipId(project.clips[nextIdx].id); }} className="text-white/40 hover:text-white transition-all"><ChevronRight size={24} /></button>
                  </div>
                  <div className="px-4"><div className={`h-1.5 w-full rounded-full relative overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}><div className="absolute top-0 left-0 h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ width: `${previewProgress * 100}%` }}></div></div></div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const ToolCard: React.FC<{ icon: React.ReactNode, title: string, description: string, onClick: () => void, badge?: string, isDarkMode: boolean, lang?: 'en' | 'es' }> = ({ icon, title, description, onClick, badge, isDarkMode, lang }) => (
  <button onClick={onClick} className={`flex flex-col text-left p-8 rounded-[40px] border transition-all hover:scale-[1.03] group ${isDarkMode ? 'bg-[#111] border-white/5 hover:bg-[#161616] hover:border-blue-500/30' : 'bg-white border-gray-100 hover:shadow-2xl hover:border-blue-200'}`}>
    <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center mb-6 transition-all group-hover:rotate-6 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50 shadow-inner'}`}>{icon}</div>
    <div className="flex items-center gap-3 mb-2"><h3 className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>{badge && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20">{badge}</span>}</div>
    <p className={`text-sm font-medium leading-relaxed ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{description}</p>
    <div className="mt-auto pt-8 flex items-center gap-2 text-blue-500 font-black text-[10px] uppercase tracking-widest group-hover:translate-x-1 transition-transform">{lang === 'es' ? 'Abrir Herramienta' : 'Open Tool'} <ChevronRight size={14} /></div>
  </button>
);

const SidebarItem: React.FC<{ icon: React.ReactNode, label: string, active?: boolean, onClick: () => void, isDarkMode: boolean }> = ({ icon, label, active, onClick, isDarkMode }) => (
  <button onClick={onClick} className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all w-full group ${active ? (isDarkMode ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-xl' : 'bg-blue-50 text-blue-600 border border-blue-100 shadow-md') : (isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-black hover:bg-gray-100')}`}>
    <div className={active ? (isDarkMode ? 'text-blue-400' : 'text-blue-600') : 'group-hover:text-blue-500 transition-colors'}>{icon}</div>
    <span className="hidden lg:block text-sm font-bold tracking-tight">{label}</span>
  </button>
);

const ToggleRow: React.FC<{ label: string, checked: boolean, onChange: (v: boolean) => void, isDarkMode: boolean }> = ({ label, checked, onChange, isDarkMode }) => (
  <div className="flex items-center justify-between group"><span className={`text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-500' : 'text-gray-700'}`}>{label}</span><button onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full relative transition-all ${checked ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : (isDarkMode ? 'bg-gray-800' : 'bg-gray-200')}`}><div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${checked ? 'left-6' : 'left-1'}`}></div></button></div>
);

const ToolbarButton: React.FC<{ icon: React.ReactNode, active?: boolean, className?: string, isDarkMode: boolean }> = ({ icon, active, className, isDarkMode }) => (
  <button className={`p-2 rounded-lg transition-all ${active ? (isDarkMode ? 'bg-blue-600/10 text-blue-400' : 'bg-blue-50 text-blue-600 shadow-sm') : (isDarkMode ? 'text-gray-500 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-white hover:text-black')} ${className}`}>{icon}</button>
);

const ToolbarDropdown: React.FC<{ label?: string | React.ReactNode, icon?: React.ReactNode, isDarkMode: boolean }> = ({ label, icon, isDarkMode }) => (
  <button className={`flex items-center gap-1 p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-white hover:text-black'}`}>{label || icon} <ChevronDown size={14} className="opacity-50" /></button>
);

const ClipCard: React.FC<{ clip: Clip, index: number, active: boolean, onClick: () => void, onUpdate: (id: string, updates: Partial<Clip>) => void, onRemove: (id: string) => void, onMove: (id: string, offset: -1 | 1) => void, isFirst: boolean, isLast: boolean, isProcessing?: boolean, isDarkMode: boolean, menuOpenId: string | null, onOpenMenu: (id: string | null) => void, lang: 'en' | 'es', onFileUpload?: (clipId: string, file: File) => void, isUploading?: boolean, uploadError?: Record<string, string>, onDownloadUrl?: (clipId: string, url: string) => void, isDownloading?: boolean, downloadError?: Record<string, string> }> = ({ clip, index, active, onClick, onUpdate, onRemove, onMove, isFirst, isLast, isProcessing, isDarkMode, menuOpenId, onOpenMenu, lang, onFileUpload, isUploading = false, uploadError, onDownloadUrl, isDownloading = false, downloadError }) => {
  const [sourceTab, setSourceTab] = useState<'url' | 'upload'>('url');
  // What the user types stays local: a download starts only on Enter, paste or the button
  const [urlDraft, setUrlDraft] = useState(clip.sourceUrl ?? '');
  useEffect(() => { setUrlDraft(clip.sourceUrl ?? ''); }, [clip.sourceUrl]);
  const isMenuOpen = menuOpenId === clip.id;
  const uploadErr = uploadError?.[clip.id];
  const downloadErr = downloadError?.[clip.id];
  // Typed trim values are drafts until blur or Enter, then clamped to a valid range
  const [startDraft, setStartDraft] = useState(String(clip.startTime));
  const [endDraft, setEndDraft] = useState(String(clip.endTime));
  useEffect(() => { setStartDraft(String(clip.startTime)); }, [clip.startTime]);
  useEffect(() => { setEndDraft(String(clip.endTime)); }, [clip.endTime]);

  const commitTrim = (edited: 'start' | 'end') => {
    const startTime = edited === 'start' ? parseFloat(startDraft) : clip.startTime;
    const endTime = edited === 'end' ? parseFloat(endDraft) : clip.endTime;
    const trim = clampTrim(startTime, endTime, clip.duration, edited);
    setStartDraft(String(trim.startTime));
    setEndDraft(String(trim.endTime));
    if (trim.startTime !== clip.startTime || trim.endTime !== clip.endTime) onUpdate(clip.id, trim);
  };

  const handleSubmitUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isDownloading || !onDownloadUrl) return;
    onDownloadUrl(clip.id, trimmed);
  };
  const handleTitleTransform = (type: 'upper' | 'lower' | 'capitalize') => { let newTitle = clip.title; if (type === 'upper') newTitle = clip.title.toUpperCase(); if (type === 'lower') newTitle = clip.title.toLowerCase(); if (type === 'capitalize') newTitle = clip.title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); onUpdate(clip.id, { title: newTitle }); onOpenMenu(null); };
  return (
    <div onClick={onClick} className={`rounded-[32px] border transition-all cursor-pointer p-8 relative ${active ? (isDarkMode ? 'border-blue-500/40 bg-[#161616] shadow-2xl' : 'border-blue-300 bg-blue-50/30 shadow-xl') : (isDarkMode ? 'border-white/5 bg-[#111] hover:border-white/10' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md')}`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-5 flex-1">
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${active ? 'bg-blue-600 text-white shadow-xl rotate-3' : (isDarkMode ? 'bg-white/5 text-gray-600' : 'bg-gray-100 text-gray-500')}`}>{index + 1}</span>
          <div className="flex-1 space-y-1"><input type="text" value={clip.title} onClick={e => e.stopPropagation()} onChange={e => onUpdate(clip.id, { title: e.target.value })} className={`bg-transparent border-none font-black text-2xl w-full focus:ring-0 uppercase tracking-tight p-0 transition-colors ${isDarkMode ? 'text-white placeholder:text-gray-800' : 'text-gray-900 placeholder:text-gray-400'} ${clip.titleItalic ? 'italic' : ''}`} placeholder={lang === 'es' ? "Introducir Título..." : "Enter Title..."} /></div>
        </div>
        <div className="flex items-center gap-3 relative">
          <button onClick={e => { e.stopPropagation(); onOpenMenu(isMenuOpen ? null : clip.id); }} className={`p-3 rounded-2xl transition-all relative z-10 ${isMenuOpen || active ? 'text-blue-400 bg-blue-600/10' : 'text-blue-500/40 hover:text-blue-400 hover:bg-blue-400/10'}`}><ChevronRight size={22} className={`transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : ''}`} /></button>
          {isMenuOpen && <div onClick={e => e.stopPropagation()} className={`absolute top-full right-0 mt-2 w-48 rounded-2xl border p-2 shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[100] animate-in fade-in zoom-in-95 duration-200 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}><div className="flex flex-col gap-1"><button onClick={() => handleTitleTransform('upper')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-700 hover:text-black'}`}><TypeIconComponent size={14} className="text-blue-500" /> {lang === 'es' ? 'MAYÚSCULAS' : 'UPPERCASE'}</button><button onClick={() => handleTitleTransform('lower')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-700 hover:text-black'}`}><TypeIconComponent size={14} className="text-blue-500" /> {lang === 'es' ? 'minúsculas' : 'lowercase'}</button><button onClick={() => handleTitleTransform('capitalize')} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-700 hover:text-black'}`}><TypeIconComponent size={14} className="text-blue-500" /> {lang === 'es' ? 'Capitalizar' : 'Capitalize'}</button><div className={`h-px w-full my-1 ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}></div><button onClick={() => { onUpdate(clip.id, { titleItalic: !clip.titleItalic }); onOpenMenu(null); }} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${isDarkMode ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-700 hover:text-black'}`}><div className="flex items-center gap-3"><Italic size={14} className={clip.titleItalic ? 'text-blue-500' : ''} /> {lang === 'es' ? 'Cursiva' : 'Italic'}</div>{clip.titleItalic && <CheckCircle2 size={12} className="text-blue-500" />}</button></div></div>}
          <div className="flex flex-col">
            <button type="button" onClick={e => { e.stopPropagation(); onMove(clip.id, -1); }} disabled={isFirst} aria-label={translations[lang].moveClipUp} title={translations[lang].moveClipUp} className={`p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none ${isDarkMode ? 'text-gray-600 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}><ArrowUp size={16} /></button>
            <button type="button" onClick={e => { e.stopPropagation(); onMove(clip.id, 1); }} disabled={isLast} aria-label={translations[lang].moveClipDown} title={translations[lang].moveClipDown} className={`p-1.5 rounded-lg transition-all disabled:opacity-20 disabled:pointer-events-none ${isDarkMode ? 'text-gray-600 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}><ArrowDown size={16} /></button>
          </div>
          <button onClick={e => { e.stopPropagation(); onRemove(clip.id); }} className={`p-3 transition-all rounded-2xl ${isDarkMode ? 'text-gray-600 hover:text-red-500 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}><Trash2 size={20}/></button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={`border rounded-[24px] flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden group/thumb shadow-inner transition-colors ${isDarkMode ? 'bg-black/60 border-white/5' : 'bg-gray-100 border-gray-200'}`}>{isProcessing ? <Loader2 className="text-blue-500 animate-spin" size={28} /> : clip.url ? <video src={resolveMediaUrl(clip.url)} className="w-full h-full object-cover opacity-60 group-hover/thumb:opacity-100 transition-opacity" /> : <Film className={isDarkMode ? 'text-gray-800' : 'text-gray-400'} size={32} />}<div className="absolute bottom-4 inset-x-4 space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2"><button onClick={() => setSourceTab('url')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${sourceTab === 'url' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-200 text-gray-700')}`}>{lang === 'es' ? 'Enlace' : 'URL'}</button><button onClick={() => setSourceTab('upload')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${sourceTab === 'upload' ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') : (isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-gray-200 text-gray-700')}`}>{lang === 'es' ? 'Archivo' : 'File'}</button></div>
            {sourceTab === 'url' ? (
              <div className={`flex items-center gap-3 backdrop-blur-xl border rounded-2xl px-5 py-3 shadow-2xl transition-colors ${isDarkMode ? 'bg-[#111]/90 border-white/10' : 'bg-white/90 border-gray-200 shadow-lg'}`}>{isDownloading ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <LinkIcon size={14} className={isDarkMode ? 'text-gray-600' : 'text-gray-400'} />}<input type="text" placeholder={lang === 'es' ? "Pegar enlace viral..." : "Paste viral link..."} value={urlDraft} onClick={e => e.stopPropagation()} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrlDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSubmitUrl(urlDraft); } }} onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => { const pasted = e.clipboardData.getData('text'); const input = e.currentTarget; if (pasted && input.selectionStart === 0 && input.selectionEnd === input.value.length) { e.preventDefault(); setUrlDraft(pasted); handleSubmitUrl(pasted); } }} className={`bg-transparent border-none text-[11px] w-full focus:ring-0 font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`} disabled={isDownloading} /><button type="button" onClick={e => { e.stopPropagation(); handleSubmitUrl(urlDraft); }} disabled={isDownloading || !urlDraft.trim()} aria-label={translations[lang].downloadFromLink} title={translations[lang].downloadFromLink} className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-black hover:bg-gray-100'}`}><Download size={14} /></button></div>
            ) : (
              <div className={`flex items-center gap-2 relative ${isDarkMode ? 'bg-[#111]/90' : 'bg-white/90'} backdrop-blur-xl border rounded-2xl px-3 py-2 shadow-2xl transition-colors`}><input type="file" accept="video/mp4" onChange={e => { const file = e.target.files?.[0]; if (file && onFileUpload) onFileUpload(clip.id, file); }} disabled={isUploading} className={`hidden`} id={`file-${clip.id}`} /><label htmlFor={`file-${clip.id}`} className={`flex-1 flex items-center gap-2 cursor-pointer text-[11px] font-bold ${isUploading ? (isDarkMode ? 'text-gray-600' : 'text-gray-400') : (isDarkMode ? 'text-white' : 'text-gray-900')}`}>{isUploading ? <Loader2 size={14} className="animate-spin" /> : <VideoIcon size={14} />} {lang === 'es' ? 'Seleccionar archivo...' : 'Select file...'}</label></div>
            )}
            {sourceTab === 'url' && downloadErr && <span className="text-[10px] text-red-500 font-bold">{downloadErr}</span>}
            {sourceTab === 'upload' && uploadErr && <span className="text-[10px] text-red-500 font-bold">{uploadErr}</span>}
          </div></div>
        <div className={`border rounded-[24px] p-6 flex flex-col justify-center gap-6 shadow-inner transition-colors ${isDarkMode ? 'bg-[#0c0c0c] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
          <div className="grid grid-cols-2 gap-6" onClick={e => e.stopPropagation()}>
            <div className="space-y-2">
              <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isDarkMode ? 'text-gray-700' : 'text-gray-600'}`}>{lang === 'es' ? "Punto de Entrada" : "In-point"}</span>
              <input type="number" step="0.1" min={0} max={clip.duration || undefined} value={startDraft} onChange={e => setStartDraft(e.target.value)} onBlur={() => commitTrim('start')} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} className={`w-full border rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors ${isDarkMode ? 'bg-[#151515] border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
            </div>
            <div className="space-y-2">
              <span className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${isDarkMode ? 'text-gray-700' : 'text-gray-600'}`}>{lang === 'es' ? "Punto de Salida" : "Out-point"}</span>
              <input type="number" step="0.1" min={0} max={clip.duration || undefined} value={endDraft} onChange={e => setEndDraft(e.target.value)} onBlur={() => commitTrim('end')} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} className={`w-full border rounded-xl px-4 py-3 text-sm font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors ${isDarkMode ? 'bg-[#151515] border-white/5 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
            </div>
          </div>
          {clip.url && clip.duration && <TrimTimeline duration={clip.duration} startTime={clip.startTime} endTime={clip.endTime} onStartChange={(newStart: number) => onUpdate(clip.id, { startTime: newStart })} onEndChange={(newEnd: number) => onUpdate(clip.id, { endTime: newEnd })} isDarkMode={isDarkMode} />}
          <div className="flex items-center gap-2 text-gray-400">
            <Maximize2 size={12}/>
            <span className="text-[8px] font-black uppercase tracking-widest">{lang === 'es' ? "Ajustar a Duración de Gancho Viral" : "Trim to Viral Hook Duration"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
