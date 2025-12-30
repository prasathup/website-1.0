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
      {
        title: 'Kurzgesagt – In a Nutshell',
        creator: 'Kurzgesagt',
        description: 'Complex topics explained with beautiful animation.',
        link: 'https://www.youtube.com/@kurzgesagt/videos',
      },
      {
        title: 'StarTalk',
        creator: 'Neil deGrasse Tyson',
        description: 'Science, pop culture, and comedy.',
        link: 'https://www.youtube.com/@StarTalk/videos',
      },
      {
        title: 'Veritasium',
        creator: 'Derek Muller',
        description: 'Well produced and informative educational contents.',
        link: 'https://www.youtube.com/@veritasium/videos',
      },
      {
        title: 'WVFRM Podcast',
        creator: 'MKBHD and co-hosts Andrew Manganelli and David Imel',
        description: 'Chill, and entertaining conversations about tech.',
        link: 'https://www.youtube.com/@Waveform/videos',
      }
    ]
  },
  {
    id: 'music',
    title: 'Music',
    theme: 'theme-notes', // You can change this theme
    items: [
      // Favorite Artists
      { type: 'artist', title: 'Troye Sivan', description: '', link: 'https://music.apple.com/us/artist/troye-sivan/396295677' },
      { type: 'artist', title: 'Charli XCX', description: '', link: 'https://music.apple.com/us/artist/charli-xcx/432942256' },
      { type: 'artist', title: 'Lady Gaga', description: '', link: 'https://music.apple.com/us/artist/lady-gaga/277293880' },
      { type: 'artist', title: 'Conan Gray', description: '', link: 'https://music.apple.com/us/artist/conan-gray/1168567308' },
      { type: 'artist', title: 'Sega Bodega', description: '', link: 'https://music.apple.com/us/artist/sega-bodega/573553866' },
      { type: 'artist', title: 'Jamie xx', description: '', link: 'https://music.apple.com/us/artist/jamie-xx/405563985' },
      { type: 'artist', title: 'Caroline Polachek', description: '', link: 'https://music.apple.com/us/artist/caroline-polachek/385592090' },
      { type: 'artist', title: 'Billie Eilish', description: '', link: 'https://music.apple.com/us/artist/billie-eilish/1065981054' },
      // Albums
      { type: 'album', title: 'Something to Give Each Other', artist: 'Troye Sivan', releaseDate: '2023-10', description: '', link: 'https://music.apple.com/us/album/something-to-give-each-other/1694860250' },
      { type: 'album', title: 'Brat', artist: 'Charli XCX', releaseDate: '2024-06', description: '', link: 'https://music.apple.com/us/album/brat-and-its-completely-different-but-also-still-brat/1773518270' },
      { type: 'album', title: 'Radical Optimism', artist: 'Dua Lipa', releaseDate: '2024-05', description: '', link: 'https://music.apple.com/us/album/radical-optimism/1734980417' },
      { type: 'album', title: 'All Born Screaming', artist: 'St. Vincent', releaseDate: '2024-04', description: '', link: 'https://music.apple.com/us/album/all-born-screaming/1729549170' },
      { type: 'album', title: 'Found Heaven', artist: 'Conan Gray', releaseDate: '2024-04', description: '', link: 'https://music.apple.com/us/album/found-heaven/1727371945' },
      { type: 'album', title: 'In Waves', artist: 'Jamie xx', releaseDate: '2024-10', description: '', link: 'https://music.apple.com/us/album/in-waves/1746750796' },
      { type: 'album', title: 'Desire, I Want To Turn Into You: Everasking Edition', artist: 'Caroline Polachek', releaseDate: '2023-02', description: '', link: 'https://music.apple.com/us/album/desire-i-want-to-turn-into-you-everasking-edition/1732294271' },
      { type: 'album', title: 'Guts', artist: 'Olivia Rodrigo', releaseDate: '2023-09', description: '', link: 'https://music.apple.com/us/album/guts/1694767605' },
      { type: 'album', title: 'Did you know that there\'s a tunnel under Ocean Blvd', artist: 'Lana Del Rey', releaseDate: '2023-03', description: '', link: 'https://music.apple.com/us/album/did-you-know-that-theres-a-tunnel-under-ocean-blvd/1655349115' },
      { type: 'album', title: 'Fanfare', artist: 'Dorian Electra', releaseDate: '2023-10', description: '', link: 'https://music.apple.com/us/album/fanfare/1695533237' },
      { type: 'album', title: 'Happier Than Ever', artist: 'Billie Eilish', releaseDate: '2021-07', description: '', link: 'https://music.apple.com/de/album/happier-than-ever/1564530719?l=en-GB' },
      { type: 'album', title: 'Imaginal Disk', artist: 'Magdalena Bay', releaseDate: '2024-08', description: '', link: 'https://music.apple.com/us/album/imaginal-disk/1751414757' },
      // New additions
      { type: 'album', title: 'I Created the Universe so That Life Could Create a Language so Complex, Just to Say How Much I Love You', artist: 'Sega Bodega', releaseDate: '2025-11', description: '', link: 'https://music.apple.com/us/album/i-created-the-universe-so-that-life-could-create/1850925966' },
      { type: 'album', title: 'Mayhem', artist: 'Lady Gaga', releaseDate: '2025-03', description: '', link: 'https://music.apple.com/at/album/mayhem/1792666546' },
      { type: 'album', title: 'Happiness Is Going To Get You', artist: 'Allie X', releaseDate: '2025-09', description: '', link: 'https://music.apple.com/de/album/happiness-is-going-to-get-you/1840659163' },
      { type: 'album', title: 'Wishbone', artist: 'Conan Gray', releaseDate: '2025-08', description: '', link: 'https://music.apple.com/de/album/wishbone/1816089441' },
      { type: 'album', title: 'EUSEXUA', artist: 'FKA twigs', releaseDate: '2025-01', description: '', link: 'https://music.apple.com/us/album/eusexua/1767658574' },
      { type: 'album', title: 'I Love You So F***ing Much', artist: 'Glass Animals', releaseDate: '2024-07', description: '', link: 'https://music.apple.com/de/album/i-love-you-so-f-ing-much/1743823674' },
      { type: 'album', title: 'Polari', artist: 'Olly Alexander', releaseDate: '2025-02', description: '', link: 'https://music.apple.com/de/album/polari/1770487324' },
      { type: 'album', title: 'THE BPM', artist: 'Sudan Archives', releaseDate: '2025-06', description: '', link: 'https://music.apple.com/de/album/the-bpm/1820509805' },
      { type: 'album', title: 'Hit Me Hard and Soft', artist: 'Billie Eilish', releaseDate: '2024-05', description: '', link: 'https://music.apple.com/de/album/hit-me-hard-and-soft/1739659134' },
      { type: 'album', title: 'Girl with no face', artist: 'Allie X', releaseDate: '2024-02', description: '', link: 'https://music.apple.com/de/album/girl-with-no-face/1711778190' },
      { type: 'album', title: 'Dennis', artist: 'Sega Bodega', releaseDate: '2024-04', description: '', link: 'https://music.apple.com/de/album/dennis/1736972898' },
      { type: 'album', title: 'The Code', artist: 'Nemo', releaseDate: '2024-02', description: '', link: 'https://music.apple.com/us/song/the-code/1730730673' },
    ]
  },
  {
    id: 'series',
    title: 'Series',
    theme: 'theme-journey',
    items: [
      {
        title: 'Star Trek: The Next Generation',
        creator: '',
        description: 'My all time favorite series that envisions optimistic future for humanity.',
        link: 'https://www.rottentomatoes.com/tv/star_trek_the_next_generation',
      },
      {
        title: 'The Big Bang Theory',
        creator: '',
        description: 'A comedy about nerdy scientists and their social lives.',
        link: 'https://www.rottentomatoes.com/tv/the_big_bang_theory',
      },
      {
        title: 'Avatar: The Last Airbender',
        creator: '',
        description: 'A journey of friendship, forgiveness, and growth.',
        link: 'https://www.rottentomatoes.com/tv/avatar_the_last_airbender',
      },
      {
        title: 'Rick and Morty',
        creator: '',
        description: 'Absurd, comedy, nihilism and philosophical.',
        link: 'https://www.rottentomatoes.com/tv/rick_and_morty',
      }
    ]
  },
  {
    id: 'podcasts',
    title: 'Podcasts',
    theme: 'theme-bio',
    items: [
      {
        title: 'A Bit of Optimism',
        host: 'Simon Sinek',
        description: 'Inspiring conversations about leadership and culture.',
        link: 'https://podcasts.apple.com/de/podcast/a-bit-of-optimism/id1515385282?l=en-GB',
      },
      {
        title: 'What Now? with Trevor Noah',
        host: 'Trevor Noah',
        description: 'Deep conversations with interesting people.',
        link: 'https://podcasts.apple.com/de/podcast/what-now-with-trevor-noah/id1710609544?l=en-GB',
      }
    ]
  },
  {
    id: 'books',
    title: 'Books',
    theme: 'theme-notes',
    items: [
      {
        title: 'Clean',
        author: 'James Hamblin',
        description: 'A look at skin microbiome and skincare industry.',
        link: 'https://www.goodreads.com/book/show/48984802-clean?ref=nav_sb_ss_1_11',
      },
      {
        title: 'The Infinite Game',
        author: 'Simon Sinek',
        description: 'How to lead with an infinite mindset.',
        link: 'https://www.goodreads.com/book/show/38390751-the-infinite-game?ref=nav_sb_ss_1_11',
      },
    ]
  },
  {
    id: 'tools',
    title: 'Tools',
    theme: 'theme-lab',
    items: [
      {
        title: 'Blender',
        description: 'To explore 3D design and film production.',
        link: 'https://www.blender.org/',
      },
      {
        title: 'DaVinci Resolve',
        description: 'Video editing, color correction, and visual effects.',
        link: 'https://www.blackmagicdesign.com/products/davinciresolve',
      },
      {
        title: 'Figma',
        description: 'For website layout and image editing.',
        link: 'https://www.figma.com/',
      },
      {
        title: 'Affinity',
        description: 'Photo and graphic editing.',
        link: 'https://www.affinity.studio/',
      },
      {
        title: 'Cursor',
        description: 'AI code editor.',
        link: 'https://cursor.com/',
      },
      {
        title: 'Unreal Engine',
        description: 'Explore 3D design and film production.',
        link: 'https://www.unrealengine.com/',
      },
      {
        title: 'Procreate',
        description: 'My fav digital illustration and painting app.',
        link: 'https://procreate.art/',
      },
      {
        title: 'Cloudlflare',
        description: 'Web hosting',
        link: 'https://cloudflare.com/',
      },
      {
        title: 'GitHub',
        description: 'Code hosting and version control.',
        link: 'https://github.com/',
      },
      {
        title: 'GarageBand',
        description: 'For experimentation with music.',
        link: 'https://www.apple.com/mac/garageband/',
      }
    ]
  }
];
