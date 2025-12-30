export interface CollectionItem {
  title: string;
  author?: string;
  creator?: string;
  host?: string;
  description: string;
  link: string;
  // For music category
  type?: 'artist' | 'album';
  artist?: string;
  releaseDate?: string; // Format: "YYYY-MM"
}

export interface CollectionCategory {
  id: string;
  title: string;
  theme: string;
  items: CollectionItem[];
}

export const curatedCollectionsData: CollectionCategory[] = [
  {
    id: 'youtube',
    title: 'YouTube',
    theme: 'theme-projects',
    items: [
      { title: 'Example Channel', creator: 'Channel creator', description: 'Lorem ipsum dolor sit amet.', link: 'https://www.youtube.com/' },
      { title: 'Another Channel', creator: 'Channel creator', description: 'Lorem ipsum dolor sit amet.', link: 'https://www.youtube.com/' },
    ],
  },
  {
    id: 'music',
    title: 'Music',
    theme: 'theme-notes',
    items: [
      { type: 'artist', title: 'Example Artist', description: '', link: 'https://music.apple.com/' },
      { type: 'album', title: 'Example Album', artist: 'Example Artist', releaseDate: '2025-01', description: '', link: 'https://music.apple.com/' },
      { type: 'album', title: 'Another Album', artist: 'Example Artist', releaseDate: '2024-06', description: '', link: 'https://music.apple.com/' },
    ],
  },
  {
    id: 'series',
    title: 'Series',
    theme: 'theme-journey',
    items: [
      { title: 'Example Series', creator: 'Studio', description: 'Lorem ipsum dolor sit amet.', link: 'https://www.imdb.com/' },
    ],
  },
  {
    id: 'podcasts',
    title: 'Podcasts',
    theme: 'theme-lab',
    items: [
      { title: 'Example Podcast', host: 'Podcast host', description: 'Lorem ipsum dolor sit amet.', link: 'https://podcasts.apple.com/' },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    theme: 'theme-bio',
    items: [
      { title: 'Astro', description: 'Lorem ipsum dolor sit amet.', link: 'https://astro.build/' },
      { title: 'Three.js', description: 'Lorem ipsum dolor sit amet.', link: 'https://threejs.org/' },
    ],
  },
];
