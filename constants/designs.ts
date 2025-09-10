export interface Design {
  id: string;
  name: string;
  image: string;
  category: string[];
  popularity: number; // 1-5
}

export const designs: Design[] = [
  {
    id: 'design-1',
    name: 'פרנץ\' קלאסי',
    image: 'https://images.unsplash.com/photo-1604902396830-aca29e19b067',
    category: ['classic', 'french'],
    popularity: 5,
  },
  {
    id: 'design-2',
    name: 'גליטר זהב',
    image: 'https://images.unsplash.com/photo-1636018943991-397bd9919a3b',
    category: ['glitter', 'gold'],
    popularity: 4,
  },
  {
    id: 'design-3',
    name: 'מרבל אפקט',
    image: 'https://images.unsplash.com/photo-1604902396754-d8d2a7563c50',
    category: ['marble', 'design'],
    popularity: 5,
  },
  {
    id: 'design-4',
    name: 'פסטל מט',
    image: 'https://images.unsplash.com/photo-1632344499878-741ed1f2c745',
    category: ['pastel', 'matte'],
    popularity: 3,
  },
  {
    id: 'design-5',
    name: 'אומברה ורוד',
    image: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66',
    category: ['ombre', 'pink'],
    popularity: 4,
  },
  {
    id: 'design-6',
    name: 'גיאומטרי שחור-לבן',
    image: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc',
    category: ['geometric', 'black-white'],
    popularity: 3,
  },
  {
    id: 'design-7',
    name: 'פרחוני עדין',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371',
    category: ['floral', 'delicate'],
    popularity: 5,
  },
  {
    id: 'design-8',
    name: 'מטאלי כסף',
    image: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b',
    category: ['metallic', 'silver'],
    popularity: 4,
  },
];

export const designCategories = [
  { id: 'classic', name: 'קלאסי' },
  { id: 'french', name: 'פרנץ\'' },
  { id: 'glitter', name: 'גליטר' },
  { id: 'gold', name: 'זהב' },
  { id: 'marble', name: 'מרבל' },
  { id: 'design', name: 'עיצוב' },
  { id: 'pastel', name: 'פסטל' },
  { id: 'matte', name: 'מט' },
  { id: 'ombre', name: 'אומברה' },
  { id: 'pink', name: 'ורוד' },
  { id: 'geometric', name: 'גיאומטרי' },
  { id: 'black-white', name: 'שחור-לבן' },
  { id: 'floral', name: 'פרחוני' },
  { id: 'delicate', name: 'עדין' },
  { id: 'metallic', name: 'מטאלי' },
  { id: 'silver', name: 'כסף' },
];