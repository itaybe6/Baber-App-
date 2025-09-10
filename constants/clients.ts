export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  favoriteDesigns?: string[];
  createdAt: string; // ISO string
  lastVisit?: string; // ISO string
  image?: string;
}

export const clients: Client[] = [
  {
    id: 'client-0',
    name: 'מיכל כהן',
    phone: '050-1234567',
    email: 'michal@example.com',
    address: 'רחוב הרצל 15, תל אביב',
    notes: 'אלרגית ללק מסוג X',
    createdAt: '2023-01-15T10:30:00.000Z',
    lastVisit: '2023-05-20T14:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
  },
  {
    id: 'client-1',
    name: 'שירה לוי',
    phone: '052-9876543',
    email: 'shira@example.com',
    createdAt: '2023-02-10T09:15:00.000Z',
    lastVisit: '2023-06-01T11:30:00.000Z',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
  },
  {
    id: 'client-2',
    name: 'נועה ישראלי',
    phone: '054-5678901',
    email: 'noa@example.com',
    address: 'רחוב אלנבי 78, תל אביב',
    notes: 'מעדיפה צבעים בהירים',
    createdAt: '2023-03-05T16:45:00.000Z',
    lastVisit: '2023-06-10T13:15:00.000Z',
    image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
  },
  {
    id: 'client-3',
    name: 'רותם אברהם',
    phone: '053-1122334',
    createdAt: '2023-04-20T12:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1547212371-eb5e6a4b590c',
  },
  {
    id: 'client-4',
    name: 'יעל גולן',
    phone: '050-9988776',
    email: 'yael@example.com',
    address: 'רחוב דיזנגוף 110, תל אביב',
    createdAt: '2023-01-30T10:00:00.000Z',
    lastVisit: '2023-05-25T15:30:00.000Z',
    image: 'https://images.unsplash.com/photo-1554151228-14d9def656e4',
  },
  {
    id: 'client-5',
    name: 'דנה שרון',
    phone: '052-3344556',
    email: 'dana@example.com',
    createdAt: '2023-02-15T14:30:00.000Z',
    lastVisit: '2023-06-05T10:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1491349174775-aaafddd81942',
  },
  {
    id: 'client-6',
    name: 'ליאת דוד',
    phone: '054-6677889',
    createdAt: '2023-03-10T11:15:00.000Z',
    image: 'https://images.unsplash.com/photo-1593529467220-9d721ceb9a78',
  },
  {
    id: 'client-7',
    name: 'אורלי מזרחי',
    phone: '053-9900112',
    email: 'orly@example.com',
    address: 'רחוב בן יהודה 45, תל אביב',
    notes: 'מעדיפה תורים בבוקר',
    createdAt: '2023-04-05T09:45:00.000Z',
    lastVisit: '2023-06-15T09:30:00.000Z',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956',
  },
  {
    id: 'client-8',
    name: 'הילה פרץ',
    phone: '050-2233445',
    createdAt: '2023-05-01T13:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604',
  },
  {
    id: 'client-9',
    name: 'עדי אלון',
    phone: '052-7788990',
    email: 'adi@example.com',
    createdAt: '2023-05-15T15:15:00.000Z',
    lastVisit: '2023-06-20T16:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91',
  }
];