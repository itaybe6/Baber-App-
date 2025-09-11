import { supabase, User } from '../supabase';

export const usersApi = {
  // Simple hash function for passwords (for demo purposes)
  hashPassword(password: string): string {
    // In production, use a proper hashing library like bcrypt
    // For now, we'll use a simple approach
    return password === '123456' ? 'default_hash' : `hash_${password}`;
  },



  // Get user by phone and password (for login)
  async authenticateUserByPhone(phone: string, password: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error || !data) {
        return null;
      }

      // בדיקת סיסמה
      const hashedPassword = this.hashPassword(password);
      if (hashedPassword === data.password_hash) {
        // if blocked user, still return (caller decides), but include flag
        return data;
      }

      return null;
    } catch (error) {
      console.error('Error authenticating user by phone:', error);
      return null;
    }
  },

  // Get user by ID
  async getUserById(id: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  // Create new user
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'> & { email?: string }): Promise<User | null> {
    try {
      // Add default password hash if not provided
      const userWithPassword = {
        ...userData,
        password_hash: userData.password_hash || this.hashPassword('123456')
      };

      const { data, error } = await supabase
        .from('users')
        .insert([userWithPassword])
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  },

  // Create new user with password
  async createUserWithPassword(userData: Omit<User, 'id' | 'created_at' | 'updated_at'> & { email?: string }, password: string): Promise<User | null> {
    try {
      const userWithPassword = {
        ...userData,
        password_hash: this.hashPassword(password)
      };

      const { data, error } = await supabase
        .from('users')
        .insert([userWithPassword])
        .select()
        .single();

      if (error) {
        console.error('Error creating user with password:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating user with password:', error);
      return null;
    }
  }
  ,
  // Update existing user
  async updateUser(id: string, updates: Partial<User> & { password?: string }): Promise<User | null> {
    try {
      const payload: any = { ...updates };
      // If a plain password is provided, hash it before saving
      if ((updates as any)?.password) {
        payload.password_hash = this.hashPassword((updates as any).password);
        delete payload.password;
      }

      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating user:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  },

  // Get all admin users (barbers)
  async getAdminUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_type', 'admin')
        .order('name');

      if (error) {
        console.error('Error fetching admin users:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  },

  // Delete user by ID
  async deleteUser(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting user:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }
};