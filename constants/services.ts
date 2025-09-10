export interface Service {
  id: string;
  name: string;
  price: number;
  duration: number; // in minutes
  image: string;
  category: 'basic' | 'gel' | 'acrylic' | 'design' | 'care';
}

export const services: Service[] = [
  {
    id: 'a1b2c3d4-e5f6-4789-abcd-ef1234567890',
    name: 'מניקור בסיסי',
    price: 80,
    duration: 30,
    image: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=300&h=300&fit=crop&crop=center',
    category: 'basic',
  },
  {
    id: 'b2c3d4e5-f6a7-4801-bcde-f12345678901',
    name: 'מניקור ג׳ל',
    price: 120,
    duration: 45,
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=300&h=300&fit=crop&crop=center',
    category: 'gel',
  },
  {
    id: 'c3d4e5f6-a7b8-4012-cdef-123456789012',
    name: 'בניית ציפורניים אקריליק',
    price: 200,
    duration: 90,
    image: 'https://images.unsplash.com/photo-1599948128020-9856b80bc337?w=300&h=300&fit=crop&crop=center',
    category: 'acrylic',
  },
  {
    id: 'd4e5f6a7-b8c9-4123-defa-234567890123',
    name: 'עיצוב אומנותי',
    price: 150,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=300&h=300&fit=crop&crop=center',
    category: 'design',
  },
  {
    id: 'e5f6a7b8-c9d0-4234-efab-345678901234',
    name: 'טיפול פרפין',
    price: 100,
    duration: 40,
    image: 'https://images.unsplash.com/photo-1610992015732-2449b76344bc',
    category: 'care',
  },
  {
    id: 'f6a7b8c9-d0e1-4345-fabc-456789012345',
    name: 'הסרת ג׳ל',
    price: 60,
    duration: 30,
    image: 'https://images.unsplash.com/photo-1608654686176-9f4e561d2602',
    category: 'basic',
  },
];

export const categories = [
  { id: 'basic', name: 'בסיסי' },
  { id: 'gel', name: 'ג׳ל' },
  { id: 'acrylic', name: 'אקריליק' },
  { id: 'design', name: 'עיצובים' },
  { id: 'care', name: 'טיפוח' },
];