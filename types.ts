
export interface Clip {
  id: string;
  url: string;
  // Server-side file name returned by /api/upload or /api/download; exports reference clips by this id
  assetId?: string;
  // Link the user pasted (YouTube/TikTok/Instagram) that the video was downloaded from
  sourceUrl?: string;
  thumbnail?: string;
  startTime: number;
  endTime: number;
  duration?: number;
  rank: number;
  title: string;
  rankStyleId?: string;
  titleStyleId?: string;
  titleItalic?: boolean;
  clipTitlePosition?: { x: number, y: number };
}

export interface CaptionStyle {
  id: string;
  name: string;
  classes: string;
  accentColor: string;
  shadow: string;
}

export interface Project {
  id: string;
  title: string;
  clips: Clip[];
  background: string;
  videoHeight: number;
  captionStyle: string;
  enableTitleDrag: boolean;
  titleStroke: number;
  titlePosition: { x: number, y: number };
  highlightedIndices: number[];
}

export interface AIRecommendation {
  rankingItems: {
    rank: number;
    title: string;
    description: string;
  }[];
  styleSuggestion: string;
}

export interface UserProfile {
  name: string;
  email: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  defaultPlatform: 'TikTok' | 'Reels' | 'Shorts';
  defaultCaptionStyle: string;
  accentColor: string;
  autoUppercase: boolean;
  stats: {
    totalVideos: number;
    exportedClips: number;
    aiGenerations: number;
    viewsGained: string;
  };
}


// Export progress step reported by GET /api/export/:jobId
export type ExportStepKey = 'queued' | 'processingClip' | 'concatenating' | 'cleaningUp' | 'completed';

export interface ExportStep {
  key: ExportStepKey;
  clip?: number; // 1-based
  total?: number;
}

// A clip the client refuses to export; clipNumber is 1-based, as shown in the editor
export interface ExportValidationIssue {
  clipNumber: number;
  reason: 'missingVideo' | 'invalidTrim';
}

// Why an export failed. `message` is the server's own text, shown as a detail.
export interface ExportErrorInfo {
  kind: 'noClips' | 'validation' | 'server' | 'network' | 'timeout';
  issues?: ExportValidationIssue[];
  message?: string;
}

// Response of POST /api/upload and POST /api/download
export interface VideoAssetResponse {
  videoUrl: string; // relative, e.g. /api/files/<filename>
  filename: string;
  duration: number;
  platform?: string;
}

// Body of POST /api/export
export interface ExportRequest {
  projectId: string;
  title: string;
  titlePosition: { x: number; y: number };
  titleStroke: number;
  clips: {
    id: string;
    assetId?: string;
    startTime: number;
    endTime: number;
    rank: number;
    title: string;
    titleStyle: { color: string };
    clipTitlePosition?: { x: number; y: number };
  }[];
}

// Response of GET /api/export/:jobId
export interface ExportJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  currentStep: string;
  step?: ExportStep;
  error?: string;
  downloadUrl?: string;
}
