export enum UserType {
  ADMIN = 'admin',
  CLIENT = 'client'
}

// Type guard to check if a string is a valid UserType
export function isValidUserType(type: string): type is UserType {
  return Object.values(UserType).includes(type as UserType);
}

export interface User {
  id: string;
  phone: string;
  type: UserType;
  name: string;
  email?: string | null;
  image_url?: string | null;
  // Optional: for compatibility with records coming from the DB which use `user_type`
  user_type?: string;
}

// משתמשים לדוגמה - בפועל זה יהיה מהשרת
export const DEMO_USERS: User[] = [
  {
    id: '1',
    phone: '0501234567',
    type: UserType.ADMIN,
    name: 'מנהל הסטודיו'
  },
  {
    id: '2', 
    phone: '0507654321',
    type: UserType.CLIENT,
    name: 'לקוח דמו'
  }
];

export const findUserByCredentials = (phone: string, password: string): User | null => {
  // בדוגמה זו, הסיסמה היא תמיד "123456"
  const user = DEMO_USERS.find(u => u.phone === phone);
  if (user && password === '123456') {
    return user;
  }
  return null;
};