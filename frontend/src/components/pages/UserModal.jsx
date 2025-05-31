import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';

const UserModal = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'user'
  });
  const [editingUserId, setEditingUserId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let q;
      const usersRef = collection(db, 'users');
      
      if (currentUser.role === 'superadmin') {
        q = query(usersRef, where('role', 'in', ['admin', 'user']));
      } else if (currentUser.role === 'admin') {
        q = query(usersRef, where('role', '==', 'user'));
      } else {
        q = query(usersRef, where('id', '==', currentUser.id));
      }
      
      const querySnapshot = await getDocs(q);
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (e) => {
    setFormData(prev => ({ ...prev, role: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const usersRef = collection(db, 'users');
      const userData = {
        ...formData,
        createdAt: new Date().toISOString(),
        isGuest: false
      };

      if (editingUserId) {
        const userRef = doc(db, 'users', editingUserId);
        await updateDoc(userRef, userData);
        alert('User updated successfully');
      } else {
        await addDoc(usersRef, userData);
        alert('User added successfully');
      }

      fetchUsers();
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Failed to save user');
    }
  };

  const handleEdit = (user) => {
    setFormData({
      email: user.email,
      password: '', // Don't pre-fill password for security
      role: user.role
    });
    setEditingUserId(user.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const userRef = doc(db, 'users', id);
        await deleteDoc(userRef);
        alert('User deleted successfully');
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      role: 'user'
    });
    setEditingUserId(null);
  };

  return (
    <div className="user-management">
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          padding: '8px 16px',
          background: '#1890ff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Manage Users
      </button>

      {isOpen && (
        <div className="modal" style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: '1000'
        }}>
          <div className="modal-content" style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '80%',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>User Management</h2>
              <button onClick={() => {
                setIsOpen(false);
                resetForm();
              }} style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer'
              }}>
                &times;
              </button>
            </div>

            {['superadmin', 'admin'].includes(currentUser.role) && (
              <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!editingUserId}
                    style={{ width: '100%', padding: '8px' }}
                  />
                </div>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Role:</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleRoleChange}
                    required
                    style={{ width: '100%', padding: '8px' }}
                  >
                    {currentUser.role === 'superadmin' && <option value="admin">Admin</option>}
                    <option value="user">User</option>
                  </select>
                </div>
                
                <button type="submit" style={{
                  padding: '8px 16px',
                  background: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}>
                  {editingUserId ? 'Update User' : 'Add User'}
                </button>
              </form>
            )}

            {loading ? (
              <p>Loading users...</p>
            ) : (
              <div className="user-table">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Role</th>
                      {currentUser.role !== 'user' && (
                        <th style={{ textAlign: 'left', padding: '8px' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '8px' }}>{user.email}</td>
                        <td style={{ padding: '8px' }}>{user.role}</td>
                        {currentUser.role !== 'user' && (
                          <td style={{ padding: '8px' }}>
                            <button 
                              onClick={() => handleEdit(user)}
                              style={{
                                marginRight: '8px',
                                padding: '4px 8px',
                                background: '#faad14',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(user.id)}
                              style={{
                                padding: '4px 8px',
                                background: '#ff4d4f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserModal;