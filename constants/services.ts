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
    name: 'תספורת קלאסית',
    price: 80,
    duration: 30,
    image: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=300&h=300&fit=crop&crop=center',
    category: 'basic',
  },
  {
    id: 'b2c3d4e5-f6a7-4801-bcde-f12345678901',
    name: 'תספורת מכונה',
    price: 120,
    duration: 45,
    image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=300&h=300&fit=crop&crop=center',
    category: 'gel',
  },
  {
    id: 'c3d4e5f6-a7b8-4012-cdef-123456789012',
    name: 'עיצוב זקן',
    price: 200,
    duration: 90,
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=center',
    category: 'acrylic',
  },
  {
    id: 'd4e5f6a7-b8c9-4123-defa-234567890123',
    name: 'תספורת ילדים',
    price: 150,
    duration: 60,
    image: 'https://images.unsplash.com/photo-1598524375070-259d3dc1030b?w=300&h=300&fit=crop&crop=center',
    category: 'design',
  },
  {
    id: 'e5f6a7b8-c9d0-4234-efab-345678901234',
    name: 'טיפול פנים לגבר',
    price: 100,
    duration: 40,
    image: 'https://images.unsplash.com/photo-1605727216809-79b4d7a7f9d8?w=300&h=300&fit=crop&crop=center',
    category: 'care',
  },
  {
    id: 'f6a7b8c9-d0e1-4345-fabc-456789012345',
    name: 'גילוח קלאסי בסכין',
    price: 60,
    duration: 30,
    image: 'https://images.unsplash.com/photo-1519947486511-46149fa0a254?w=300&h=300&fit=crop&crop=center',
    category: 'basic',
  },
];

export const categories = [
  { id: 'basic', name: 'תספורת' },
  { id: 'gel', name: 'מכונה' },
  { id: 'acrylic', name: 'זקן' },
  { id: 'design', name: 'ילדים' },
  { id: 'care', name: 'טיפוח גברי' },
];