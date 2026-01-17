export interface CapturedFrame {
  id: string;
  dataUrl: string;
  timestamp: number;
  analysis?: string;
  isAnalyzing: boolean;
}

export interface VideoMetadata {
  name: string;
  duration: number;
  width: number;
  height: number;
  url: string;
}

export enum FrameFormat {
  PNG = 'image/png',
  JPEG = 'image/jpeg'
}
