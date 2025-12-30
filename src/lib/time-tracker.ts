/**
 * Time Tracker - Monitors file activity to track active development time
 * 
 * Features:
 * - Tracks time only when files are actively modified
 * - Stops tracking after inactivity period (default: 5 minutes)
 * - Resumes tracking when activity resumes
 * - Logs sessions to JSON file for analysis
 * - Portable across projects
 */

import { watch, existsSync } from 'fs';
import { homedir } from 'os';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname, basename } from 'path';

export interface TrackingSession {
  startTime: string;
  endTime: string | null;
  duration: number; // in seconds
  filesModified: string[];
}

export interface TrackingData {
  sessions: TrackingSession[];
  totalSeconds: number;
  firstTracked: string | null;
  lastTracked: string | null;
}

export interface TrackerConfig {
  // Time in milliseconds before considering session inactive
  inactivityTimeout: number;
  // Directories to watch (relative to project root)
  watchDirectories: string[];
  // File extensions to track (empty array = all files)
  trackedExtensions: string[];
  // Files/directories to ignore
  ignorePatterns: string[];
  // Data file path (relative to project root)
  dataFile: string;
}

const DEFAULT_CONFIG: TrackerConfig = {
  inactivityTimeout: 15 * 60 * 1000, // 15 minutes
  watchDirectories: ['src', 'public', 'docs'],
  trackedExtensions: ['.astro', '.ts', '.tsx', '.js', '.jsx', '.css', '.md', '.json'],
  ignorePatterns: ['node_modules', 'dist', '.astro', '.git', '*.log'],
  dataFile: '.time-tracker/data.json', // Will be overridden to use home directory
};

export class TimeTracker {
  private config: TrackerConfig;
  private currentSession: TrackingSession | null = null;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private watchers: Array<ReturnType<typeof watch>> = [];
  private isTracking = false;
  private projectRoot: string;

  constructor(config: Partial<TrackerConfig> = {}, projectRoot: string) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.projectRoot = projectRoot;
    
    // Store data in home directory for privacy (not in project)
    // Format: ~/.time-tracker-<project-name>/data.json
    if (!this.config.dataFile.startsWith('/') && !this.config.dataFile.startsWith('~')) {
      const projectName = basename(projectRoot);
      const homeDir = homedir();
      this.config.dataFile = join(homeDir, `.time-tracker-${projectName}`, 'data.json');
    }
  }

  /**
   * Start tracking time - begins monitoring file changes
   */
  async start(): Promise<void> {
    if (this.isTracking) {
      console.log('Time tracker is already running');
      return;
    }

    console.log('Starting time tracker...');
    this.isTracking = true;

    // Load existing data (ensures storage file/dir exist before watching)
    await this.loadData();

    // Set up file watchers for each directory
    for (const dir of this.config.watchDirectories) {
      const fullPath = join(this.projectRoot, dir);
      if (!existsSync(fullPath)) {
        console.warn(`Warning: Directory ${dir} does not exist, skipping`);
        continue;
      }

      try {
        const watcher = watch(
          fullPath,
          { recursive: true },
          (eventType, filename) => {
            // Only track 'change' events (file modifications)
            // Ignore 'rename' events which can be noise
            if (eventType === 'change' && filename && this.shouldTrackFile(filename)) {
              this.handleFileActivity();
            }
          }
        );
        this.watchers.push(watcher);
      } catch (error) {
        console.warn(`Warning: Could not watch ${dir}:`, error);
      }
    }

    console.log(`Watching ${this.watchers.length} directories`);
    console.log(`Inactivity timeout: ${this.config.inactivityTimeout / 1000 / 60} minutes`);
    console.log(`Data storage: ${this.config.dataFile} (private, outside project)`);
  }

  /**
   * Stop tracking time and save all data
   */
  async stop(): Promise<void> {
    if (!this.isTracking) {
      return;
    }

    console.log('Stopping time tracker...');
    this.isTracking = false;

    // End current session if active
    await this.endCurrentSession();

    // Close all watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    // Clear inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    console.log('Time tracker stopped');
  }

  /**
   * Handle file activity - start or continue tracking
   */
  private handleFileActivity(): void {
    // Clear existing inactivity timer
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    const now = new Date().toISOString();

    // Start new session if not tracking
    if (!this.currentSession) {
      this.currentSession = {
        startTime: now,
        endTime: null,
        duration: 0,
        filesModified: [],
      };
      console.log(`[${new Date().toLocaleTimeString()}] Session started`);
    }

    // Set inactivity timer - will end session after timeout
    this.inactivityTimer = setTimeout(async () => {
      await this.endCurrentSession();
    }, this.config.inactivityTimeout);
  }

  /**
   * End current session and save to file
   */
  private async endCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const now = new Date();
    const sessionStart = new Date(this.currentSession.startTime);
    
    // Calculate duration (updates every time file activity occurs)
    const duration = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);

    this.currentSession.endTime = now.toISOString();
    this.currentSession.duration = duration;

    // Load existing data and add this session
    const data = await this.loadData();

    // Update first/last tracked timestamps
    if (!data.firstTracked) {
      data.firstTracked = this.currentSession.startTime;
    }
    data.lastTracked = this.currentSession.endTime;

    // Add session
    data.sessions.push({ ...this.currentSession });
    data.totalSeconds += duration;

    // Save data
    await this.saveData(data);

    console.log(
      `[${now.toLocaleTimeString()}] Session ended - Duration: ${this.formatDuration(duration)}`
    );

    this.currentSession = null;
  }

  /**
   * Check if file should be tracked based on extension and ignore patterns
   */
  private shouldTrackFile(filename: string): boolean {
    // Check ignore patterns
    for (const pattern of this.config.ignorePatterns) {
      if (filename.includes(pattern)) {
        return false;
      }
    }

    // If no extension filter, track all files
    if (this.config.trackedExtensions.length === 0) {
      return true;
    }

    // Check if file extension matches
    const ext = filename.substring(filename.lastIndexOf('.'));
    return this.config.trackedExtensions.includes(ext);
  }

  /**
   * Load tracking data from file
   */
  private async loadData(): Promise<TrackingData> {
    // Data file is stored outside project (in home directory)
    const dataPath = this.config.dataFile;
    const dataDir = dirname(dataPath);

    // Create directory if it doesn't exist
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    // Load existing data or return default
    if (existsSync(dataPath)) {
      try {
        const content = await readFile(dataPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn('Error reading tracking data, starting fresh:', error);
      }
    }

    return {
      sessions: [],
      totalSeconds: 0,
      firstTracked: null,
      lastTracked: null,
    };
  }

  /**
   * Save tracking data to file
   */
  private async saveData(data: TrackingData): Promise<void> {
    // Data file is stored outside project (in home directory)
    const dataPath = this.config.dataFile;
    const dataDir = dirname(dataPath);

    // Create directory if it doesn't exist
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Format duration in seconds to human-readable string
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get current statistics (for external access)
   */
  async getStats(): Promise<TrackingData> {
    const data = await this.loadData();
    
    // If there's an active session, calculate its duration too
    if (this.currentSession) {
      const now = new Date();
      const sessionStart = new Date(this.currentSession.startTime);
      const currentDuration = Math.floor((now.getTime() - sessionStart.getTime()) / 1000);
      
      // Return stats including current session
      return {
        ...data,
        totalSeconds: data.totalSeconds + currentDuration,
      };
    }

    return data;
  }
}

