import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';

export const authenticateUser = async (email, password) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error('User not found');
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    if (userData.password !== password) {
      throw new Error('Invalid password');
    }
    
    return {
      id: userDoc.id,
      ...userData
    };
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

export const guestLogin = async (email) => {
  try {
    // First check if user exists with this email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const existingUser = querySnapshot.docs[0].data();
      
      // If existing user is not a guest, throw error
      if (!existingUser.isGuest) {
        throw new Error('This email is already registered. Please login with your credentials.');
      }
      
      // If existing user is guest, update lastLogin timestamp
      const userRef = doc(db, 'users', querySnapshot.docs[0].id);
      await updateDoc(userRef, {
        lastLogin: new Date().toISOString()
      });
      
      return {
        id: querySnapshot.docs[0].id,
        ...existingUser,
        lastLogin: new Date().toISOString()
      };
    }
    
    // If no user exists, create new guest user
    const guestUser = {
      email,
      role: 'guest',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      isGuest: true
    };
    
    const docRef = await addDoc(usersRef, guestUser);
    
    return {
      id: docRef.id,
      ...guestUser
    };
  } catch (error) {
    console.error('Guest login error:', error);
    throw error;
  }
};
